"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { naira, minutes, clockTime, dateAndTime, staffName } from "@/lib/format";
import { waitProgress } from "@/lib/wait-time";
import { Badge, Button, ButtonLink, Card, ErrorNote, Spinner } from "@/components/ui";

type Status = "PLACED" | "PREPARING" | "SERVED" | "PAID";

type Order = {
  id: string;
  reference: string;
  status: Status;
  orderDate: string;
  servedAt: string | null;
  tableNumber: number;
  estimatedWaitTime: number;
  orderTotal: number;
  restaurant: { id: string; name: string };
  customer: { firstName: string };
  waiter: { firstName: string; lastName: string } | null;
  items: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    item: {
      name: string;
      emoji: string | null;
      preparationTimeMinutes: number;
      category: { name: string; type: "FOOD" | "DRINK" };
    };
  }[];
  preparation: {
    chef: { id: string; firstName: string; lastName: string } | null;
    bartender: { id: string; firstName: string; lastName: string } | null;
    preparationStart: string | null;
    preparationEnd: string | null;
  } | null;
  payment: { amount: number; method: string; isPretend: boolean; paymentDate: string } | null;
  rating: { value: number; comment: string | null } | null;
  complaints: { id: string; complaintText: string; complaintDate: string; status: string }[];
};

type StaffMember = { id: string; firstName: string; lastName: string; role: string };

/**
 * One order, as the waiter works it — requirement 3.
 *
 * Two actions live here and they are deliberately in order: record who prepared
 * the order, then mark it served. The second is refused by the API until the
 * first has happened, so the screen greys it out rather than letting the waiter
 * discover that by being rejected.
 */
export default function WaiterOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load that order");
    setOrder(data);
    return data as Order;
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  // The staff list belongs to the order's restaurant, not to whichever
  // restaurant the waiter happens to have selected — recording someone who
  // works elsewhere is rejected by the API, so they are never offered.
  useEffect(() => {
    if (!order) return;
    fetch(`/api/staff?restaurantId=${order.restaurant.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [order?.restaurant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // How late an order is running is the whole reason a waiter opens this
  // screen, so the clock ticks rather than freezing at whatever it said when
  // the page loaded. The order itself is refetched too, so a payment made on
  // the customer's phone appears here without a reload.
  const settled = order?.status === "PAID";
  useEffect(() => {
    if (settled) return;
    const tick = setInterval(() => setNow(new Date()), 15000);
    const poll = setInterval(() => load().catch(() => {}), 15000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [settled, load]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
        <ButtonLink href="/waiter" variant="secondary" className="mt-4">
          Back to the queue
        </ButtonLink>
      </div>
    );
  }
  if (!order) return <Spinner label="Loading the order" />;

  const food = order.items.filter((l) => l.item.category.type === "FOOD");
  const drinks = order.items.filter((l) => l.item.category.type === "DRINK");
  const progress = waitProgress(
    new Date(order.orderDate),
    order.estimatedWaitTime,
    order.servedAt ? new Date(order.servedAt) : null,
    now
  );
  const live = order.status === "PLACED" || order.status === "PREPARING";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/waiter" className="text-sm text-accent hover:underline">
        ← Queue
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Table {order.tableNumber}</h1>
          <p className="text-sm text-ink-soft">
            {order.reference} · {order.customer.firstName}
          </p>
          <p className="text-xs text-ink-faint">Placed {dateAndTime(order.orderDate)}</p>
        </div>
        <Badge
          tone={
            order.status === "PAID"
              ? "neutral"
              : order.status === "SERVED"
                ? "success"
                : live && progress.isOverdue
                  ? "danger"
                  : "accent"
          }
        >
          {order.status === "PLACED"
            ? "New"
            : order.status.charAt(0) + order.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {/* Timing, framed for the person who has to answer for it */}
      <Card
        className={`mt-4 p-4 ${live && progress.isOverdue ? "border-danger/40" : ""}`}
      >
        {live ? (
          <p className="text-sm">
            {progress.isOverdue ? (
              <span className="font-medium text-danger">
                {minutes(progress.overdueByMinutes)} past the {minutes(order.estimatedWaitTime)}{" "}
                quoted to this table.
              </span>
            ) : (
              <span className="text-ink">
                {minutes(progress.remainingMinutes)} left of the{" "}
                {minutes(order.estimatedWaitTime)} quoted · {minutes(progress.elapsedMinutes)} so
                far.
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-ink">
            Served in {minutes(progress.elapsedMinutes)}
            {progress.isOverdue
              ? ` — ${minutes(progress.overdueByMinutes)} over the ${minutes(order.estimatedWaitTime)} quoted.`
              : ` — within the ${minutes(order.estimatedWaitTime)} quoted.`}
          </p>
        )}
        {order.waiter && (
          <p className="mt-1.5 text-xs text-ink-faint">
            Assigned to {staffName(order.waiter)}
          </p>
        )}
      </Card>

      {/* Split by where it is made, because that is who the waiter chases */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ItemGroup title="Kitchen" icon="🍳" lines={food} />
        <ItemGroup title="Bar" icon="🍹" lines={drinks} />
      </div>

      <Card className="mt-3 flex items-center justify-between p-4">
        <span className="text-ink-soft">Total</span>
        <span className="font-display text-xl text-ink">{naira(order.orderTotal)}</span>
      </Card>

      {order.complaints.length > 0 && (
        <Card className="mt-4 border-danger/30 p-4">
          <h2 className="text-sm font-medium text-danger">
            Complaint{order.complaints.length > 1 ? "s" : ""} from this table
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {order.complaints.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface-sunken p-3">
                <p className="text-sm text-ink">{c.complaintText}</p>
                <p className="mt-1 text-xs text-ink-faint">{dateAndTime(c.complaintDate)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {order.rating && (
        <Card className="mt-4 p-4">
          <h2 className="text-sm font-medium text-ink">
            Rated {order.rating.value} out of 5
          </h2>
          {order.rating.comment && (
            <p className="mt-1.5 text-sm text-ink-soft">“{order.rating.comment}”</p>
          )}
        </Card>
      )}

      <PreparationBlock order={order} staff={staff} food={food.length} drinks={drinks.length} onDone={load} />

      <ServeBlock order={order} onDone={load} />

      {order.payment ? (
        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">
              Paid {naira(order.payment.amount)} by{" "}
              {order.payment.method.replace("_", " ").toLowerCase()}
            </span>
            <span className="text-xs text-ink-faint">
              {clockTime(order.payment.paymentDate)}
            </span>
          </div>
          {order.payment.isPretend && (
            <p className="mt-2 text-xs text-warning">
              Simulated payment — no money changed hands.
            </p>
          )}
        </Card>
      ) : (
        <p className="mt-4 text-center text-xs text-ink-faint">
          The customer pays from their own screen before they leave.
        </p>
      )}
    </div>
  );
}

function ItemGroup({
  title,
  icon,
  lines,
}: {
  title: string;
  icon: string;
  lines: Order["items"];
}) {
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <span aria-hidden>{icon}</span>
        {title}
      </h2>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-ink-faint">Nothing from the {title.toLowerCase()}.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.itemId} className="flex items-start gap-2">
              <span aria-hidden className="text-base">
                {line.item.emoji ?? "🍽️"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  <span className="font-medium tabular-nums">{line.quantity}×</span>{" "}
                  {line.item.name}
                </p>
                <p className="text-xs text-ink-faint">
                  {minutes(line.item.preparationTimeMinutes)} each
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ preparation */

function PreparationBlock({
  order,
  staff,
  food,
  drinks,
  onDone,
}: {
  order: Order;
  staff: StaffMember[];
  food: number;
  drinks: number;
  onDone: () => Promise<Order>;
}) {
  const [chefId, setChefId] = useState<string | null>(order.preparation?.chef?.id ?? null);
  const [bartenderId, setBartenderId] = useState<string | null>(
    order.preparation?.bartender?.id ?? null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const chefs = staff.filter((s) => s.role === "CHEF");
  const bartenders = staff.filter((s) => s.role === "BARTENDER");

  // The API refuses a chef on a drinks-only order and a bartender on a
  // food-only one, so neither is offered where it does not apply.
  const needsChef = food > 0;
  const needsBartender = drinks > 0;
  const complete = (!needsChef || chefId) && (!needsBartender || bartenderId);
  const locked = order.status === "PAID";

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.reference}/preparation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chefId: needsChef ? chefId : null,
          bartenderId: needsBartender ? bartenderId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record who prepared this");
      setSaved(true);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 p-5">
      <h2 className="font-display text-lg text-ink">Who prepared this</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {order.preparation
          ? "Recorded against this order. You can correct it until the order is paid for."
          : "Record this before the order goes out."}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {needsChef && (
          <StaffPicker
            label="Chef"
            hint={`${food} item${food === 1 ? "" : "s"} from the kitchen`}
            people={chefs}
            selected={chefId}
            disabled={locked}
            onSelect={(v) => {
              setChefId(v);
              setSaved(false);
            }}
          />
        )}
        {needsBartender && (
          <StaffPicker
            label="Bartender"
            hint={`${drinks} item${drinks === 1 ? "" : "s"} from the bar`}
            people={bartenders}
            selected={bartenderId}
            disabled={locked}
            onSelect={(v) => {
              setBartenderId(v);
              setSaved(false);
            }}
          />
        )}
      </div>

      {error && <div className="mt-3">
        <ErrorNote>{error}</ErrorNote>
      </div>}

      {!locked && (
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={busy || !complete}>
            {busy ? "Recording…" : order.preparation ? "Update" : "Record preparation"}
          </Button>
          {saved && <span className="text-sm text-success">Saved</span>}
          {!complete && (
            <span className="text-xs text-ink-faint">
              Pick {needsChef && !chefId ? "a chef" : ""}
              {needsChef && !chefId && needsBartender && !bartenderId ? " and " : ""}
              {needsBartender && !bartenderId ? "a bartender" : ""}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function StaffPicker({
  label,
  hint,
  people,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  hint: string;
  people: StaffMember[];
  selected: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-faint">{hint}</span>
      </div>

      {people.length === 0 ? (
        <p className="mt-2 text-sm text-ink-faint">
          No {label.toLowerCase()} is on the staff list for this restaurant.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={`Which ${label.toLowerCase()} prepared this order`}
          className="mt-2 flex flex-wrap gap-2"
        >
          {people.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={selected === p.id}
              disabled={disabled}
              onClick={() => onSelect(p.id)}
              className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
                selected === p.id
                  ? "border-accent bg-accent-soft font-medium text-accent"
                  : "border-border-subtle bg-surface text-ink-soft hover:border-border-strong"
              }`}
            >
              {p.firstName} {p.lastName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ serve */

function ServeBlock({ order, onDone }: { order: Order; onDone: () => Promise<Order> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.status === "SERVED" || order.status === "PAID") {
    return (
      <Card className="mt-4 border-success/30 p-4">
        <p className="text-sm text-ink">
          <span aria-hidden>✅ </span>
          Served{order.servedAt && ` at ${clockTime(order.servedAt)}`}
          {order.preparation?.chef && ` · prepared by ${staffName(order.preparation.chef)}`}
          {order.preparation?.bartender &&
            ` · drinks by ${staffName(order.preparation.bartender)}`}
        </p>
      </Card>
    );
  }

  async function markServed() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.reference}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SERVED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not mark this as served");
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(order.preparation);

  return (
    <div className="mt-4">
      {error && <div className="mb-3">
        <ErrorNote>{error}</ErrorNote>
      </div>}
      <Button size="lg" className="w-full" onClick={markServed} disabled={!ready || busy}>
        {busy ? "Marking served…" : "Mark as served"}
      </Button>
      {!ready && (
        <p className="mt-2 text-center text-xs text-ink-faint">
          Record who prepared the order first — it is what the customer sees on
          their own screen.
        </p>
      )}
    </div>
  );
}
