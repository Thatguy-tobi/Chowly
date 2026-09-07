"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { naira, minutes } from "@/lib/format";
import { Card, ErrorNote, QueueSkeleton } from "@/components/ui";

type Summary = {
  orders: number;
  byStatus: { PLACED: number; PREPARING: number; SERVED: number; PAID: number };
  takings: number;
  owed: number;
  avgQuotedMinutes: number | null;
  avgActualMinutes: number | null;
  servedCount: number;
  lateCount: number;
  ratingCount: number;
  avgRating: number | null;
  ratingSpread: number[];
  complaints: number;
  openComplaints: number;
};

type Stats = {
  restaurantCount: number;
  group: Summary;
  byRestaurant: (Summary & { id: string; name: string })[];
  topItems: { name: string; emoji: string | null; portions: number; revenue: number }[];
};

/**
 * What the twelve restaurants look like taken together.
 *
 * Deliberately group-wide: there are around fifty orders spread across twelve
 * restaurants, so any single one of them is four rows and a lot of white space.
 * Read together they say something, and the per-restaurant table underneath
 * still lets you pick one out.
 *
 * Every figure comes from the database by way of /api/stats, so nothing here is
 * assembled out of whatever the browser happened to have loaded.
 */
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load the figures");
        return d;
      })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!stats) return <QueueSkeleton />;

  const g = stats.group;
  const onTime = g.servedCount - g.lateCount;
  const onTimePct = g.servedCount ? Math.round((onTime / g.servedCount) * 100) : 0;
  const maxRating = Math.max(1, ...g.ratingSpread);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">How service is going</h1>
        <Link href="/waiter" className="shrink-0 text-sm text-accent hover:underline">
          Back to orders
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Across all {stats.restaurantCount} restaurants · {g.orders} orders
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Figure label="Taken" value={naira(g.takings)} note={`${naira(g.owed)} still owed`} />
        <Figure
          label="Average wait"
          value={g.avgActualMinutes !== null ? minutes(Math.round(g.avgActualMinutes)) : "—"}
          note={
            g.avgQuotedMinutes !== null
              ? `against ${minutes(Math.round(g.avgQuotedMinutes))} quoted`
              : undefined
          }
          tone={
            g.avgActualMinutes !== null &&
            g.avgQuotedMinutes !== null &&
            g.avgActualMinutes > g.avgQuotedMinutes
              ? "bad"
              : "good"
          }
        />
        <Figure
          label="Served on time"
          value={`${onTimePct}%`}
          note={`${onTime} of ${g.servedCount} within the quote`}
          tone={onTimePct >= 50 ? "good" : "bad"}
        />
        <Figure
          label="Average rating"
          value={g.avgRating !== null ? `${g.avgRating} / 5` : "—"}
          note={`${g.ratingCount} rated`}
          tone={g.avgRating !== null && g.avgRating >= 3.5 ? "good" : "bad"}
        />
      </div>

      {/* Where the orders currently are */}
      <Card className="mt-4 p-4">
        <h2 className="text-sm font-medium text-ink">Where the orders are</h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[
            ["Waiting", g.byStatus.PLACED],
            ["Being prepared", g.byStatus.PREPARING],
            ["Served, unpaid", g.byStatus.SERVED],
            ["Paid", g.byStatus.PAID],
          ].map(([label, n]) => (
            <div key={label as string}>
              <span className="font-display text-xl text-ink tabular-nums">{n as number}</span>{" "}
              <span className="text-ink-soft">{label as string}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink">What customers scored their meals</h2>
          <span className="text-xs text-ink-faint">{g.ratingCount} ratings</span>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = g.ratingSpread[star - 1] ?? 0;
            return (
              <div key={star} className="flex items-center gap-2.5">
                <span className="w-8 shrink-0 text-xs text-ink-soft tabular-nums">{star}★</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className={`h-full rounded-full ${star >= 4 ? "bg-success" : star === 3 ? "bg-warning" : "bg-danger"}`}
                    style={{ width: `${(count / maxRating) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-ink-faint tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          {g.complaints} complaint{g.complaints === 1 ? "" : "s"} in total,{" "}
          {g.openComplaints} still open.
        </p>
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="text-sm font-medium text-ink">Most ordered</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {stats.topItems.map((t) => (
            <li key={t.name} className="flex items-center gap-3">
              <span aria-hidden className="text-lg">
                {t.emoji ?? "🍽️"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.name}</span>
              <span className="shrink-0 text-sm text-ink-soft tabular-nums">
                {t.portions} portions
              </span>
              <span className="w-24 shrink-0 text-right text-sm font-medium text-ink tabular-nums">
                {naira(t.revenue)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mt-7 mb-2.5 text-sm font-medium uppercase tracking-wide text-ink-faint">
        By restaurant
      </h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-ink-faint">
              <th className="p-3 font-medium">Restaurant</th>
              <th className="p-3 text-right font-medium">Orders</th>
              <th className="p-3 text-right font-medium">Taken</th>
              <th className="p-3 text-right font-medium">Wait</th>
              <th className="p-3 text-right font-medium">Rating</th>
              <th className="p-3 text-right font-medium">Open</th>
            </tr>
          </thead>
          <tbody>
            {stats.byRestaurant.map((r) => (
              <tr key={r.id} className="border-b border-border-subtle last:border-0">
                <td className="p-3 text-ink">{r.name}</td>
                <td className="p-3 text-right text-ink-soft tabular-nums">{r.orders}</td>
                <td className="p-3 text-right text-ink-soft tabular-nums">{naira(r.takings)}</td>
                <td className="p-3 text-right tabular-nums">
                  {r.avgActualMinutes !== null ? (
                    <span
                      className={
                        r.avgQuotedMinutes !== null && r.avgActualMinutes > r.avgQuotedMinutes
                          ? "text-danger"
                          : "text-ink-soft"
                      }
                    >
                      {Math.round(r.avgActualMinutes)}m
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="p-3 text-right text-ink-soft tabular-nums">
                  {r.avgRating !== null ? `${r.avgRating}★` : "—"}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {r.openComplaints > 0 ? (
                    <span className="text-danger">{r.openComplaints}</span>
                  ) : (
                    <span className="text-ink-faint">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-ink-faint">
        “Wait” is how long orders actually took, measured from when they were
        placed to when they reached the table. Red means it ran over the time
        quoted to the customer.
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "bad";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p
        className={`mt-1 font-display text-2xl tabular-nums ${
          tone === "bad" ? "text-danger" : tone === "good" ? "text-success" : "text-ink"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-ink-soft">{note}</p>}
    </Card>
  );
}
