"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { naira, minutes, clockTime } from "@/lib/format";
import { waitProgress } from "@/lib/wait-time";
import { Badge, EmptyState, ErrorNote, Spinner } from "@/components/ui";

type Status = "PLACED" | "PREPARING" | "SERVED" | "PAID";

type QueueOrder = {
  id: string;
  reference: string;
  status: Status;
  orderDate: string;
  servedAt: string | null;
  tableNumber: number;
  estimatedWaitTime: number;
  orderTotal: number;
  customer: { firstName: string };
  items: { quantity: number; item: { name: string; emoji: string | null } }[];
  preparation: { chef: { firstName: string } | null; bartender: { firstName: string } | null } | null;
  complaints: { id: string; status: string }[];
  rating: { value: number } | null;
};

/**
 * The waiter's queue — requirement 3, and the second half of requirement 6.
 *
 * A waiter on shift cares about the work still to do, so orders still owed to a
 * table come first and paid ones are folded away behind a toggle. Within the
 * active list the oldest order is at the top: the table that has been waiting
 * longest is the one most likely to complain, which is exactly the situation
 * requirement 4 describes.
 */
export default function WaiterQueuePage() {
  const router = useRouter();
  const { session, ready } = useSession();
  const restaurantId = session.waiter.restaurantId;

  const [orders, setOrders] = useState<QueueOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (ready && !restaurantId) router.replace("/");
  }, [ready, restaurantId, router]);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const res = await fetch(`/api/orders?restaurantId=${restaurantId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load the queue");
    setOrders(data);
  }, [restaurantId]);

  useEffect(() => {
    setOrders(null);
    load().catch((e) => setError(e.message));
  }, [load]);

  // The queue is shared — another device may place an order or a customer may
  // pay while this screen is open — so it refreshes itself rather than relying
  // on the waiter to reload. The clock ticks separately so that "18 min ago"
  // keeps climbing between fetches.
  useEffect(() => {
    const poll = setInterval(() => load().catch(() => {}), 10000);
    const tick = setInterval(() => setNow(new Date()), 15000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const { active, awaitingPayment, settled } = useMemo(() => {
    const all = orders ?? [];
    const byOldest = (a: QueueOrder, b: QueueOrder) =>
      new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
    return {
      active: all.filter((o) => o.status === "PLACED" || o.status === "PREPARING").sort(byOldest),
      awaitingPayment: all.filter((o) => o.status === "SERVED").sort(byOldest),
      settled: all
        .filter((o) => o.status === "PAID")
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
    };
  }, [orders]);

  if (!ready || (!orders && !error)) return <Spinner label="Loading the queue" />;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const lateCount = active.filter(
    (o) => waitProgress(new Date(o.orderDate), o.estimatedWaitTime, null, now).isOverdue
  ).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">Orders</h1>
        <p className="shrink-0 text-sm text-ink-soft">
          {active.length} to prepare
          {lateCount > 0 && <span className="text-danger"> · {lateCount} late</span>}
        </p>
      </div>

      {active.length === 0 && awaitingPayment.length === 0 ? (
        <EmptyState icon="☕" title="Nothing waiting">
          Every order here has been served and settled. New orders appear on
          their own — there is no need to refresh.
        </EmptyState>
      ) : (
        <>
          <Section title="Still to serve" count={active.length}>
            {active.map((o) => (
              <QueueCard key={o.id} order={o} now={now} />
            ))}
          </Section>

          <Section title="Served · waiting to pay" count={awaitingPayment.length}>
            {awaitingPayment.map((o) => (
              <QueueCard key={o.id} order={o} now={now} />
            ))}
          </Section>
        </>
      )}

      {settled.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowSettled((s) => !s)}
            aria-expanded={showSettled}
            className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            {showSettled ? "Hide" : "Show"} {settled.length} paid and closed
          </button>
          {showSettled && (
            <div className="animate-rise mt-3 flex flex-col gap-2">
              {settled.map((o) => (
                <QueueCard key={o.id} order={o} now={now} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 text-sm font-medium uppercase tracking-wide text-ink-faint">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

const STATUS_TONE = {
  PLACED: "warning",
  PREPARING: "accent",
  SERVED: "success",
  PAID: "neutral",
} as const;

const STATUS_TEXT = {
  PLACED: "New",
  PREPARING: "Preparing",
  SERVED: "Served",
  PAID: "Paid",
} as const;

function QueueCard({ order, now }: { order: QueueOrder; now: Date }) {
  const progress = waitProgress(
    new Date(order.orderDate),
    order.estimatedWaitTime,
    order.servedAt ? new Date(order.servedAt) : null,
    now
  );
  const live = order.status === "PLACED" || order.status === "PREPARING";
  const openComplaints = order.complaints.filter((c) => c.status !== "RESOLVED").length;
  const portions = order.items.reduce((n, l) => n + l.quantity, 0);

  return (
    <Link
      href={`/waiter/orders/${order.reference}`}
      className={`block rounded-2xl border p-4 transition hover:border-border-strong ${
        live && progress.isOverdue
          ? "border-danger/40 bg-danger-soft/40"
          : "border-border-subtle bg-surface-raised"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* The table number is what a waiter navigates by, so it leads. */}
        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-sunken">
          <span className="text-[10px] leading-none text-ink-faint">Table</span>
          <span className="font-display text-lg leading-tight text-ink">
            {order.tableNumber}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">{order.reference}</span>
            <Badge tone={STATUS_TONE[order.status]}>{STATUS_TEXT[order.status]}</Badge>
            {openComplaints > 0 && <Badge tone="danger">⚠ Complaint</Badge>}
            {order.rating && <Badge tone="neutral">{order.rating.value}★</Badge>}
          </div>

          <p className="mt-1 truncate text-sm text-ink-soft">
            {order.customer.firstName} · {portions} item{portions === 1 ? "" : "s"} ·{" "}
            {naira(order.orderTotal)}
          </p>

          <p className="mt-0.5 text-xs">
            {live ? (
              progress.isOverdue ? (
                <span className="font-medium text-danger">
                  {minutes(progress.overdueByMinutes)} over the {minutes(order.estimatedWaitTime)}{" "}
                  quoted
                </span>
              ) : (
                <span className="text-ink-faint">
                  {minutes(progress.remainingMinutes)} left of {minutes(order.estimatedWaitTime)}
                </span>
              )
            ) : (
              <span className="text-ink-faint">
                Placed {clockTime(order.orderDate)}
                {order.servedAt && ` · served in ${minutes(progress.elapsedMinutes)}`}
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
