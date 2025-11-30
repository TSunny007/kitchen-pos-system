-- Enable Row Level Security on all tables
-- This migration should be run AFTER the initial schema migration

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_status_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Campaigns: authenticated users can read, staff can manage
-- ============================================

CREATE POLICY "Authenticated users can read campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Categories: authenticated users can read, insert, update
-- ============================================

CREATE POLICY "Authenticated users can read categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Items: authenticated users can read, insert, update
-- ============================================

CREATE POLICY "Authenticated users can read items"
  ON public.items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert items"
  ON public.items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update items"
  ON public.items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Modifiers: authenticated users can read, insert, update
-- ============================================

CREATE POLICY "Authenticated users can read modifiers"
  ON public.modifiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert modifiers"
  ON public.modifiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update modifiers"
  ON public.modifiers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Item_Modifiers: authenticated users can manage
-- ============================================

CREATE POLICY "Authenticated users can read item_modifiers"
  ON public.item_modifiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert item_modifiers"
  ON public.item_modifiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete item_modifiers"
  ON public.item_modifiers FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- Orders: authenticated users can manage all orders
-- ============================================

CREATE POLICY "Authenticated users can read orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Order_Items: authenticated users can manage
-- ============================================

CREATE POLICY "Authenticated users can read order_items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order_items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order_items"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Order_Item_Modifiers: authenticated users can manage
-- ============================================

CREATE POLICY "Authenticated users can read order_item_modifiers"
  ON public.order_item_modifiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order_item_modifiers"
  ON public.order_item_modifiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Order_Item_Status_Events: authenticated users can read and insert
-- ============================================

CREATE POLICY "Authenticated users can read order_item_status_events"
  ON public.order_item_status_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order_item_status_events"
  ON public.order_item_status_events FOR INSERT
  TO authenticated
  WITH CHECK (true);
