import type { Metadata, Viewport } from "next";
import Link from "next/link";
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

const DESCRIPTION =
  "View the menu, order from your table, follow your order as it is prepared, and pay before you leave.";

export const metadata: Metadata = {
  // Needed for the Open Graph image to be given an absolute URL — relative ones
  // are ignored by every service that unfurls a link.
  metadataBase: new URL("https://chowly-red.vercel.app"),
  title: "Chowly — order from your table",
  description: DESCRIPTION,
  openGraph: {
    title: "Chowly — order from your table",
    description: DESCRIPTION,
    siteName: "Chowly",
    type: "website",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chowly — order from your table",
    description: DESCRIPTION,
  },
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
            {/*
              The way in to the two screens the brief does not ask for. They
              were previously reachable only by typing the address, which meant
              nobody would ever find them. The footer is on every page, and is
              where a staff-facing link belongs without competing with the
              customer/waiter switch at the top.
            */}
            <footer className="mx-auto w-full max-w-2xl px-4 pb-10 pt-8 text-center text-xs text-ink-faint">
              <nav className="flex items-center justify-center gap-4">
                <Link href="/dashboard" className="hover:text-ink-soft hover:underline">
                  How service is going
                </Link>
                <Link href="/admin" className="hover:text-ink-soft hover:underline">
                  Manage restaurants
                </Link>
              </nav>
              <p className="mt-3">
                Chowly · a TeSA Africa build assignment · payments on this site
                are simulated
              </p>
            </footer>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
