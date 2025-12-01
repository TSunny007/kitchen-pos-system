// Re-export Supabase client
export { supabase } from "./client";
export { createServerClient } from "./server";

// Re-export auth functions
export {
  signIn,
  signUp,
  signOut,
  getSession,
  getUser,
  onAuthStateChange,
} from "./auth";
export type { User, Session } from "./auth";

// Re-export campaign functions
export {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deactivateCampaign,
} from "./campaigns";

// Re-export category functions
export {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./categories";

// Re-export item and modifier functions
export {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deactivateItem,
  getModifiers,
  getModifiersForItem,
  createModifier,
  updateModifier,
  deactivateModifier,
  linkModifierToItem,
  unlinkModifierFromItem,
} from "./items";

// Re-export order functions
export {
  createOrder,
  getOrders,
  getOrderById,
  getReadyOrders,
  getRecentOrders,
  getKitchenOrders,
  updateOrderStatus,
  updateOrderItemStatus,
  updateMultipleOrderItemsStatus,
  updateOrderStatusFromItems,
  updateOrderItem,
  deleteOrderItem,
  markOrderPickedUp,
  subscribeToReadyOrders,
  subscribeToOrders,
  subscribeToKitchenOrders,
} from "./orders";
export type { CreateOrderInput, PaginatedOrdersResult, UpdateOrderItemInput } from "./orders";
