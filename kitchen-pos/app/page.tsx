"use client";

import { useAuth } from "./providers/AuthProvider";
import LoginForm from "./components/LoginForm";
import StationCard from "./components/StationCard";
import ThemeToggle from "./components/ThemeToggle";

// Terminal icon (cash register)
function TerminalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

// Kitchen display icon (chef hat / cooking)
function KitchenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
  );
}

export default function Home() {
  const { user, isLoading, signOut } = useAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-on-surface mb-2">
            {process.env.NEXT_PUBLIC_ORG_NAME || "Kitchen"} POS
          </h1>
          <p className="text-on-surface-variant">Sign in to continue</p>
        </div>

        <LoginForm />
      </div>
    );
  }

  // Authenticated - show station selector
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <ThemeToggle />
        <button
          onClick={() => signOut()}
          className="rounded-full border border-outline px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container"
        >
          Sign Out
        </button>
      </div>

      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-on-surface mb-2">
          {process.env.NEXT_PUBLIC_ORG_NAME || "Kitchen"} POS
        </h1>
        <p className="text-on-surface-variant">
          Welcome back, {user.email?.split("@")[0]}
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">
        <StationCard
          title="Order Terminal"
          description="Take customer orders and manage the queue"
          href="/terminal"
          icon={<TerminalIcon />}
        />
        <StationCard
          title="Kitchen Display"
          description="View and manage order preparation"
          href="/kitchen"
          icon={<KitchenIcon />}
        />
      </div>
    </div>
  );
}
