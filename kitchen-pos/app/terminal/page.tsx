"use client";

import { useState, useMemo } from "react";
import { Campaign, Category, Item, CartItem, Modifier } from "../types";
import CampaignSelector from "../components/terminal/CampaignSelector";
import CategoryTabs from "../components/terminal/CategoryTabs";
import ItemGrid from "../components/terminal/ItemGrid";
import CartSidebar from "../components/terminal/CartSidebar";
import ItemDetailModal from "../components/terminal/ItemDetailModal";
import ThemeToggle from "../components/ThemeToggle";

// Mock data - replace with Supabase queries
const mockCampaigns: Campaign[] = [
  { id: 1, name: "Sunday Pop-up 2025-11-28", starts_at: "2025-11-28T09:00:00Z", ends_at: "2025-11-28T17:00:00Z", is_active: true, created_at: "2025-11-27T00:00:00Z" },
  { id: 2, name: "Saturday Market", starts_at: "2025-11-29T08:00:00Z", ends_at: "2025-11-29T14:00:00Z", is_active: true, created_at: "2025-11-27T00:00:00Z" },
];

const mockCategories: Category[] = [
  { id: 1, name: "Bagels", slug: "bagels", display_order: 1, created_at: "2025-11-27T00:00:00Z" },
  { id: 2, name: "Drinks", slug: "drinks", display_order: 2, created_at: "2025-11-27T00:00:00Z" },
  { id: 3, name: "Pastries", slug: "pastries", display_order: 3, created_at: "2025-11-27T00:00:00Z" },
];

const mockItems: Item[] = [
  { id: 1, category_id: 1, name: "Plain Bagel", description: "Classic plain bagel, toasted to perfection", image_url: null, base_price: 3.50, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 2, category_id: 1, name: "Everything Bagel", description: "Loaded with seeds and seasonings", image_url: null, base_price: 4.00, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 3, category_id: 1, name: "Sesame Bagel", description: "Topped with sesame seeds", image_url: null, base_price: 3.75, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 4, category_id: 2, name: "Latte", description: "Espresso with steamed milk", image_url: null, base_price: 5.00, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 5, category_id: 2, name: "Cappuccino", description: "Espresso with foamed milk", image_url: null, base_price: 4.50, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 6, category_id: 2, name: "Drip Coffee", description: "Fresh brewed coffee", image_url: null, base_price: 3.00, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 7, category_id: 3, name: "Croissant", description: "Buttery, flaky pastry", image_url: null, base_price: 4.25, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 8, category_id: 3, name: "Chocolate Muffin", description: "Rich chocolate muffin", image_url: null, base_price: 3.75, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
];

const mockModifiers: Modifier[] = [
  { id: 1, name: "Cream Cheese", description: "Add cream cheese", price_delta: 1.50, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 2, name: "Butter", description: "Add butter", price_delta: 0.50, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 3, name: "Extra Shot", description: "Add an extra espresso shot", price_delta: 1.00, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 4, name: "Oat Milk", description: "Substitute with oat milk", price_delta: 0.75, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
  { id: 5, name: "Iced", description: "Make it iced", price_delta: 0.00, is_active: true, created_at: "2025-11-27T00:00:00Z", updated_at: "2025-11-27T00:00:00Z" },
];

export default function TerminalPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(mockCampaigns[0]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return mockItems;
    return mockItems.filter((item) => item.category_id === selectedCategory.id);
  }, [selectedCategory]);

  // Get modifiers relevant to item's category
  const getModifiersForItem = (item: Item): Modifier[] => {
    // In real app, this would come from item_modifiers table
    if (item.category_id === 1) {
      // Bagels
      return mockModifiers.filter((m) => [1, 2].includes(m.id));
    } else if (item.category_id === 2) {
      // Drinks
      return mockModifiers.filter((m) => [3, 4, 5].includes(m.id));
    }
    return [];
  };

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

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

    // TODO: Submit order to Supabase
    console.log("Placing order:", {
      campaign_id: selectedCampaign?.id,
      customer_name: customerName,
      items: cartItems,
      subtotal: calculateTotal(),
    });

    // Clear cart after successful order
    handleClearCart();
    alert("Order placed successfully!");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar with Campaign Selector */}
        <header className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-3 py-3 sm:px-6 sm:py-4">
          <h1 className="text-lg font-medium text-on-surface sm:text-2xl">{process.env.NEXT_PUBLIC_ORG_NAME || "Kitchen"}</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <CampaignSelector
              campaigns={mockCampaigns}
              selectedCampaign={selectedCampaign}
              onSelectCampaign={setSelectedCampaign}
            />
          </div>
        </header>

        {/* Category Tabs */}
        <CategoryTabs
          categories={mockCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Items Grid */}
        <main className="flex-1 overflow-y-auto p-3 pb-24 sm:p-6 sm:pb-6">
          <ItemGrid items={filteredItems} onItemClick={handleItemClick} />
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
      />

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          modifiers={getModifiersForItem(selectedItem)}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedItem(null);
          }}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
