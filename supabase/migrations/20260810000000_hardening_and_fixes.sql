/*
# Исправления и усиление безопасности (запускать ПОСЛЕ трёх предыдущих миграций)

Что чинит:
1. Связи orders.customer_id и proposals.factory_id теперь ссылаются на profiles(id),
   иначе запросы с подгрузкой названий компаний (`profiles!orders_customer_id_fkey`) не работают.
2. profiles: авторизованные пользователи видят названия компаний друг друга
   (раньше каждый видел только себя, поэтому имена заказчиков/заводов были пустыми).
   Роль нельзя сменить после регистрации. Телефон из регистрации теперь сохраняется.
3. messages: добавлена колонка read_at (её использует чат и колокольчик уведомлений)
   и политика, позволяющая получателю помечать сообщения прочитанными.
4. proposals: одно предложение от завода на заказ; завод не может сам «принять» своё КП;
   заказчик не может менять цену/срок; при принятии КП остальные отклоняются, заказ закрывается.
5. Создавать заказы может только заказчик, КП — только завод и только в открытый заказ.
6. Storage: бакет drawings создаётся, лимит 20 МБ, загрузка только в свою папку.

ВНИМАНИЕ: если у одного завода уже есть несколько КП на один заказ, остаётся самое новое.
*/

-- ---------- helper ----------
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_role() FROM public;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;

-- ---------- 1. профили для пользователей, у которых их нет ----------
INSERT INTO public.profiles (id, role, company_name, full_name, phone)
SELECT u.id,
  CASE WHEN u.raw_user_meta_data->>'role' IN ('customer','factory') THEN u.raw_user_meta_data->>'role' ELSE 'customer' END,
  COALESCE(u.raw_user_meta_data->>'company_name', ''),
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  NULLIF(u.raw_user_meta_data->>'phone', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- ---------- 2. внешние ключи на profiles ----------
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_factory_id_fkey;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_factory_id_fkey
  FOREIGN KEY (factory_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ---------- 3. profiles ----------
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "select_profiles_authenticated" ON public.profiles;
CREATE POLICY "select_profiles_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Роль аккаунта нельзя изменить';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_guard_trg ON public.profiles;
CREATE TRIGGER profiles_guard_trg BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role, company_name, full_name, phone)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'role' IN ('customer','factory')
         THEN NEW.raw_user_meta_data->>'role' ELSE 'customer' END,
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------- 4. orders ----------
DROP POLICY IF EXISTS "insert_own_orders" ON public.orders;
CREATE POLICY "insert_own_orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id AND public.my_role() = 'customer');

-- ---------- 5. proposals ----------
DELETE FROM public.proposals a USING public.proposals b
WHERE a.order_id = b.order_id AND a.factory_id = b.factory_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_per_factory_idx
  ON public.proposals (order_id, factory_id);
CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_accepted_idx
  ON public.proposals (order_id) WHERE status = 'accepted';

DROP POLICY IF EXISTS "insert_own_proposals" ON public.proposals;
CREATE POLICY "insert_own_proposals" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = factory_id
    AND public.my_role() = 'factory'
    AND status = 'submitted'
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.status = 'open')
  );

DROP POLICY IF EXISTS "delete_own_proposals" ON public.proposals;
CREATE POLICY "delete_own_proposals" ON public.proposals FOR DELETE TO authenticated
  USING (auth.uid() = factory_id AND status = 'submitted');

CREATE OR REPLACE FUNCTION public.proposals_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.factory_id IS DISTINCT FROM OLD.factory_id THEN
    RAISE EXCEPTION 'Нельзя менять заказ или завод в предложении';
  END IF;
  IF auth.uid() = OLD.factory_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Завод не может менять статус предложения';
    END IF;
    IF OLD.status <> 'submitted' THEN
      RAISE EXCEPTION 'Предложение уже обработано заказчиком';
    END IF;
  ELSE
    IF NEW.price IS DISTINCT FROM OLD.price
       OR NEW.lead_time_days IS DISTINCT FROM OLD.lead_time_days
       OR NEW.comment IS DISTINCT FROM OLD.comment THEN
      RAISE EXCEPTION 'Заказчик может менять только статус предложения';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS proposals_guard_trg ON public.proposals;
CREATE TRIGGER proposals_guard_trg BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_guard();

CREATE OR REPLACE FUNCTION public.proposals_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.proposals SET status = 'rejected'
      WHERE order_id = NEW.order_id AND id <> NEW.id AND status = 'submitted';
    UPDATE public.orders SET status = 'closed' WHERE id = NEW.order_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS proposals_on_accept_trg ON public.proposals;
CREATE TRIGGER proposals_on_accept_trg AFTER UPDATE OF status ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_on_accept();

-- ---------- 6. messages ----------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (order_id, factory_id) WHERE read_at IS NULL;

DROP POLICY IF EXISTS "Recipients can mark messages read" ON public.messages;
CREATE POLICY "Recipients can mark messages read" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND (factory_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = messages.order_id AND o.customer_id = auth.uid()))
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND (factory_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = messages.order_id AND o.customer_id = auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.messages_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
       NEW.content IS DISTINCT FROM OLD.content
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.factory_id IS DISTINCT FROM OLD.factory_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'В сообщении можно изменить только отметку о прочтении';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_guard_trg ON public.messages;
CREATE TRIGGER messages_guard_trg BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_guard();

-- ---------- 7. storage ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('drawings', 'drawings', true, 20971520)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "drawings_auth_upload" ON storage.objects;
CREATE POLICY "drawings_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'drawings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Обновить кэш схемы PostgREST
NOTIFY pgrst, 'reload schema';
