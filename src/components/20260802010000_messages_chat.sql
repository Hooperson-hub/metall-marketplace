/*
# Private per-order chat between customer and factory

One conversation thread per (order_id, factory_id) pair — matches the
existing proposal relationship, so a chat only exists once a factory has
submitted a proposal for that order. sender_id is a profile id (not
constrained to be the customer or factory in the pair) so an AI-agent
profile could post into the same thread later without a schema change.
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages (order_id, factory_id, created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- A message thread only exists for an order+factory pair that has an actual
-- proposal — this stops anyone from inventing a conversation with an
-- arbitrary factory_id on someone else's order.
CREATE OR REPLACE FUNCTION is_valid_message_thread(p_order_id uuid, p_factory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM proposals p
    WHERE p.order_id = p_order_id AND p.factory_id = p_factory_id
  );
$$;

CREATE POLICY "Participants can view thread messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    is_valid_message_thread(order_id, factory_id)
    AND (
      factory_id = auth.uid()
      OR EXISTS (SELECT 1 FROM orders o WHERE o.id = messages.order_id AND o.customer_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send thread messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_valid_message_thread(order_id, factory_id)
    AND (
      factory_id = auth.uid()
      OR EXISTS (SELECT 1 FROM orders o WHERE o.id = messages.order_id AND o.customer_id = auth.uid())
    )
  );

-- Live updates in the chat UI
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
