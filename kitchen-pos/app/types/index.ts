// Types based on the database schema

export interface Campaign {
  id: number;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  display_order: number;
  requires_label: boolean;
  created_at: string;
}

export interface Item {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  is_active: boolean;
  no_prep_needed: boolean; // When true, items are created as 'done' (ready) immediately
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category;
  stock?: number | null; // Set when fetched via campaign_items; null = no tracking, 0 = sold out
}

export interface Modifier {
  id: number;
  name: string;
  description: string | null;
  price_delta: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemModifier {
  id: number;
  item_id: number;
  modifier_id: number;
  created_at: string;
  modifier?: Modifier;
}

export type OrderStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';
export type OrderItemStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export interface Order {
  id: number;
  campaign_id: number | null;
  customer_name: string;
  status: OrderStatus;
  subtotal: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  quantity: number;
  status: OrderItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  item?: Item;
  modifiers?: OrderItemModifier[];
}

export interface OrderItemModifier {
  id: number;
  order_item_id: number;
  modifier_id: number | null;
  label: string;
  price_delta: number;
  created_at: string;
}

export type PrintJobStatus = 'pending' | 'handed_off' | 'cancelled';

export interface PrintJob {
  id: number;
  order_item_id: number;
  status: PrintJobStatus;
  created_at: string;
  handed_off_at: string | null;
}

export interface CampaignItem {
  id: number;
  campaign_id: number;
  item_id: number;
  created_at: string;
  // Joined fields
  item?: Item;
  campaign?: Campaign;
}

// Cart types for the terminal UI
export interface CartItem {
  id: string; // Temporary client-side ID
  item: Item;
  quantity: number;
  modifiers: Modifier[];
  notes: string;
}

export interface Cart {
  items: CartItem[];
  customerName: string;
}
