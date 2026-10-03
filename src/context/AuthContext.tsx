import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Profile, type UserRole } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

interface SignUpParams {
  email: string;
  password: string;
  role: UserRole;
  companyName: string;
  fullName: string;
  phone?: string;
  acceptedTermsAt?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        (async () => {
          await loadProfile(sess.user.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp({ email, password, role, companyName, fullName, phone, acceptedTermsAt }: SignUpParams) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          role,
          company_name: companyName,
          full_name: fullName,
          phone: phone || '',
          accepted_terms_at: acceptedTermsAt || '',
        },
      },
    });
    if (error) return { error: error.message };
    // Если в Supabase включено подтверждение почты, сессии ещё нет
    if (!data.session) {
      return { error: null, needsEmailConfirmation: true };
    }
    if (data.user) {
      await loadProfile(data.user.id);
    }
    return { error: null, needsEmailConfirmation: false };
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return {
        error:
          error.message === 'Invalid login credentials'
            ? 'Неверный email или пароль'
            : error.message === 'Email not confirmed'
              ? 'Email не подтверждён. Перейдите по ссылке из письма.'
              : error.message,
      };
    }
    if (data.user) await loadProfile(data.user.id);
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
