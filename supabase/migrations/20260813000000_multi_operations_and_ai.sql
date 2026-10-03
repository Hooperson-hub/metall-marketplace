/*
# Несколько операций в заказе, ТЗ и журнал запросов к ИИ (запускать после 20260812000000_wallet_and_tariffs.sql)

1. orders.process_types — список операций (резка, гибка, сварка, покраска, монтаж, мехобработка).
   Старое поле process_type остаётся (= первая операция) для совместимости.
2. orders.spec — текст технического задания (его можно составить с помощью ИИ и отредактировать).
3. ai_requests — журнал обращений к ИИ-помощнику (лимит запросов на пользователя в сутки считает серверная функция).
*/

-- ---------- операции ----------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%process_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS process_types text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS spec text;

UPDATE public.orders SET process_types = ARRAY[process_type] WHERE cardinality(process_types) = 0;

ALTER TABLE public.orders ADD CONSTRAINT orders_process_type_check
  CHECK (process_type IN ('cutting', 'bending', 'welding', 'painting', 'installation', 'machining'));
ALTER TABLE public.orders ADD CONSTRAINT orders_process_types_check
  CHECK (
    cardinality(process_types) BETWEEN 1 AND 6
    AND process_types <@ ARRAY['cutting', 'bending', 'welding', 'painting', 'installation', 'machining']::text[]
  );

CREATE OR REPLACE FUNCTION public.orders_sync_processes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.process_types IS NULL OR cardinality(NEW.process_types) = 0 THEN
    NEW.process_types := ARRAY[NEW.process_type];
  END IF;
  NEW.process_type := NEW.process_types[1];
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_sync_processes_trg ON public.orders;
CREATE TRIGGER orders_sync_processes_trg BEFORE INSERT OR UPDATE OF process_type, process_types ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_sync_processes();

CREATE INDEX IF NOT EXISTS orders_process_types_idx ON public.orders USING gin (process_types);

-- ---------- журнал запросов к ИИ ----------
CREATE TABLE IF NOT EXISTS public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT '',
  ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_requests_user_idx ON public.ai_requests (user_id, created_at DESC);
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_requests FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
