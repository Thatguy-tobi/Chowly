"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { naira, minutes } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  QueueSkeleton,
  inputClass,
} from "@/components/ui";

type Category = { id: string; name: string; type: "FOOD" | "DRINK" };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  preparationTimeMinutes: number;
  emoji: string | null;
  isAvailable: boolean;
  category: { name: string; type: "FOOD" | "DRINK" };
};
type Menu = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  items: Item[];
};
type Restaurant = { id: string; name: string; address: string };
type StaffMember = { id: string; firstName: string; lastName: string; role: string };

const ROLES = [
  { id: "WAITER", label: "Waiter", why: "takes orders to tables" },
  { id: "CHEF", label: "Chef", why: "recorded against food" },
  { id: "BARTENDER", label: "Bartender", why: "recorded against drinks" },
] as const;

/**
 * One restaurant's menus, and the means to add to them.
 *
 * This is the create side of Restaurant → Menu → MenuItem, which nothing else
 * in the application exercises: everywhere else only reads what the seed put
 * there. An item added here is immediately orderable by a customer, which is
 * the point — it goes into the same tables the rest of the app reads from.
 */
export default function AdminRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingMenu, setAddingMenu] = useState(false);

  const load = useCallback(async () => {
    const [rs, ms, st] = await Promise.all([
      fetch("/api/restaurants").then((r) => r.json()),
      fetch(`/api/menus?restaurantId=${id}`).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load the menus");
        return d;
      }),
      fetch(`/api/staff?restaurantId=${id}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    const found = (rs as Restaurant[]).find((r) => r.id === id);
    if (!found) throw new Error("That restaurant does not exist");
    setRestaurant(found);
    setMenus(ms);
    setStaff(st);
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/admin" className="mt-4 inline-block text-sm text-accent hover:underline">
          ← All restaurants
        </Link>
      </div>
    );
  }
  if (!restaurant || !menus) return <QueueSkeleton />;

  const itemCount = menus.reduce((n, m) => n + m.items.length, 0);
  const missing = [
    staff.some((s) => s.role === "WAITER") ? null : "a waiter",
    itemCount > 0 ? null : "something on a menu",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/admin" className="text-sm text-accent hover:underline">
        ← All restaurants
      </Link>

      <h1 className="mt-3 font-display text-2xl text-ink">{restaurant.name}</h1>
      <p className="text-sm text-ink-soft">{restaurant.address}</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        {menus.length} menu{menus.length === 1 ? "" : "s"} · {itemCount} item
        {itemCount === 1 ? "" : "s"} · {staff.length} staff
      </p>

      {/*
        A restaurant is only open for business once it can actually complete an
        order. Without a waiter, placing one is refused outright; without items
        there is nothing to place. Saying so here is what stops a customer
        getting all the way to the checkout before finding out.
      */}
      {missing.length > 0 && (
        <p className="mt-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
          <strong>Not yet open to customers.</strong> This restaurant still
          needs {missing.join(" and ")}. Until then it is shown as unavailable
          on the customer&rsquo;s screen.
        </p>
      )}

      <StaffBlock restaurantId={id} staff={staff} onChanged={load} />

      {addingMenu ? (
        <NewMenuForm
          restaurantId={id}
          onCancel={() => setAddingMenu(false)}
          onCreated={async () => {
            setAddingMenu(false);
            await load();
          }}
        />
      ) : (
        <Button className="mt-4" variant="secondary" onClick={() => setAddingMenu(true)}>
          Add a menu
        </Button>
      )}

      {menus.length === 0 ? (
        <EmptyState icon="📋" title="No menus yet">
          A restaurant needs a menu before anything can be put on it.
        </EmptyState>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {menus.map((m) => (
            <MenuBlock key={m.id} menu={m} categories={categories} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffBlock({
  restaurantId,
  staff,
  onChanged,
}: {
  restaurantId: string;
  staff: StaffMember[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", role: "WAITER" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the staff member");
      setForm({ firstName: "", lastName: "", phone: "", role: "WAITER" });
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card className="mt-4 p-4">
      <h2 className="text-sm font-medium text-ink">Staff</h2>
      {staff.length === 0 ? (
        <p className="mt-2 text-sm text-ink-faint">Nobody works here yet.</p>
      ) : (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {staff.map((s) => (
            <li
              key={s.id}
              className="rounded-full bg-surface-sunken px-3 py-1.5 text-sm text-ink-soft"
            >
              {s.firstName} {s.lastName}{" "}
              <span className="text-xs text-ink-faint">
                {s.role.charAt(0) + s.role.slice(1).toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={submit} className="animate-rise mt-3 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name">
              <input className={inputClass} value={form.firstName} onChange={set("firstName")} required />
            </Field>
            <Field label="Surname">
              <input className={inputClass} value={form.lastName} onChange={set("lastName")} required />
            </Field>
          </div>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={set("phone")} required inputMode="tel" />
          </Field>
          <div>
            <span className="text-sm font-medium text-ink">Role</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={form.role === r.id}
                  onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    form.role === r.id
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-border-subtle text-ink-soft hover:border-border-strong"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">
              {ROLES.find((r) => r.id === form.role)?.why}
            </p>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Adding…" : "Add to the payroll"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Add staff
        </Button>
      )}
    </Card>
  );
}

function MenuBlock({
  menu,
  categories,
  onChanged,
}: {
  menu: Menu;
  categories: Category[];
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink">{menu.name}</h2>
          {menu.description && <p className="text-sm text-ink-soft">{menu.description}</p>}
        </div>
        {!menu.isActive && <Badge tone="warning">Not in use</Badge>}
      </div>

      {menu.items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">Nothing on this menu yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border-subtle">
          {menu.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <span aria-hidden className="text-lg">
                {i.emoji ?? "🍽️"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{i.name}</p>
                <p className="text-xs text-ink-faint">
                  {i.category.name} · {minutes(i.preparationTimeMinutes)}
                  {!i.isAvailable && " · unavailable"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                {naira(i.price)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <NewItemForm
          menuId={menu.id}
          categories={categories}
          onCancel={() => setAdding(false)}
          onCreated={async () => {
            setAdding(false);
            await onChanged();
          }}
        />
      ) : (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
          Add an item
        </Button>
      )}
    </Card>
  );
}

function NewMenuForm({
  restaurantId,
  onCancel,
  onCreated,
}: {
  restaurantId: string;
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, name, description: description || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the menu");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <Card className="animate-rise mt-4 p-5">
      <h2 className="font-display text-lg text-ink">New menu</h2>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <Field label="Name" hint="Such as “All day” or “Drinks”">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </Field>
        <Field label="Description">
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add menu"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function NewItemForm({
  menuId,
  categories,
  onCancel,
  onCreated,
}: {
  menuId: string;
  categories: Category[];
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    preparationTimeMinutes: "",
    categoryId: "",
    emoji: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId,
          categoryId: form.categoryId,
          name: form.name,
          description: form.description || null,
          price: Number(form.price),
          preparationTimeMinutes: Number(form.preparationTimeMinutes),
          emoji: form.emoji || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the item");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="animate-rise mt-3 rounded-xl bg-surface-sunken p-4">
      <h3 className="text-sm font-medium text-ink">New item</h3>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_5rem]">
          <Field label="Name">
            <input className={inputClass} value={form.name} onChange={set("name")} required maxLength={80} />
          </Field>
          <Field label="Emoji">
            <input
              className={inputClass}
              value={form.emoji}
              onChange={set("emoji")}
              maxLength={8}
              placeholder="🍲"
            />
          </Field>
        </div>

        <Field label="Description">
          <input
            className={inputClass}
            value={form.description}
            onChange={set("description")}
            maxLength={300}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price in naira" hint="Whole naira only">
            <input
              className={inputClass}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value.replace(/\D/g, "") }))}
              required
              inputMode="numeric"
              placeholder="4500"
            />
          </Field>
          <Field label="Preparation time" hint="Minutes — this sets the quoted wait">
            <input
              className={inputClass}
              value={form.preparationTimeMinutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  preparationTimeMinutes: e.target.value.replace(/\D/g, ""),
                }))
              }
              required
              inputMode="numeric"
              placeholder="20"
            />
          </Field>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Category</span>
          <select
            className={inputClass}
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            required
          >
            <option value="">Choose one…</option>
            <optgroup label="Food">
              {categories
                .filter((c) => c.type === "FOOD")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Drink">
              {categories
                .filter((c) => c.type === "DRINK")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          </select>
          <span className="text-xs text-ink-faint">
            Food and drink are prepared in parallel, so this decides whether the
            item counts towards the kitchen or the bar.
          </span>
        </label>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Adding…" : "Add item"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
