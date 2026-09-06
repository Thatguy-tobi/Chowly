"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { naira, minutes, staffName, dateAndTime } from "@/lib/format";
import { OrderProgress } from "@/components/OrderProgress";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorNote,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui";

type Order = {
  id: string;
  reference: string;
  status: "PLACED" | "PREPARING" | "SERVED" | "PAID";
  orderDate: string;
  servedAt: string | null;
  tableNumber: number;
  estimatedWaitTime: number;
  orderTotal: number;
  restaurant: { id: string; name: string; address: string };
  customer: { id: string; firstName: string };
  waiter: { firstName: string; lastName: string } | null;
  items: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    item: { name: string; emoji: string | null; category: { name: string; type: string } };
  }[];
  preparation: {
    chef: { firstName: string; lastName: string } | null;
    bartender: { firstName: string; lastName: string } | null;
    preparationStart: string | null;
    preparationEnd: string | null;
  } | null;
  payment: {
    amount: number;
    method: string;
    transactionReference: string;
    isPretend: boolean;
    paymentDate: string;
  } | null;
  rating: { value: number; comment: string | null } | null;
  complaints: { id: string; complaintText: string; complaintDate: string; status: string }[];
};

/** One order, followed from the kitchen to the bill. */
export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // While the order is live, poll so the waiter's actions appear here without
  // the customer needing to refresh.
  useEffect(() => {
    if (!order || order.status === "PAID") return;
    const t = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [order, load]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
        <ButtonLink href="/menu" variant="secondary" className="mt-4">
          Back to the menu
        </ButtonLink>
      </div>
    );
  }
  if (!order) return <Spinner label="Loading your order" />;

  const canGiveFeedback = order.status !== "PLACED";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{order.reference}</h1>
          <p className="text-sm text-ink-soft">
            {order.restaurant.name} · table {order.tableNumber}
          </p>
          <p className="text-xs text-ink-faint">Placed {dateAndTime(order.orderDate)}</p>
        </div>
        <Link href="/orders" className="shrink-0 text-sm text-accent hover:underline">
          All orders
        </Link>
      </div>

      <div className="mt-5">
        <OrderProgress
          status={order.status}
          orderDate={order.orderDate}
          estimatedWaitTime={order.estimatedWaitTime}
          servedAt={order.servedAt}
        />
      </div>

      {/* Who is looking after it — requirement 3, from the customer's side */}
      <Card className="mt-4 p-4">
        <h2 className="text-sm font-medium text-ink">Who is looking after this</h2>
        <dl className="mt-2.5 grid grid-cols-3 gap-3 text-sm">
          {[
            ["Waiter", staffName(order.waiter)],
            ["Chef", staffName(order.preparation?.chef)],
            ["Bartender", staffName(order.preparation?.bartender)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-faint">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {!order.preparation && (
          <p className="mt-3 text-xs text-ink-faint">
            The chef and bartender are recorded by your waiter once they start
            on your order.
          </p>
        )}
      </Card>

      <Card className="mt-4 divide-y divide-border-subtle">
        {order.items.map((line) => (
          <div key={line.itemId} className="flex items-center gap-3 p-4">
            <span aria-hidden className="text-xl">
              {line.item.emoji ?? "🍽️"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{line.item.name}</p>
              <p className="text-xs text-ink-faint">
                {line.quantity} × {naira(line.unitPrice)} · {line.item.category.name}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
              {naira(line.subtotal)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between p-4">
          <span className="text-ink-soft">Total</span>
          <span className="font-display text-xl text-ink">{naira(order.orderTotal)}</span>
        </div>
      </Card>

      {order.complaints.length > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="text-sm font-medium text-ink">
            Your complaint{order.complaints.length > 1 ? "s" : ""}
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {order.complaints.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface-sunken p-3">
                <p className="text-sm text-ink">{c.complaintText}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone={c.status === "RESOLVED" ? "success" : "warning"}>
                    {c.status === "RESOLVED" ? "Resolved" : "Open"}
                  </Badge>
                  <span className="text-xs text-ink-faint">
                    {dateAndTime(c.complaintDate)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canGiveFeedback && (
        <>
          <RatingBlock order={order} onDone={load} />
          <ComplaintBlock order={order} onDone={load} />
        </>
      )}

      <PaymentBlock order={order} onDone={load} />
    </div>
  );
}

/* ------------------------------------------------------------------ rating */

function RatingBlock({ order, onDone }: { order: Order; onDone: () => Promise<Order> }) {
  const [value, setValue] = useState(order.rating?.value ?? 0);
  const [comment, setComment] = useState(order.rating?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.reference}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, comment: comment.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your rating");
      setSaved(true);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 p-4">
      <h2 className="text-sm font-medium text-ink">
        {order.rating ? "Your rating" : "Rate this order"}
      </h2>

      <div className="mt-2.5 flex gap-1.5" role="radiogroup" aria-label="Rating out of 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5`}
            onClick={() => {
              setValue(n);
              setSaved(false);
            }}
            className={`text-2xl transition ${
              n <= value ? "grayscale-0" : "opacity-30 grayscale"
            }`}
          >
            ⭐
          </button>
        ))}
      </div>

      {value > 0 && (
        <div className="mt-3 flex flex-col gap-2.5">
          <Field label="Anything to add?">
            <input
              className={inputClass}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setSaved(false);
              }}
              placeholder={value <= 2 ? "What went wrong?" : "What did you enjoy?"}
              maxLength={500}
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : order.rating ? "Update rating" : "Submit rating"}
            </Button>
            {saved && <span className="text-sm text-success">Saved</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- complaint */

function ComplaintBlock({ order, onDone }: { order: Order; onDone: () => Promise<Order> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.reference}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintText: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send your complaint");
      setText("");
      setOpen(false);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4 text-center">
        <button
          onClick={() => setOpen(true)}
          className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Something wrong with this order?
        </button>
      </div>
    );
  }

  return (
    <Card className="animate-rise mt-4 p-4">
      <h2 className="text-sm font-medium text-ink">Make a complaint</h2>
      <p className="mt-1 text-xs text-ink-faint">
        This is recorded against {order.reference} and your waiter can see it.
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell us what happened — for example, the food arrived much later than the time we quoted."
          maxLength={1000}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={busy || text.trim().length < 5}>
            {busy ? "Sending…" : "Send complaint"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- payment */

const METHODS = [
  { id: "CARD", label: "Card", emoji: "💳" },
  { id: "BANK_TRANSFER", label: "Transfer", emoji: "🏦" },
  { id: "CASH", label: "Cash", emoji: "💵" },
] as const;

function PaymentBlock({ order, onDone }: { order: Order; onDone: () => Promise<Order> }) {
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("CARD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.reference}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record the payment");
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Already paid — show the receipt instead.
  if (order.payment) {
    return (
      <Card className="mt-4 border-success/30 p-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">
            ✅
          </span>
          <h2 className="font-display text-lg text-ink">Paid</h2>
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          {[
            ["Amount", naira(order.payment.amount)],
            ["Method", order.payment.method.replace("_", " ").toLowerCase()],
            ["Reference", order.payment.transactionReference],
            ["Time", dateAndTime(order.payment.paymentDate)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="text-right text-ink capitalize">{v}</dd>
            </div>
          ))}
        </dl>

        {order.payment.isPretend && (
          <p className="mt-4 rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
            <strong>Pretend payment.</strong> No money was transferred and no
            card was charged. The payment is recorded in the database and
            flagged as simulated.
          </p>
        )}

        <ButtonLink href="/menu" variant="secondary" size="sm" className="mt-4">
          Back to the menu
        </ButtonLink>
      </Card>
    );
  }

  const ready = order.status === "SERVED";

  return (
    <Card className="mt-4 p-5">
      <h2 className="font-display text-lg text-ink">Pay before you leave</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {ready
          ? "Settle up and you are free to go."
          : "You can pay once your order has been served."}
      </p>

      <div className="mt-4 flex gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            aria-pressed={method === m.id}
            disabled={!ready}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border p-3 text-xs transition disabled:opacity-40 ${
              method === m.id
                ? "border-accent bg-accent-soft text-accent"
                : "border-border-subtle text-ink-soft hover:border-border-strong"
            }`}
          >
            <span aria-hidden className="text-lg">
              {m.emoji}
            </span>
            {m.label}
          </button>
        ))}
      </div>

      {error && <div className="mt-3">
        <ErrorNote>{error}</ErrorNote>
      </div>}

      <Button size="lg" className="mt-4 w-full" onClick={pay} disabled={!ready || busy}>
        {busy ? "Recording payment…" : `Pay ${naira(order.orderTotal)}`}
      </Button>

      <p className="mt-3 text-center text-xs text-ink-faint">
        This is a <strong>simulated</strong> payment. Nothing is charged and no
        card details are taken.
      </p>
    </Card>
  );
}
