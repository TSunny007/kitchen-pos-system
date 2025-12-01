-- Add 'picked_up' status to order_items
-- This allows tracking when individual items are picked up by customers

-- First drop the existing constraint
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_status_check;

-- Add new constraint with 'picked_up' status
ALTER TABLE public.order_items ADD CONSTRAINT order_items_status_check
  CHECK (status IN ('new', 'in_progress', 'done', 'picked_up', 'cancelled'));
