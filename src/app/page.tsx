"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { Button, Card, ErrorNote, Field, Spinner, inputClass } from "@/components/ui";

type Restaurant = {
  id: string;
  name: string;
  address: string;
  openingTime: string;
  closingTime: string;
  _count: { menus: number; staff: number };
  itemCount: number;
  /** False when the restaurant has no waiter, or nothing on an active menu. */
  canTakeOrders: boolean;
};

/**
 * The way in. Three short steps: where you are, who you are, what you are doing.
 *
 * There is no login — requirement 6 says a switch is enough — so a customer
 * gives a first name and a table number and nothing else. That is genuinely all
 * a restaurant needs to bring food to the right person.
 */
export default function LandingPage() {
  const router = useRouter();
  const { session, ready, setRole, setRestaurant, setCustomer } = useSession();

  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [table, setTable] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/restaurants")
      .then((r) => r.json())
      .then(setRestaurants)
      .catch(() => setError("Could not load the restaurants. Is the server running?"));
  }, []);

  // Prefill from a previous visit so a returning customer is not retyping.
  useEffect(() => {
    if (!ready) return;
    setChosen((c) => c ?? session.customer.restaurantId);
    setName((n) => n || session.customer.name || "");
  }, [ready, session.customer.restaurantId, session.customer.name]);

  const restaurant = restaurants?.find((r) => r.id === chosen) ?? null;

  async function enterAsCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tableNumber: Number(table),
          restaurantId: chosen,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start your session");

      setCustomer({
        customerId: data.id,
        name: data.name,
        tableNumber: Number(table),
        restaurantId: chosen,
      });
      setRole("customer");
      router.push("/menu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  function enterAsWaiter() {
    if (!chosen) return;
    // Explicitly "for the waiter" — without that this would set the restaurant
    // on the customer side, which is the role still active at this moment, and
    // clear their table number as a side effect.
    setRestaurant(chosen, "waiter");
    setRole("waiter");
    router.push("/waiter");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="animate-rise">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Order from your table.
        </h1>
        <p className="mt-2 max-w-md text-ink-soft">
          Browse the menu, send your order to the kitchen, watch it being
          prepared, and settle up before you leave.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">
          1 · Where are you?
        </h2>

        {error && !restaurants && <ErrorNote>{error}</ErrorNote>}
        {!restaurants && !error && <Spinner label="Loading restaurants" />}

        <div className="grid gap-2 sm:grid-cols-2">
          {restaurants?.map((r) => {
            const selected = r.id === chosen;
            // A restaurant with no waiter, or nothing on its menu, cannot
            // complete an order. Offering it anyway would let someone browse
            // and choose dishes only to be refused at the checkout.
            const closed = !r.canTakeOrders;
            return (
              <button
                key={r.id}
                onClick={() => !closed && setChosen(r.id)}
                aria-pressed={selected}
                disabled={closed}
                className={`rounded-2xl border p-4 text-left transition ${
                  closed
                    ? "cursor-not-allowed border-border-subtle bg-surface-sunken opacity-70"
                    : selected
                      ? "border-accent bg-accent-soft"
                      : "border-border-subtle bg-surface-raised hover:border-border-strong"
                }`}
              >
                <span
                  className={`block font-display text-base ${
                    selected && !closed ? "text-accent" : "text-ink"
                  }`}
                >
                  {r.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">{r.address}</span>
                <span className="mt-2 block text-xs text-ink-faint">
                  {closed
                    ? "Not taking orders yet"
                    : `${r.openingTime}–${r.closingTime} · ${r.itemCount} on the menu`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {restaurant && (
        <section className="animate-rise mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">
            2 · Who are you?
          </h2>

          <Card className="p-5">
            <form onSubmit={enterAsCustomer} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <Field label="Your name">
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tobi"
                    autoComplete="given-name"
                    required
                    maxLength={60}
                  />
                </Field>
                <Field label="Table">
                  <input
                    className={`${inputClass} sm:w-28`}
                    value={table}
                    onChange={(e) => setTable(e.target.value.replace(/\D/g, ""))}
                    placeholder="7"
                    inputMode="numeric"
                    required
                  />
                </Field>
              </div>

              <Button type="submit" size="lg" disabled={busy || !name.trim() || !table}>
                {busy ? "Getting your table ready…" : `Start ordering at ${restaurant.name}`}
              </Button>

              {error && restaurants && <ErrorNote>{error}</ErrorNote>}
            </form>

            <div className="mt-5 border-t border-border-subtle pt-4">
              <p className="text-xs text-ink-faint">
                Working here instead? No login needed — this is the staff view.
              </p>
              <Button variant="secondary" size="sm" className="mt-2.5" onClick={enterAsWaiter}>
                Continue as a waiter →
              </Button>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
