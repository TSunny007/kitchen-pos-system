"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemTheme(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(DARK_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia(DARK_QUERY).matches ? "dark" : "light";

// There is no media query on the server. Nothing renders `resolvedTheme` before
// mount - ThemeToggle shows a placeholder until then - so this value never
// reaches the markup; it only keeps the first client render from reading
// `window`.
const getServerSystemTheme = (): ResolvedTheme => "light";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");

  // The OS preference is an external store, so subscribe to it rather than
  // mirroring it into state from an effect.
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    getServerSystemTheme
  );

  // Derived, not stored: keeping this in state meant every change had to be
  // written twice (here and in the media-query listener) and could drift.
  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Read the persisted choice once on mount. localStorage isn't available
  // during SSR, so this can't be a lazy initial-state value without making the
  // hydration render disagree with the server's; the inline script in
  // layout.tsx applies the class before paint, so there's no flash meanwhile.
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(stored);
    }
  }, []);

  // Sync the resolved theme to the document element (an external system).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  // Always provide the context, even before mounting
  // This prevents the "useTheme must be used within a ThemeProvider" error
  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme: handleSetTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
