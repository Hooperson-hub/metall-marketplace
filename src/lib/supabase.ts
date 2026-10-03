import { createClient } from '@supabase/supabase-js';

// Адрес Supabase. Значение вида "/supabase" означает прокси на нашем же домене
// (nginx передаёт запросы в Supabase), это нужно, чтобы сайт работал в России без VPN.
const rawSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '');
const supabaseUrl = rawSupabaseUrl.startsWith('/') ? window.location.origin + rawSupabaseUrl : rawSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Ссылки на файлы, сохранённые раньше, ведут на *.supabase.co (без VPN из России он недоступен).
// Если сайт работает через свой прокси-адрес, подменяем хост на прокси.
export function fixFileUrl(url: string | null | undefined): string {
  if (!url) return '';
  const base = String(supabaseUrl ?? '').replace(/\/$/, '');
  if (!base) return url;
  return url.replace(/^https:\/\/[a-z0-9]+\.supabase\.co/i, base);
}

export type ProcessType = 'cutting' | 'bending' | 'welding' | 'painting' | 'installation' | 'machining';
export type Material = 'steel' | 'aluminum' | 'copper';
export type UserRole = 'customer' | 'factory';
export type OrderStatus = 'open' | 'in_progress' | 'completed' | 'closed';
export type ProposalStatus = 'submitted' | 'accepted' | 'rejected';

export interface Profile {
  id: string;
  role: UserRole;
  company_name: string;
  full_name: string;
  phone: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  title: string;
  process_type: ProcessType;
  process_types: ProcessType[];
  spec: string | null;
  material: Material;
  quantity: number;
  description: string | null;
  drawing_url: string | null;
  drawing_name: string | null;
  status: OrderStatus;
  created_at: string;
}

export interface Proposal {
  id: string;
  order_id: string;
  factory_id: string;
  price: number;
  lead_time_days: number;
  comment: string | null;
  status: ProposalStatus;
  created_at: string;
}

export interface ProposalWithFactory extends Proposal {
  factory: { full_name: string; company_name: string } | null;
}

export interface Message {
  id: string;
  order_id: string;
  factory_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export interface OrderWithCount extends Order {
  customer: { full_name: string; company_name: string } | null;
  proposal_count: number;
}

export const PROCESS_LABELS: Record<ProcessType, string> = {
  cutting: 'Лазерная резка',
  bending: 'Гибка',
  welding: 'Сварка',
  painting: 'Порошковая покраска',
  installation: 'Монтаж',
  machining: 'Токарные и фрезерные работы',
};

export const PROCESS_ORDER: ProcessType[] = ['cutting', 'bending', 'welding', 'painting', 'installation', 'machining'];

// Список операций заказа (для старых заказов без process_types берём process_type)
export function orderProcesses(o: { process_type: ProcessType; process_types?: ProcessType[] | null }): ProcessType[] {
  return o.process_types && o.process_types.length > 0 ? o.process_types : [o.process_type];
}

export const MATERIAL_LABELS: Record<Material, string> = {
  steel: 'Сталь',
  aluminum: 'Алюминий',
  copper: 'Медь',
};
