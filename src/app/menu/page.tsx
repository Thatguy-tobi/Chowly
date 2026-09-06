"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { naira, minutes } from "@/lib/format";
import { Badge, Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";

type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  preparationTimeMinutes: number;
  emoji: string | null;
};
type Category = { id: string; name: string; type: "FOOD" | "DRINK"; items: Item[] };
type Menu = {
  restaurant: { id: string; name: string; address: string; openingTime: string; closingTime: string };
  food: Category[];
  drinks: Category[];
  itemCount: number;
};

/**
 * Requirement 1, as the customer sees it: the food and drinks currently
 * available, each with its price and how long it takes to prepare.
 *
 * The preparation time is shown on every item rather than hidden, because it is
 * what the quoted wait is built from — someone in a hurry can see that a
 * grilled fish is 35 minutes and a chapman is 6 before they commit to either.
 */
export default function MenuPage() {
  const router = useRouter();
  const { session, ready } = useSession();
  const cart = useCart();

  const [menu, setMenu] = useState<Menu | null>(null);
  const [tab, setTab] = useState<"FOOD" | "DRINK">("FOOD");
  const [error, setError] = useState<string | null>(null);

  const restaurantId = session.customer.restaurantId;

  useEffect(() => {
    if (!ready) return;
    // A table number is as necessary as a customer here — without one the
    // order cannot be placed and the waiter would not know where to take it.
    if (!restaurantId || !session.customer.customerId || !session.customer.tableNumber) {
      router.replace("/");
      return;
    }
    setMenu(null);
    fetch(`/api/restaurants/${restaurantId}/menu`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load the menu");
        return d;
      })
      .then(setMenu)
      .catch((e) => setError(e.message));
  }, [ready, restaurantId, session.customer.customerId, session.customer.tableNumber, router]);

  if (!ready || (!menu && !error)) return <Spinner label="Loading the menu" />;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!menu) return null;

  const categories = tab === "FOOD" ? menu.food : menu.drinks;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-32">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{menu.restaurant.name}</h1>
          <p className="text-sm text-ink-soft">
            Table {session.customer.tableNumber} · {session.customer.name}
          </p>
        </div>
        <Link href="/orders" className="shrink-0 text-sm text-accent hover:underline">
          My orders
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Menu sections"
        className="sticky top-[57px] z-20 -mx-4 mt-5 flex gap-1 bg-surface/90 px-4 py-2 backdrop-blur-md"
      >
        {(["FOOD", "DRINK"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-accent text-on-accent"
                : "bg-surface-sunken text-ink-soft hover:text-ink"
            }`}
          >
            {t === "FOOD" ? "Food" : "Drinks"}
          </button>
        ))}
      </div>

      {categories.length === 0 ? (
        <EmptyState icon="🍽️" title="Nothing here yet">
          This restaurant has no {tab === "FOOD" ? "food" : "drinks"} on its menu
          right now.
        </EmptyState>
      ) : (
        <div className="mt-4 flex flex-col gap-7">
          {categories.map((category) => (
            <section key={category.id}>
              <h2 className="mb-2.5 font-display text-lg text-ink">{category.name}</h2>
              <ul className="flex flex-col gap-2">
                {category.items.map((item) => {
                  const quantity = cart.quantityOf(item.id);
                  return (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 transition ${
                        quantity > 0
                          ? "border-accent/40 bg-accent-soft"
                          : "border-border-subtle bg-surface-raised"
                      }`}
                    >
                      <span aria-hidden className="mt-0.5 text-2xl">
                        {item.emoji ?? "🍽️"}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{item.name}</p>
                        {item.description && (
                          <p className="mt-0.5 text-sm text-ink-soft">{item.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">
                            {naira(item.price)}
                          </span>
                          <Badge>⏱ {minutes(item.preparationTimeMinutes)}</Badge>
                        </div>
                      </div>

                      {quantity === 0 ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Add ${item.name}`}
                          onClick={() =>
                            cart.add(
                              {
                                itemId: item.id,
                                name: item.name,
                                emoji: item.emoji,
                                price: item.price,
                                preparationTimeMinutes: item.preparationTimeMinutes,
                                categoryType: category.type,
                              },
                              menu.restaurant.id
                            )
                          }
                        >
                          Add
                        </Button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-raised p-1">
                          <button
                            aria-label={`One fewer ${item.name}`}
                            onClick={() => cart.setQuantity(item.id, quantity - 1)}
                            className="h-7 w-7 rounded-full text-ink-soft transition hover:bg-surface-sunken"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-sm font-semibold tabular-nums text-ink">
                            {quantity}
                          </span>
                          <button
                            aria-label={`One more ${item.name}`}
                            onClick={() => cart.setQuantity(item.id, quantity + 1)}
                            className="h-7 w-7 rounded-full text-ink-soft transition hover:bg-surface-sunken"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {cart.count > 0 && (
        <div className="animate-rise fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 p-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {cart.count} item{cart.count === 1 ? "" : "s"} · {naira(cart.total)}
              </p>
              <p className="text-xs text-ink-soft">
                about {minutes(cart.estimatedWaitMinutes)} to prepare
              </p>
            </div>
            <Button size="lg" onClick={() => router.push("/cart")}>
              Review order
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
