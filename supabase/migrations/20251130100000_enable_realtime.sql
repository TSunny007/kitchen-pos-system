-- Enable Realtime on the orders table for live updates in kitchen display
-- This adds the orders table to the supabase_realtime publication

-- First check if the publication exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add orders table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Also add order_items for more granular updates if needed
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
