"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Campaign, Category, Item, CartItem, Modifier, Order, OrderItem, OrderStatus, OrderItemStatus } from "../types";
import CampaignSelector from "../components/terminal/CampaignSelector";
import CategoryTabs from "../components/terminal/CategoryTabs";
import ItemGrid from "../components/terminal/ItemGrid";
import CartSidebar from "../components/terminal/CartSidebar";
import ItemDetailModal from "../components/terminal/ItemDetailModal";
import OrderItemEditModal from "../components/terminal/OrderItemEditModal";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../providers/AuthProvider";
import {
  getCampaigns,
  getCategories,
  getItems,
  getModifiersForItem,
  getModifiers,
  createOrder,
  getReadyOrders,
  getRecentOrders,
  subscribeToReadyOrders,
  subscribeToOrders,
  updateOrderStatus,
  updateOrderItemStatus,
  updateOrderItem,
  deleteOrderItem,
  getOrderById,
  createCampaign,
  updateCampaign,
  createCategory,
  deleteCategory,
  createItem,
  deactivateItem,
  createModifier,
  linkModifierToItem,
  unlinkModifierFromItem,
  deactivateModifier,
} from "../lib/supabase";
import AddItemModal from "../components/terminal/AddItemModal";

export default function TerminalPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Data from Supabase
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [itemModifiers, setItemModifiers] = useState<Modifier[]>([]);

  // Ready orders for pickup announcements
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [lastOrderConfirmation, setLastOrderConfirmation] = useState<{
    id: number;
    customerName: string;
  } | null>(null);

  // Recent orders state (for sidebar view)
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);

  // Order item edit modal state
  const [editingOrderItem, setEditingOrderItem] = useState<OrderItem | null>(null);
  const [editingOrderItemModifiers, setEditingOrderItemModifiers] = useState<Modifier[]>([]);
  const [isOrderItemEditModalOpen, setIsOrderItemEditModalOpen] = useState(false);

  // Add Item modal state
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  // All available modifiers (for linking to items)
  const [allModifiers, setAllModifiers] = useState<Modifier[]>([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  // Load campaigns only on initial mount
  useEffect(() => {
    if (!user) return;

    async function loadCampaigns() {
      try {
        setIsLoading(true);
        setError(null);
        const campaignsData = await getCampaigns();
        setCampaigns(campaignsData);

        // Select first campaign by default if none selected
        if (campaignsData.length > 0 && !selectedCampaign) {
          setSelectedCampaign(campaignsData[0]);
        }
      } catch (err) {
        console.error("Error loading campaigns:", err);
        setError("Failed to load campaigns. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCampaigns();
  }, [user]);

  // Load categories and items when a campaign is selected
  useEffect(() => {
    if (!user || !selectedCampaign) return;

    async function loadMenuData() {
      try {
        const [categoriesData, itemsData, modifiersData] = await Promise.all([
          getCategories(),
          getItems(),
          getModifiers(),
        ]);

        setCategories(categoriesData);
        setItems(itemsData);
        setAllModifiers(modifiersData);
      } catch (err) {
        console.error("Error loading menu data:", err);
        setError("Failed to load menu. Please try again.");
      }
    }

    loadMenuData();
  }, [user, selectedCampaign]);

  // Load ready orders when campaign changes
  useEffect(() => {
    if (!selectedCampaign || !user) return;

    async function loadReadyOrders() {
      try {
        const orders = await getReadyOrders(selectedCampaign!.id);
        setReadyOrders(orders);
      } catch (err) {
        console.error("Error loading ready orders:", err);
      }
    }

    loadReadyOrders();

    // Subscribe to real-time updates for ready orders
    const unsubscribe = subscribeToReadyOrders(selectedCampaign.id, (order) => {
      setReadyOrders((prev) => {
        // Add to list if not already present
        if (!prev.find((o) => o.id === order.id)) {
          return [...prev, order];
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCampaign]);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter((item) => item.category_id === selectedCategory.id);
  }, [selectedCategory, items]);

  // Compute item count per category for delete button visibility
  const itemCountByCategory = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.category_id] = (acc[item.category_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  }, [items]);

  // Load modifiers when an item is selected
  const handleItemClick = useCallback(async (item: Item) => {
    setSelectedItem(item);
    setIsModalOpen(true);

    // Fetch modifiers for this item from the database
    try {
      const modifiers = await getModifiersForItem(item.id);
      setItemModifiers(modifiers);
    } catch (err) {
      console.error("Error loading modifiers:", err);
      setItemModifiers([]);
    }
  }, []);

  const handleAddToCart = (item: Item, quantity: number, modifiers: Modifier[], notes: string) => {
    const newCartItem: CartItem = {
      id: `${item.id}-${Date.now()}`,
      item,
      quantity,
      modifiers,
      notes,
    };
    setCartItems((prev) => [...prev, newCartItem]);
    setIsModalOpen(false);
    setSelectedItem(null);
    setItemModifiers([]);
  };

  const handleUpdateCartItem = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(cartItemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveFromCart = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCustomerName("");
  };

  const calculateTotal = (): number => {
    return cartItems.reduce((total, cartItem) => {
      const itemTotal = cartItem.item.base_price * cartItem.quantity;
      const modifiersTotal = cartItem.modifiers.reduce(
        (sum, mod) => sum + mod.price_delta * cartItem.quantity,
        0
      );
      return total + itemTotal + modifiersTotal;
    }, 0);
  };

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      alert("Please enter a customer name");
      return;
    }
    if (cartItems.length === 0) {
      alert("Cart is empty");
      return;
    }

    try {
      const order = await createOrder({
        campaign_id: selectedCampaign?.id ?? null,
        customer_name: customerName.trim(),
        items: cartItems,
      });

      // Show confirmation
      setLastOrderConfirmation({
        id: order.id,
        customerName: order.customer_name,
      });

      // Clear cart after successful order
      handleClearCart();

      // Auto-dismiss confirmation after 5 seconds
      setTimeout(() => {
        setLastOrderConfirmation(null);
      }, 5000);
    } catch (err) {
      console.error("Error placing order:", err);
      alert("Failed to place order. Please try again.");
    }
  };

  // Dismiss a ready order (mark as called out)
  const handleDismissReadyOrder = (orderId: number) => {
    setReadyOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  // Recent orders handlers
  const loadRecentOrders = useCallback(async (reset = false) => {
    if (!selectedCampaign) return;
    
    setIsLoadingOrders(true);
    try {
      const page = reset ? 1 : ordersPage;
      const result = await getRecentOrders(selectedCampaign.id, {
        page,
        pageSize: 10,
      });
      
      if (reset) {
        setRecentOrders(result.orders);
        setOrdersPage(1);
      } else {
        setRecentOrders((prev) => [...prev, ...result.orders]);
      }
      setHasMoreOrders(result.hasMore);
    } catch (err) {
      console.error("Error loading recent orders:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [selectedCampaign, ordersPage]);

  const handleLoadMoreOrders = useCallback(() => {
    if (!isLoadingOrders && hasMoreOrders) {
      setOrdersPage((prev) => prev + 1);
    }
  }, [isLoadingOrders, hasMoreOrders]);

  const handleRefreshOrders = useCallback(() => {
    loadRecentOrders(true);
  }, [loadRecentOrders]);

  const handleOrderStatusChange = useCallback(async (orderId: number, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      // Update local state
      setRecentOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  }, []);

  // Handle individual item status change (for marking items as picked up)
  const handleItemStatusChange = useCallback(async (orderItemId: number, newStatus: OrderItemStatus) => {
    try {
      // Optimistic update
      setRecentOrders((prev) =>
        prev.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item) =>
            item.id === orderItemId ? { ...item, status: newStatus } : item
          ),
        }))
      );

      // Persist to database (this will also update order status automatically)
      await updateOrderItemStatus(orderItemId, newStatus);
      
      // Refresh to get updated order status
      const orderWithItem = recentOrders.find((o) =>
        o.order_items?.some((item) => item.id === orderItemId)
      );
      if (orderWithItem) {
        const updatedOrder = await getOrderById(orderWithItem.id);
        if (updatedOrder) {
          setRecentOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          );
        }
      }
    } catch (err) {
      console.error("Error updating item status:", err);
      // Refresh orders to get correct state
      loadRecentOrders(true);
    }
  }, [recentOrders, loadRecentOrders]);

  // Handle editing an order item
  const handleEditOrderItem = useCallback(async (orderItem: OrderItem) => {
    setEditingOrderItem(orderItem);
    setIsOrderItemEditModalOpen(true);
    
    // Load modifiers available for this item
    if (orderItem.item_id) {
      try {
        const modifiers = await getModifiersForItem(orderItem.item_id);
        setEditingOrderItemModifiers(modifiers);
      } catch (err) {
        console.error("Error loading modifiers for order item:", err);
        setEditingOrderItemModifiers([]);
      }
    }
  }, []);

  // Handle saving order item edits
  const handleSaveOrderItem = useCallback(async (
    orderItemId: number,
    updates: { quantity: number; notes: string | null; modifierIds: number[] }
  ) => {
    try {
      await updateOrderItem(orderItemId, updates);
      
      // Refresh the order that contains this item
      if (editingOrderItem) {
        const updatedOrder = await getOrderById(editingOrderItem.order_id);
        if (updatedOrder) {
          setRecentOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          );
        }
      }
    } catch (err) {
      console.error("Error saving order item:", err);
      throw err;
    }
  }, [editingOrderItem]);

  // Handle deleting an order item
  const handleDeleteOrderItem = useCallback(async (orderItemId: number) => {
    try {
      // Find which order this item belongs to
      const orderWithItem = recentOrders.find((o) =>
        o.order_items?.some((item) => item.id === orderItemId)
      );
      
      await deleteOrderItem(orderItemId);
      
      // Refresh the affected order
      if (orderWithItem) {
        const updatedOrder = await getOrderById(orderWithItem.id);
        if (updatedOrder) {
          setRecentOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          );
        } else {
          // Order was deleted (no items left)
          setRecentOrders((prev) => prev.filter((o) => o.id !== orderWithItem.id));
        }
      }
    } catch (err) {
      console.error("Error deleting order item:", err);
    }
  }, [recentOrders]);

  // Load recent orders when campaign changes
  useEffect(() => {
    if (selectedCampaign) {
      loadRecentOrders(true);
    }
  }, [selectedCampaign]);

  // Load more orders when page changes
  useEffect(() => {
    if (ordersPage > 1) {
      loadRecentOrders(false);
    }
  }, [ordersPage]);

  // Subscribe to order updates for real-time updates
  useEffect(() => {
    if (!selectedCampaign) return;

    const unsubscribe = subscribeToOrders(selectedCampaign.id, (eventType, order) => {
      if (eventType === "INSERT") {
        // Add new order to the top
        setRecentOrders((prev) => [order, ...prev]);
      } else if (eventType === "UPDATE") {
        // Update existing order
        setRecentOrders((prev) =>
          prev.map((o) => (o.id === order.id ? order : o))
        );
      } else if (eventType === "DELETE") {
        // Remove deleted order
        setRecentOrders((prev) => prev.filter((o) => o.id !== order.id));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCampaign]);

  // Campaign management handlers
  const handleCreateCampaign = async (name: string) => {
    try {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const newCampaign = await createCampaign({
        name,
        starts_at: now.toISOString(),
        ends_at: endOfDay.toISOString(),
        is_active: true,
      });

      setCampaigns((prev) => [newCampaign, ...prev]);
      setSelectedCampaign(newCampaign);
      return newCampaign;
    } catch (err) {
      console.error("Error creating campaign:", err);
      throw err;
    }
  };

  const handleToggleCampaignActive = async (campaignId: number, isActive: boolean) => {
    try {
      const updated = await updateCampaign(campaignId, { is_active: isActive });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? updated : c))
      );

      // If deactivating current campaign, clear selection
      if (!isActive && selectedCampaign?.id === campaignId) {
        const nextActive = campaigns.find((c) => c.id !== campaignId && c.is_active);
        setSelectedCampaign(nextActive || null);
      }
    } catch (err) {
      console.error("Error updating campaign:", err);
      throw err;
    }
  };

  // Item creation handler
  const handleCreateItem = async (itemData: {
    name: string;
    description: string;
    base_price: number;
    category_id: number;
    image_url?: string | null;
    no_prep_needed?: boolean;
  }) => {
    try {
      const newItem = await createItem({
        ...itemData,
        image_url: itemData.image_url ?? null,
        is_active: true,
        no_prep_needed: itemData.no_prep_needed ?? false,
      });
      setItems((prev) => [...prev, newItem]);
      return newItem;
    } catch (err) {
      console.error("Error creating item:", err);
      throw err;
    }
  };

  // Modifier management handlers
  const handleCreateModifier = async (modifierData: { name: string; price_delta: number }): Promise<Modifier | null> => {
    try {
      const newModifier = await createModifier({
        ...modifierData,
        description: null,
        is_active: true,
      });
      setAllModifiers((prev) => [...prev, newModifier]);
      return newModifier;
    } catch (err) {
      console.error("Error creating modifier:", err);
      return null;
    }
  };

  const handleLinkModifier = async (itemId: number, modifierId: number): Promise<boolean> => {
    try {
      await linkModifierToItem(itemId, modifierId);
      // Refresh the item modifiers if this is the currently selected item
      if (selectedItem?.id === itemId) {
        const modifiers = await getModifiersForItem(itemId);
        setItemModifiers(modifiers);
      }
      return true;
    } catch (err) {
      console.error("Error linking modifier:", err);
      return false;
    }
  };

  const handleUnlinkModifier = async (itemId: number, modifierId: number): Promise<boolean> => {
    try {
      await unlinkModifierFromItem(itemId, modifierId);
      // Refresh the item modifiers if this is the currently selected item
      if (selectedItem?.id === itemId) {
        const modifiers = await getModifiersForItem(itemId);
        setItemModifiers(modifiers);
      }
      return true;
    } catch (err) {
      console.error("Error unlinking modifier:", err);
      return false;
    }
  };

  // Category creation handler
  const handleCreateCategory = async (name: string): Promise<Category | null> => {
    try {
      // Generate a slug from the name
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      // Get the next display order
      const maxOrder = categories.reduce((max, c) => Math.max(max, c.display_order), 0);
      
      const newCategory = await createCategory({
        name,
        slug,
        display_order: maxOrder + 1,
      });
      setCategories((prev) => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      console.error("Error creating category:", err);
      return null;
    }
  };

  // Category deletion handler
  const handleDeleteCategory = async (categoryId: number): Promise<boolean> => {
    try {
      await deleteCategory(categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      // If this was the selected category, clear selection
      if (selectedCategory?.id === categoryId) {
        setSelectedCategory(null);
      }
      return true;
    } catch (err) {
      console.error("Error deleting category:", err);
      throw err; // Re-throw so the CategoryPicker can show an error
    }
  };

  // Item deletion handler
  const handleDeleteItem = async (itemId: number): Promise<boolean> => {
    try {
      await deactivateItem(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      return true;
    } catch (err) {
      console.error("Error deleting item:", err);
      return false;
    }
  };

  // Modifier deletion handler
  const handleDeleteModifier = async (modifierId: number): Promise<boolean> => {
    try {
      await deactivateModifier(modifierId);
      // Remove from allModifiers list
      setAllModifiers((prev) => prev.filter((m) => m.id !== modifierId));
      // Remove from item modifiers if present
      setItemModifiers((prev) => prev.filter((m) => m.id !== modifierId));
      return true;
    } catch (err) {
      console.error("Error deleting modifier:", err);
      return false;
    }
  };

  // Auth loading or data loading state
  if (authLoading || isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-on-surface-variant">Loading terminal...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-6 py-2 text-on-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Order Confirmation Toast */}
      {lastOrderConfirmation && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transform">
          <div className="rounded-lg bg-primary px-6 py-3 text-on-primary shadow-lg">
            <p className="font-medium">
              Order #{lastOrderConfirmation.id} for {lastOrderConfirmation.customerName} submitted!
            </p>
          </div>
        </div>
      )}

      {/* Ready Orders Banner */}
      {readyOrders.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-tertiary-container px-4 py-2 lg:left-auto lg:right-[400px]">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="font-medium text-on-tertiary-container shrink-0">Ready:</span>
            {readyOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => handleDismissReadyOrder(order.id)}
                className="shrink-0 rounded-full bg-tertiary px-3 py-1 text-sm text-on-tertiary hover:opacity-80"
                title="Click to dismiss"
              >
                {order.customer_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar with Campaign Selector */}
        <header className={`flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-3 py-3 sm:px-6 sm:py-4 ${readyOrders.length > 0 ? 'mt-10' : ''}`}>
          <h1 className="text-lg font-medium text-on-surface sm:text-2xl">{process.env.NEXT_PUBLIC_ORG_NAME} Terminal</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <CampaignSelector
              campaigns={campaigns}
              selectedCampaign={selectedCampaign}
              onSelectCampaign={setSelectedCampaign}
              onCreateCampaign={handleCreateCampaign}
              onToggleCampaignActive={handleToggleCampaignActive}
            />
          </div>
        </header>

        {/* Category Tabs */}
        <CategoryTabs
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onDeleteCategory={handleDeleteCategory}
          itemCountByCategory={itemCountByCategory}
        />

        {/* Items Grid */}
        <main className="flex-1 overflow-y-auto p-3 pb-24 sm:p-6 sm:pb-6">
          <ItemGrid 
            items={filteredItems} 
            onItemClick={handleItemClick}
            onAddItemClick={() => setIsAddItemModalOpen(true)} 
          />
        </main>
      </div>

      {/* Mobile Cart FAB */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-on-primary shadow-[var(--md-elevation-3)] transition-transform active:scale-95 lg:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        {cartItems.length > 0 && (
          <span className="font-medium">
            {cartItems.length} · ${calculateTotal().toFixed(2)}
          </span>
        )}
      </button>

      {/* Cart Sidebar - Desktop always visible, Mobile slide-out */}
      <CartSidebar
        cartItems={cartItems}
        customerName={customerName}
        onCustomerNameChange={setCustomerName}
        onUpdateQuantity={handleUpdateCartItem}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onPlaceOrder={handlePlaceOrder}
        total={calculateTotal()}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        recentOrders={recentOrders}
        isLoadingOrders={isLoadingOrders}
        hasMoreOrders={hasMoreOrders}
        onLoadMoreOrders={handleLoadMoreOrders}
        onRefreshOrders={handleRefreshOrders}
        onOrderStatusChange={handleOrderStatusChange}
        onItemStatusChange={handleItemStatusChange}
        onEditOrderItem={handleEditOrderItem}
        onDeleteOrderItem={handleDeleteOrderItem}
      />

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          modifiers={itemModifiers}
          allModifiers={allModifiers}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedItem(null);
            setItemModifiers([]);
          }}
          onAddToCart={handleAddToCart}
          onCreateModifier={handleCreateModifier}
          onLinkModifier={handleLinkModifier}
          onUnlinkModifier={handleUnlinkModifier}
          onDeleteModifier={handleDeleteModifier}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {/* Add Item Modal */}
      <AddItemModal
        categories={categories}
        modifiers={allModifiers}
        isOpen={isAddItemModalOpen}
        selectedCategoryId={selectedCategory?.id}
        onClose={() => setIsAddItemModalOpen(false)}
        onAddItem={async (itemData) => {
          const newItem = await handleCreateItem({
            name: itemData.name,
            description: itemData.description,
            base_price: itemData.base_price,
            category_id: itemData.category_id,
            image_url: itemData.image_url,
            no_prep_needed: itemData.no_prep_needed,
          });
          // Link modifiers to the new item
          if (itemData.modifierIds.length > 0 && newItem) {
            for (const modifierId of itemData.modifierIds) {
              await linkModifierToItem(newItem.id, modifierId);
            }
          }
        }}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        onCreateModifier={handleCreateModifier}
      />

      {/* Order Item Edit Modal */}
      <OrderItemEditModal
        orderItem={editingOrderItem}
        availableModifiers={editingOrderItemModifiers}
        isOpen={isOrderItemEditModalOpen}
        onClose={() => {
          setIsOrderItemEditModalOpen(false);
          setEditingOrderItem(null);
          setEditingOrderItemModifiers([]);
        }}
        onSave={handleSaveOrderItem}
      />
    </div>
  );
}
