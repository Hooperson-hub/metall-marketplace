/*
# Кошелёк, тарифы и списание комиссий (запускать после 20260811000000_order_lifecycle.sql)

Тарифы (хранятся в таблице tariffs, меняются обычным UPDATE без правки кода):
- отклик исполнителя: 1 % от цены КП, но не менее 150 ₽ и не более 2000 ₽;
- заявка заказчика: первые 2 бесплатно, начиная с третьей 300 ₽.

Как это работает:
- у каждого пользователя есть кошелёк (wallets) и журнал операций (wallet_transactions);
- комиссия списывается автоматически триггером в тот же момент, когда создаётся заказ или КП;
  если денег не хватает, заказ/КП не создаётся и пользователь видит ошибку INSUFFICIENT_FUNDS;
- если заказчик снял заказ, пока по нему не было ни одного КП, плата за размещение возвращается;
- баланс нельзя изменить с клиента: все операции идут через защищённые функции;
- пополнение: таблица payments + функция apply_succeeded_payment (вызывается только с сервера);
- для тестов баланс можно пополнить вручную: select admin_credit('<uuid пользователя>', 1000, 'Тест');
*/

-- ---------- тарифы ----------
CREATE TABLE IF NOT EXISTS public.tariffs (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  response_percent numeric NOT NULL DEFAULT 1,
  response_min_rub numeric NOT NULL DEFAULT 150,
  response_max_rub numeric NOT NULL DEFAULT 2000,
  free_orders_per_customer int NOT NULL DEFAULT 2,
  order_fee_rub numeric NOT NULL DEFAULT 300,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.tariffs (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tariffs_read_all" ON public.tariffs;
CREATE POLICY "tariffs_read_all" ON public.tariffs FOR SELECT TO anon, authenticated USING (true);

-- ---------- кошельки ----------
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_select_own" ON public.wallets;
CREATE POLICY "wallet_select_own" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.wallets (user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;

-- ---------- платежи (пополнения через платёжный сервис) ----------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'canceled')),
  provider_payment_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------- журнал операций ----------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('topup', 'order_fee', 'response_fee', 'refund', 'bonus')),
  amount numeric(12,2) NOT NULL,           -- плюс = зачисление, минус = списание
  description text NOT NULL DEFAULT '',
  order_id uuid,
  proposal_id uuid,
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON public.wallet_transactions (user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_tx_select_own" ON public.wallet_transactions;
CREATE POLICY "wallet_tx_select_own" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Запрещаем любые прямые изменения таблиц с клиента
REVOKE INSERT, UPDATE, DELETE ON public.wallets, public.wallet_transactions, public.payments, public.tariffs FROM anon, authenticated;

-- Поля для истории комиссий
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fee_rub numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS fee_rub numeric(12,2) NOT NULL DEFAULT 0;

-- ---------- расчёт комиссии за отклик ----------
CREATE OR REPLACE FUNCTION public.calc_response_fee(p_price numeric)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT LEAST(t.response_max_rub, GREATEST(t.response_min_rub, CEIL(p_price * t.response_percent / 100)))
  FROM public.tariffs t WHERE t.id = 1
$$;

-- ---------- списание ----------
CREATE OR REPLACE FUNCTION public.wallet_debit(
  p_user uuid, p_amount numeric, p_kind text, p_description text,
  p_order uuid DEFAULT NULL, p_proposal uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO wallets (user_id) VALUES (p_user) ON CONFLICT DO NOTHING;
  UPDATE wallets SET balance = balance - p_amount, updated_at = now()
    WHERE user_id = p_user AND balance >= p_amount;
  IF NOT FOUND THEN
    SELECT balance INTO bal FROM wallets WHERE user_id = p_user;
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS: нужно % ₽, на балансе % ₽', p_amount, COALESCE(bal, 0);
  END IF;
  INSERT INTO wallet_transactions (user_id, kind, amount, description, order_id, proposal_id)
  VALUES (p_user, p_kind, -p_amount, p_description, p_order, p_proposal);
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user uuid, p_amount numeric, p_kind text, p_description text,
  p_order uuid DEFAULT NULL, p_payment uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO wallets (user_id) VALUES (p_user) ON CONFLICT DO NOTHING;
  UPDATE wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = p_user;
  INSERT INTO wallet_transactions (user_id, kind, amount, description, order_id, payment_id)
  VALUES (p_user, p_kind, p_amount, p_description, p_order, p_payment);
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_debit(uuid, numeric, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_credit(uuid, numeric, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------- триггер: плата за размещение заказа ----------
CREATE OR REPLACE FUNCTION public.orders_charge_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tariffs%ROWTYPE; cnt int;
BEGIN
  SELECT * INTO t FROM tariffs WHERE id = 1;
  SELECT count(*) INTO cnt FROM orders WHERE customer_id = NEW.customer_id;
  IF cnt >= t.free_orders_per_customer THEN
    PERFORM wallet_debit(NEW.customer_id, t.order_fee_rub, 'order_fee',
                         'Размещение заказа «' || NEW.title || '»', NEW.id, NULL);
    NEW.fee_rub := t.order_fee_rub;
  ELSE
    NEW.fee_rub := 0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_charge_trg ON public.orders;
CREATE TRIGGER orders_charge_trg BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_charge_fn();

-- ---------- триггер: комиссия за отклик ----------
CREATE OR REPLACE FUNCTION public.proposals_charge_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fee numeric; ttl text;
BEGIN
  SELECT title INTO ttl FROM orders WHERE id = NEW.order_id;
  fee := calc_response_fee(NEW.price);
  PERFORM wallet_debit(NEW.factory_id, fee, 'response_fee',
                       'Отклик на заказ «' || COALESCE(ttl, '') || '»', NEW.order_id, NEW.id);
  NEW.fee_rub := fee;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS proposals_charge_trg ON public.proposals;
CREATE TRIGGER proposals_charge_trg BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_charge_fn();

-- ---------- возврат платы за размещение, если заказ снят без единого КП ----------
CREATE OR REPLACE FUNCTION public.orders_refund_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'closed' AND OLD.fee_rub > 0
     AND NOT EXISTS (SELECT 1 FROM proposals WHERE order_id = NEW.id) THEN
    PERFORM wallet_credit(NEW.customer_id, OLD.fee_rub, 'refund',
                          'Возврат платы за размещение заказа «' || NEW.title || '»', NEW.id, NULL);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS orders_refund_trg ON public.orders;
CREATE TRIGGER orders_refund_trg AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_refund_fn();

-- Клиент не может менять размер списанной комиссии (иначе можно «нарисовать» возврат)
CREATE OR REPLACE FUNCTION public.orders_fee_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.fee_rub IS DISTINCT FROM OLD.fee_rub THEN
    RAISE EXCEPTION 'Нельзя изменять размер комиссии';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_fee_guard_trg ON public.orders;
CREATE TRIGGER orders_fee_guard_trg BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_fee_guard();

-- ---------- пополнение ----------
CREATE OR REPLACE FUNCTION public.apply_succeeded_payment(p_provider_payment_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO p FROM payments WHERE provider_payment_id = p_provider_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Платёж не найден'; END IF;
  IF p.status = 'succeeded' THEN RETURN; END IF;
  UPDATE payments SET status = 'succeeded', paid_at = now() WHERE id = p.id;
  PERFORM wallet_credit(p.user_id, p.amount, 'topup', 'Пополнение баланса', NULL, p.id);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_succeeded_payment(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_succeeded_payment(text) TO service_role;

-- ---------- ручное зачисление (для тестов и акций), только из SQL Editor ----------
CREATE OR REPLACE FUNCTION public.admin_credit(p_user uuid, p_amount numeric, p_description text DEFAULT 'Зачисление администратором')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM wallet_credit(p_user, p_amount, 'bonus', p_description, NULL, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_credit(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
