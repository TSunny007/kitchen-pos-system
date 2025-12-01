-- Add DELETE policies that were missing from the initial RLS setup

-- Categories: allow authenticated users to delete
CREATE POLICY "Authenticated users can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (true);

-- Items: allow authenticated users to delete (though we prefer soft delete via is_active)
CREATE POLICY "Authenticated users can delete items"
  ON public.items FOR DELETE
  TO authenticated
  USING (true);

-- Modifiers: allow authenticated users to delete
CREATE POLICY "Authenticated users can delete modifiers"
  ON public.modifiers FOR DELETE
  TO authenticated
  USING (true);

-- Campaigns: allow authenticated users to delete
CREATE POLICY "Authenticated users can delete campaigns"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (true);
