-- Add optional stock tracking to campaign_items
-- NULL = no tracking, 0 = sold out, >0 = units remaining

ALTER TABLE public.campaign_items
  ADD COLUMN stock integer DEFAULT NULL;

ALTER TABLE public.campaign_items
  ADD CONSTRAINT campaign_items_stock_non_negative
  CHECK (stock IS NULL OR stock >= 0);

-- Expose campaign_items to realtime so stock changes propagate across terminals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'campaign_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_items;
  END IF;
END $$;

-- Atomic stock decrement: only decrements if stock is tracked AND sufficient.
-- Returns true if decremented, false if stock is untracked (NULL) or insufficient.
-- The CHECK constraint above is the final safety net against going below zero.
CREATE OR REPLACE FUNCTION decrement_campaign_item_stock(
  p_campaign_id bigint,
  p_item_id bigint,
  p_quantity integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.campaign_items
  SET stock = stock - p_quantity
  WHERE campaign_id = p_campaign_id
    AND item_id = p_item_id
    AND stock IS NOT NULL
    AND stock >= p_quantity;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;
