/*
# MetalMarket — B2B metalworking marketplace schema

1. New Tables
- `profiles` — extends auth.users with a role (customer | factory) and display name.
  - `id` (uuid, PK, references auth.users)
  - `role` (text, 'customer' or 'factory')
  - `company_name` (text)
  - `full_name` (text)
  - `phone` (text, nullable)
  - `created_at` (timestamptz)
- `orders` — a customer's request for metalworking services.
  - `id` (uuid, PK)
  - `customer_id` (uuid, references auth.users, defaults to auth.uid())
  - `title` (text)
  - `process_type` (text: cutting | welding | bending | painting)
  - `material` (text: steel | aluminum | copper)
  - `quantity` (integer)
  - `description` (text, nullable)
  - `drawing_url` (text, nullable — Supabase Storage public URL)
  - `drawing_name` (text, nullable — original file name)
  - `status` (text: open | closed, default 'open')
  - `created_at` (timestamptz)
- `proposals` — a factory's commercial offer on an order.
  - `id` (uuid, PK)
  - `order_id` (uuid, references orders, cascade delete)
  - `factory_id` (uuid, references auth.users, defaults to auth.uid())
  - `price` (numeric)
  - `lead_time_days` (integer)
  - `comment` (text, nullable)
  - `status` (text: submitted | accepted | rejected, default 'submitted')
  - `created_at` (timestamptz)

2. Security
- RLS enabled on all three tables.
- profiles: each authenticated user can read/update only their own profile row.
- orders: any authenticated user (customer or factory) can read all orders (marketplace is visible to all signed-in users). Only the order's customer can insert/update/delete their own orders.
- proposals: any authenticated user can read all proposals (so customers see offers, factories see their own and competitors' offers). Only the factory that owns a proposal can insert/update/delete it. A customer who owns the parent order can update a proposal's status (accept/reject).

3. Notes
- `user_id`-style owner columns default to `auth.uid()` so client inserts that omit the owner still satisfy WITH CHECK.
- A trigger auto-creates a profile row when a new auth user signs up (the signup flow writes the role into raw_user_meta_data, and the trigger copies it).
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'factory')),
  company_name text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- orders ----------
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  process_type text NOT NULL CHECK (process_type IN ('cutting', 'welding', 'bending', 'painting')),
  material text NOT NULL CHECK (material IN ('steel', 'aluminum', 'copper')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  description text,
  drawing_url text,
  drawing_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can see all orders (marketplace visibility)
DROP POLICY IF EXISTS "select_all_orders" ON orders;
CREATE POLICY "select_all_orders" ON orders FOR SELECT
  TO authenticated USING (true);

-- Only the owning customer can create / update / delete their orders
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE
  TO authenticated USING (auth.uid() = customer_id);

-- ---------- proposals ----------
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL CHECK (price > 0),
  lead_time_days integer NOT NULL CHECK (lead_time_days > 0),
  comment text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read proposals (customers see offers, factories see competition)
DROP POLICY IF EXISTS "select_all_proposals" ON proposals;
CREATE POLICY "select_all_proposals" ON proposals FOR SELECT
  TO authenticated USING (true);

-- Only the owning factory can insert their proposals
DROP POLICY IF EXISTS "insert_own_proposals" ON proposals;
CREATE POLICY "insert_own_proposals" ON proposals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = factory_id);

-- A factory can update/delete its own proposals; the order's customer can update status (accept/reject)
DROP POLICY IF EXISTS "update_proposals" ON proposals;
CREATE POLICY "update_proposals" ON proposals FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = factory_id
    OR EXISTS (SELECT 1 FROM orders WHERE orders.id = proposals.order_id AND orders.customer_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = factory_id
    OR EXISTS (SELECT 1 FROM orders WHERE orders.id = proposals.order_id AND orders.customer_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_proposals" ON proposals;
CREATE POLICY "delete_own_proposals" ON proposals FOR DELETE
  TO authenticated USING (auth.uid() = factory_id);

-- ---------- auto-create profile on signup ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, company_name, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS proposals_order_idx ON proposals(order_id);
CREATE INDEX IF NOT EXISTS proposals_factory_idx ON proposals(factory_id);