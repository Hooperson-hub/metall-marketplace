import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type ProcessType = 'cutting' | 'welding' | 'bending' | 'painting';
export type Material = 'steel' | 'aluminum' | 'copper';
export type UserRole = 'customer' | 'factory';
export type OrderStatus = 'open' | 'closed';
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
}

export interface OrderWithCount extends Order {
  customer: { full_name: string; company_name: string } | null;
  proposal_count: number;
}

export const PROCESS_LABELS: Record<ProcessType, string> = {
  cutting: 'Лазерная резка',
  welding: 'Сварка',
  bending: 'Гибка',
  painting: 'Порошковая покраска',
};

export const MATERIAL_LABELS: Record<Material, string> = {
  steel: 'Сталь',
  aluminum: 'Алюминий',
  copper: 'Медь',
};
