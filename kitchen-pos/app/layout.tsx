import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "./providers/ThemeProvider";

const programme = localFont({
  src: [
    {
      path: "../public/fonts/Programme-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-programme",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Kitchen POS",
  description: "Point of Sale for Kitchen Operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'system';
                let resolved = theme;
                if (theme === 'system') {
                  resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.classList.add(resolved);
              })();
            `,
          }}
        />
      </head>
      <body className={`${programme.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
