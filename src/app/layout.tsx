import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/Header";

const sans = Instrument_Sans({
  variable: "--font-sans-stack",
  subsets: ["latin"],
});

// A warmer face for headings — a menu should not be set entirely in UI type.
const display = Fraunces({
  variable: "--font-display-stack",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Chowly — order from your table",
  description:
    "View the menu, order from your table, follow your order as it is prepared, and pay before you leave.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#171310" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SessionProvider>
          <CartProvider>
            <Header />
            <main className="flex-1 w-full">{children}</main>
            <footer className="mx-auto w-full max-w-2xl px-4 pb-10 pt-8 text-center text-xs text-ink-faint">
              Chowly · a TeSA Africa build assignment · payments on this site are
              simulated
            </footer>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
