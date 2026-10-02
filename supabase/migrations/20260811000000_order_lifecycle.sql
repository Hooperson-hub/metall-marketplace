/*
# Жизненный цикл заказа (запускать после 20260810000000_hardening_and_fixes.sql)

Статусы заказа:
- open         — приём предложений
- in_progress  — заказчик выбрал исполнителя (принял КП); новые КП принимать нельзя
- completed    — заказчик отметил заказ выполненным
- closed       — заказ снят заказчиком без выбора исполнителя

Что меняется:
1. Принятие КП переводит заказ в in_progress (а не в closed), остальные КП отклоняются.
2. Принять КП можно только в открытом заказе.
3. Статус заказа заказчик меняет только по разрешённым переходам:
   open -> closed, open -> in_progress (только при наличии принятого КП), in_progress -> completed.
4. Исправляет старые данные: заказы с уже принятым КП переводятся в in_progress.
*/

-- 1. Разрешённые значения статуса
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('open', 'in_progress', 'completed', 'closed'));

-- 2. Принятие КП -> заказ «исполнитель выбран»
CREATE OR REPLACE FUNCTION public.proposals_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.proposals SET status = 'rejected'
      WHERE order_id = NEW.order_id AND id <> NEW.id AND status = 'submitted';
    UPDATE public.orders SET status = 'in_progress'
      WHERE id = NEW.order_id AND status = 'open';
  END IF;
  RETURN NULL;
END;
$$;

-- 3. Принять КП можно только в открытом заказе
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
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status <> 'submitted' THEN
        RAISE EXCEPTION 'Предложение уже обработано';
      END IF;
      IF NEW.status = 'accepted' AND
         (SELECT status FROM public.orders WHERE id = NEW.order_id) <> 'open' THEN
        RAISE EXCEPTION 'Исполнитель по этому заказу уже выбран или заказ закрыт';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Контроль переходов статуса заказа
CREATE OR REPLACE FUNCTION public.orders_status_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    RETURN NEW;
  ELSIF OLD.status = 'open' AND NEW.status = 'in_progress' THEN
    IF EXISTS (SELECT 1 FROM public.proposals WHERE order_id = NEW.id AND status = 'accepted') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Сначала нужно принять одно из предложений';
  ELSIF OLD.status = 'in_progress' AND NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Недопустимое изменение статуса заказа: % -> %', OLD.status, NEW.status;
END;
$$;
DROP TRIGGER IF EXISTS orders_status_guard_trg ON public.orders;
CREATE TRIGGER orders_status_guard_trg BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_status_guard();

-- 5. Исправление уже существующих данных
UPDATE public.proposals p SET status = 'rejected'
WHERE p.status = 'submitted'
  AND EXISTS (SELECT 1 FROM public.proposals a WHERE a.order_id = p.order_id AND a.status = 'accepted');

UPDATE public.orders o SET status = 'in_progress'
WHERE o.status IN ('open', 'closed')
  AND EXISTS (SELECT 1 FROM public.proposals p WHERE p.order_id = o.id AND p.status = 'accepted');

NOTIFY pgrst, 'reload schema';
