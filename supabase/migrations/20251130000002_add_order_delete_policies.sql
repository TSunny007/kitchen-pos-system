-- Add DELETE policy for order_items that was missing

CREATE POLICY "Authenticated users can delete order_items"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (true);

-- Also add DELETE policy for order_item_modifiers to be safe
CREATE POLICY "Authenticated users can delete order_item_modifiers"
  ON public.order_item_modifiers FOR DELETE
  TO authenticated
  USING (true);

-- Add DELETE policy for orders (in case an order needs to be cancelled/removed)
CREATE POLICY "Authenticated users can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (true);
