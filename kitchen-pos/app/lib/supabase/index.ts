// Re-export Supabase client
export { supabase } from "./client";

// Re-export auth functions
export {
  signIn,
  signOut,
  getSession,
  getUser,
  onAuthStateChange,
} from "./auth";
export type { User, Session } from "./auth";

// Re-export campaign functions
export {
  getCampaigns,
  createCampaign,
  updateCampaign,
} from "./campaigns";

// Re-export category functions
export {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./categories";

// Re-export item and modifier functions
export {
  getItems,
  createItem,
  updateItem,
  deactivateItem,
  getModifiers,
  getModifiersForItem,
  createModifier,
  deactivateModifier,
  linkModifierToItem,
  unlinkModifierFromItem,
  // Campaign items
  getItemsForCampaign,
  getCampaignItems,
  linkItemToCampaign,
  unlinkItemFromCampaign,
  bulkLinkItemsToCampaign,
  updateCampaignItemStock,
  subscribeToCampaignItemStock,
} from "./items";

// Re-export order functions
export {
  createOrder,
  getOrderById,
  getRecentOrders,
  getKitchenOrders,
  updateMultipleOrderItemsStatus,
  updateOrderStatusFromItems,
  updateOrderItem,
  deleteOrderItem,
  subscribeToOrders,
  subscribeToKitchenOrders,
} from "./orders";
export type { CreateOrderInput, PaginatedOrdersResult, UpdateOrderItemInput } from "./orders";
