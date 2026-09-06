-- Add requires_label flag to categories table
-- Categories with this flag set to true cause a Cup Label print job to be
-- queued whenever one of their items' OrderItems moves from 'new' to
-- 'in_progress' on the Kitchen Display.

ALTER TABLE public.categories
ADD COLUMN requires_label boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.categories.requires_label IS
  'When true, moving an order item in this category to in_progress queues a Cup Label print job';
