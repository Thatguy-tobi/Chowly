"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { naira, dateAndTime, statusLabel } from "@/lib/format";
import { Badge, ButtonLink, Card, EmptyState, Spinner } from "@/components/ui";

type OrderSummary = {
  id: string;
  reference: string;
  status: "PLACED" | "PREPARING" | "SERVED" | "PAID";
  orderDate: string;
  tableNumber: number;
  orderTotal: number;
  restaurant: { id: string; name: string };
  items: { quantity: number; item: { name: string; emoji: string | null } }[];
  rating: { value: number } | null;
  complaints: { id: string }[];
};

const TONE = {
  PLACED: "accent",
  PREPARING: "warning",
  SERVED: "success",
  PAID: "neutral",
} as const;

/**
 * Everything this customer has ordered.
 *
 * Deliberately not filtered by the restaurant currently being viewed: if you
 * ordered at Mood Lagos and have since switched to Terra Kulture, your order
 * has not stopped existing. Each one is labelled with where it was placed.
 */
export default function OrdersPage() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  const customerId = session.customer.customerId;

  useEffect(() => {
    if (!ready) return;
    if (!customerId) {
      router.replace("/");
      return;
    }
    fetch(`/api/orders?customerId=${customerId}`)
      .then((r) => r.json())
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [ready, customerId, router]);

  if (!ready || !orders) return <Spinner label="Loading your orders" />;

  if (orders.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <EmptyState
          icon="🍽️"
          title="No orders yet"
          action={<ButtonLink href="/menu">Browse the menu</ButtonLink>}
        >
          Anything you order will appear here, and stay here after you refresh.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl text-ink">Your orders</h1>
      <p className="text-sm text-ink-soft">{session.customer.name}</p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/orders/${order.reference}`} className="block">
              <Card className="p-4 transition hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{order.reference}</p>
                    <p className="text-xs text-ink-faint">
                      {order.restaurant.name} · table {order.tableNumber}
                    </p>
                  </div>
                  <Badge tone={TONE[order.status]}>{statusLabel(order.status)}</Badge>
                </div>

                <p className="mt-2.5 truncate text-sm text-ink-soft">
                  {order.items
                    .map((l) => `${l.item.emoji ?? ""} ${l.quantity}× ${l.item.name}`)
                    .join("  ·  ")}
                </p>

                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-xs text-ink-faint">
                    {dateAndTime(order.orderDate)}
                  </span>
                  <div className="flex items-center gap-2">
                    {order.complaints.length > 0 && <Badge tone="danger">Complaint</Badge>}
                    {order.rating && <Badge>{"⭐".repeat(order.rating.value)}</Badge>}
                    <span className="text-sm font-semibold text-ink">
                      {naira(order.orderTotal)}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
