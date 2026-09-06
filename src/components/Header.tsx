"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, type Role } from "@/lib/session";
import { useCart } from "@/lib/cart";

type Restaurant = { id: string; name: string; address: string };

/**
 * The chrome that carries requirement 6 — the switch between acting as the
 * customer and acting as the waiter.
 *
 * There are two switchers, and they are deliberately independent. The role
 * toggle changes what you are doing; the restaurant menu changes where you are.
 * Because the session stores a restaurant per role, moving the waiter to
 * another restaurant leaves the customer's table where it was.
 */
export function Header() {
  const { session, ready, restaurantId, setRole, setRestaurant } = useSession();
  const { count, clear: clearCart } = useCart();
  const router = useRouter();
  const pathname = usePathname();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/restaurants")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRestaurants)
      .catch(() => setRestaurants([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = restaurants.find((r) => r.id === restaurantId);

  function switchRole(role: Role) {
    if (role === session.role) return;
    setRole(role);
    router.push(role === "waiter" ? "/waiter" : "/menu");
  }

  function chooseRestaurant(id: string) {
    setRestaurant(id);
    setOpen(false);
    if (session.role === "waiter") {
      router.push("/waiter");
    } else {
      // A customer moving to another restaurant is sitting at a different
      // table, so they go back to be seated rather than into a menu they
      // cannot actually order from. Their basket goes too — it is full of
      // another restaurant's dishes, which this kitchen cannot cook.
      if (id !== session.customer.restaurantId) clearCart();
      router.push("/");
    }
  }

  // Nothing meaningful to show until the stored session has been read, and
  // rendering a guess would flash the wrong role.
  const showControls = ready && restaurantId !== null;

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-1.5 font-display">
          <span className="text-xl font-semibold tracking-tight text-ink">Chowly</span>
          <span aria-hidden className="text-accent">
            •
          </span>
        </Link>

        {showControls && (
          <>
            <div className="relative min-w-0 flex-1" ref={menuRef}>
              <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="listbox"
                className="flex w-full items-center gap-1 truncate rounded-full px-2.5 py-1.5 text-left text-sm text-ink-soft transition hover:bg-surface-sunken"
              >
                <span className="truncate">{current?.name ?? "Choose restaurant"}</span>
                <span aria-hidden className="text-xs text-ink-faint">
                  ▾
                </span>
              </button>

              {open && (
                <div
                  role="listbox"
                  className="animate-rise absolute left-0 top-full z-40 mt-2 max-h-80 w-72 overflow-y-auto rounded-2xl border border-border-subtle bg-surface-raised p-1.5 shadow-[var(--shadow-lifted)]"
                >
                  <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    {session.role === "waiter" ? "Working at" : "Dining at"}
                  </p>
                  {restaurants.map((r) => (
                    <button
                      key={r.id}
                      role="option"
                      aria-selected={r.id === restaurantId}
                      onClick={() => chooseRestaurant(r.id)}
                      className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-sunken ${
                        r.id === restaurantId ? "bg-accent-soft" : ""
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          r.id === restaurantId ? "text-accent" : "text-ink"
                        }`}
                      >
                        {r.name}
                      </span>
                      <span className="text-xs text-ink-faint">{r.address}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              role="tablist"
              aria-label="Switch role"
              className="flex shrink-0 rounded-full bg-surface-sunken p-0.5"
            >
              {(["customer", "waiter"] as const).map((role) => (
                <button
                  key={role}
                  role="tab"
                  aria-selected={session.role === role}
                  onClick={() => switchRole(role)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                    session.role === role
                      ? "bg-surface-raised text-ink shadow-sm"
                      : "text-ink-faint hover:text-ink-soft"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            {session.role === "customer" && count > 0 && !pathname.startsWith("/cart") && (
              <Link
                href="/cart"
                aria-label={`${count} item${count === 1 ? "" : "s"} in your order`}
                className="relative shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent"
              >
                {count}
              </Link>
            )}
          </>
        )}
      </div>
    </header>
  );
}
