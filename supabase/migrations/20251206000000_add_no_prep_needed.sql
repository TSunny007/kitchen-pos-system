-- Add no_prep_needed flag to items table
-- Items with this flag set to true will be created with status 'done' (ready)
-- immediately when ordered, skipping kitchen preparation

ALTER TABLE public.items 
ADD COLUMN no_prep_needed boolean NOT NULL DEFAULT false;

-- Add a comment to explain the column's purpose
COMMENT ON COLUMN public.items.no_prep_needed IS 
  'When true, order items for this item are created with status done (ready) instead of new';
