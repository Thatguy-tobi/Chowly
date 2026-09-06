"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { naira, minutes } from "@/lib/format";
import { Button, ButtonLink, Card, EmptyState, ErrorNote } from "@/components/ui";

/**
 * The last look before the kitchen sees it.
 *
 * The wait shown here is computed with the same function the server uses when
 * the order is written, so the estimate the customer agrees to is the estimate
 * they are given back — requirement 2.
 */
export default function CartPage() {
  const router = useRouter();
  const { session, ready } = useSession();
  const cart = useCart();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !session.customer.customerId) router.replace("/");
  }, [ready, session.customer.customerId, router]);

  async function placeOrder() {
    // Caught here rather than at the API, so the customer gets a sentence they
    // can act on instead of a validation error about a null.
    if (!session.customer.tableNumber) {
      setError("We do not have your table number. Tap “Add more” and set it before ordering.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: session.customer.customerId,
          restaurantId: session.customer.restaurantId,
          tableNumber: session.customer.tableNumber,
          items: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not place your order");
      cart.clear();
      router.push(`/orders/${data.reference}?placed=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!ready) return null;

  // A basket belonging to a restaurant the customer has since left cannot be
  // ordered — that kitchen does not have these dishes. Treated as empty rather
  // than letting it fail at the API.
  const stale =
    cart.restaurantId !== null && cart.restaurantId !== session.customer.restaurantId;

  // `busy` matters here: placing an order empties the cart and then navigates,
  // and without this guard the empty state flashes up during the hand-off.
  if ((cart.count === 0 || stale) && !busy) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <EmptyState
          icon="🧺"
          title="Nothing chosen yet"
          action={<ButtonLink href="/menu">Back to the menu</ButtonLink>}
        >
          Pick something from the menu and it will appear here.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl text-ink">Your order</h1>
      <p className="text-sm text-ink-soft">
        Table {session.customer.tableNumber} · {session.customer.name}
      </p>

      <Card className="mt-5 divide-y divide-border-subtle">
        {cart.lines.map((line) => (
          <div key={line.itemId} className="flex items-center gap-3 p-4">
            <span aria-hidden className="text-2xl">
              {line.emoji ?? "🍽️"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{line.name}</p>
              <p className="text-sm text-ink-soft">
                {naira(line.price)} each · {minutes(line.preparationTimeMinutes)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-sunken p-1">
              <button
                aria-label={`One fewer ${line.name}`}
                onClick={() => cart.setQuantity(line.itemId, line.quantity - 1)}
                className="h-7 w-7 rounded-full text-ink-soft transition hover:bg-surface-raised"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-semibold tabular-nums text-ink">
                {line.quantity}
              </span>
              <button
                aria-label={`One more ${line.name}`}
                onClick={() => cart.setQuantity(line.itemId, line.quantity + 1)}
                className="h-7 w-7 rounded-full text-ink-soft transition hover:bg-surface-raised"
              >
                +
              </button>
            </div>

            <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
              {naira(line.price * line.quantity)}
            </span>
          </div>
        ))}
      </Card>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">Total</span>
          <span className="font-display text-xl text-ink">{naira(cart.total)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-ink-soft">Estimated wait</span>
          <span className="font-medium text-ink">{minutes(cart.estimatedWaitMinutes)}</span>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          The kitchen and the bar work at the same time, so the wait is set by
          whichever takes longer — not by adding them together.
        </p>
      </Card>

      {error && <div className="mt-4">
        <ErrorNote>{error}</ErrorNote>
      </div>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <Button size="lg" className="flex-1" onClick={placeOrder} disabled={busy}>
          {busy ? "Sending to the kitchen…" : "Place order"}
        </Button>
        <ButtonLink href="/menu" variant="secondary" size="lg" className="flex-1">
          Add more
        </ButtonLink>
      </div>

      <p className="mt-4 text-center text-xs text-ink-faint">
        You pay at the end of your meal, not now.
      </p>
    </div>
  );
}
