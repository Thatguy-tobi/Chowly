"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, ErrorNote, Field, QueueSkeleton, inputClass } from "@/components/ui";

type Restaurant = {
  id: string;
  name: string;
  address: string;
  openingTime: string;
  closingTime: string;
  _count: { menus: number; staff: number };
};

/**
 * The admin side: registering a restaurant so the platform can grow beyond the
 * data it was seeded with.
 *
 * There is no login anywhere in this application — requirement 6 says a switch
 * between customer and waiter is enough — so this screen is open to anyone with
 * the address. That is stated plainly on the page rather than hidden, because
 * pretending otherwise would be worse than admitting it.
 */
export default function AdminPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/restaurants");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load the restaurants");
    setRestaurants(data);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!restaurants) return <QueueSkeleton />;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">Restaurants</h1>
        <Link href="/dashboard" className="shrink-0 text-sm text-accent hover:underline">
          How service is going
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {restaurants.length} on the platform. Add one, then give it a menu.
      </p>

      <p className="mt-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
        <strong>No login.</strong> This application has no accounts by design, so
        this page is open to anyone who knows the address. A real deployment
        would put it behind a staff sign-in.
      </p>

      {open ? (
        <NewRestaurantForm
          onCancel={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            await load();
          }}
        />
      ) : (
        <Button className="mt-4" onClick={() => setOpen(true)}>
          Add a restaurant
        </Button>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {restaurants.map((r) => (
          <Link
            key={r.id}
            href={`/admin/${r.id}`}
            className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-4 transition hover:border-border-strong"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{r.name}</p>
              <p className="truncate text-sm text-ink-soft">{r.address}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {r.openingTime}–{r.closingTime} · {r._count.menus} menu
                {r._count.menus === 1 ? "" : "s"} · {r._count.staff} staff
              </p>
            </div>
            <span aria-hidden className="shrink-0 text-ink-faint">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewRestaurantForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    openingTime: "09:00",
    closingTime: "22:00",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the restaurant");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <Card className="animate-rise mt-4 p-5">
      <h2 className="font-display text-lg text-ink">New restaurant</h2>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={set("name")} required maxLength={80} />
        </Field>
        <Field label="Address">
          <input
            className={inputClass}
            value={form.address}
            onChange={set("address")}
            required
            maxLength={160}
            placeholder="Street, area, Lagos"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={set("phone")} required inputMode="tel" />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={form.email} onChange={set("email")} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens" hint="24-hour, such as 09:00">
            <input className={inputClass} value={form.openingTime} onChange={set("openingTime")} required />
          </Field>
          <Field label="Closes" hint="24-hour, such as 22:30">
            <input className={inputClass} value={form.closingTime} onChange={set("closingTime")} required />
          </Field>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add restaurant"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
