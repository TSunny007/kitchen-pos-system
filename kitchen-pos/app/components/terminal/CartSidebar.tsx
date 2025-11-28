"use client";

import { CartItem } from "../../types";

interface CartSidebarProps {
  cartItems: CartItem[];
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  onUpdateQuantity: (cartItemId: string, quantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onPlaceOrder: () => void;
  total: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function CartSidebar({
  cartItems,
  customerName,
  onCustomerNameChange,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
  total,
  isOpen = false,
  onClose,
}: CartSidebarProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const calculateItemTotal = (cartItem: CartItem): number => {
    const baseTotal = cartItem.item.base_price * cartItem.quantity;
    const modifiersTotal = cartItem.modifiers.reduce(
      (sum, mod) => sum + mod.price_delta * cartItem.quantity,
      0
    );
    return baseTotal + modifiersTotal;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar - hidden on mobile unless open */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-outline-variant bg-surface-container-lowest transition-transform duration-300 lg:static lg:z-auto lg:w-96 lg:max-w-none lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3 sm:px-6 sm:py-4">
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high lg:hidden"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <h2 className="text-lg font-medium text-on-surface">Current Order</h2>
          {cartItems.length > 0 && (
            <button
              onClick={onClearCart}
              className="text-sm text-error hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Customer Name Input */}
      <div className="border-b border-outline-variant p-4">
        <label className="block text-sm font-medium text-on-surface-variant">
          Customer Name
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder="Enter name..."
          className="mt-2 w-full rounded-lg border border-outline bg-transparent px-4 py-3 text-on-surface placeholder-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        {cartItems.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-outline-variant"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-4 text-on-surface-variant">
              Cart is empty
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Click on an item to add it
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {cartItems.map((cartItem) => (
              <div key={cartItem.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-on-surface">
                      {cartItem.item.name}
                    </h4>
                    {cartItem.modifiers.length > 0 && (
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {cartItem.modifiers.map((m) => m.name).join(", ")}
                      </p>
                    )}
                    {cartItem.notes && (
                      <p className="mt-1 text-xs italic text-on-surface-variant">
                        Note: {cartItem.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(cartItem.id)}
                    className="ml-2 text-on-surface-variant hover:text-error"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        onUpdateQuantity(cartItem.id, cartItem.quantity - 1)
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 12H4"
                        />
                      </svg>
                    </button>
                    <span className="w-8 text-center font-medium text-on-surface">
                      {cartItem.quantity}
                    </span>
                    <button
                      onClick={() =>
                        onUpdateQuantity(cartItem.id, cartItem.quantity + 1)
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                  </div>

                  <span className="font-semibold text-on-surface">
                    {formatPrice(calculateItemTotal(cartItem))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with Total and Place Order */}
      <div className="border-t border-outline-variant bg-surface-container-low p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-medium text-on-surface">Total</span>
          <span className="text-2xl font-bold text-on-surface">
            {formatPrice(total)}
          </span>
        </div>
        <button
          onClick={() => {
            onPlaceOrder();
            onClose?.();
          }}
          disabled={cartItems.length === 0 || !customerName.trim()}
          className="w-full rounded-full bg-primary py-4 text-base font-medium text-on-primary transition-all hover:shadow-[var(--md-elevation-1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Place Order
        </button>
      </div>
    </aside>
    </>
  );
}
