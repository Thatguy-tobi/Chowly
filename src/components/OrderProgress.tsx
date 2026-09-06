"use client";

import { useEffect, useState } from "react";
import { minutes } from "@/lib/format";
import { waitProgress } from "@/lib/wait-time";

type Status = "PLACED" | "PREPARING" | "SERVED" | "PAID";

const STEPS: { status: Status; label: string; hint: string }[] = [
  { status: "PLACED", label: "Order placed", hint: "Sent to the kitchen" },
  { status: "PREPARING", label: "Being prepared", hint: "Chef and bartender at work" },
  { status: "SERVED", label: "Served", hint: "At your table" },
  { status: "PAID", label: "Paid", hint: "Settled" },
];

/**
 * The live part of requirement 2 — the waiting time, counting down.
 *
 * While the order is still coming the clock ticks every second, so the screen
 * is visibly alive rather than a number that only changes on refresh. Once the
 * order has been served the clock stops and reports how long it actually took,
 * which is also what tells the customer whether they have something to complain
 * about.
 */
export function OrderProgress({
  status,
  orderDate,
  estimatedWaitTime,
  servedAt,
}: {
  status: Status;
  orderDate: string;
  estimatedWaitTime: number;
  servedAt: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  const settled = status === "SERVED" || status === "PAID";

  useEffect(() => {
    if (settled) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [settled]);

  const progress = waitProgress(
    new Date(orderDate),
    estimatedWaitTime,
    servedAt ? new Date(servedAt) : null,
    now
  );

  const currentIndex = STEPS.findIndex((s) => s.status === status);

  return (
    <div>
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
        {settled ? (
          <div className="text-center">
            <p className="text-sm text-ink-soft">
              {status === "PAID" ? "Paid and closed" : "Served"}
            </p>
            <p className="mt-1 font-display text-2xl text-ink">
              Took {minutes(progress.elapsedMinutes)}
            </p>
            <p className="mt-1 text-sm text-ink-faint">
              {progress.isOverdue
                ? `${minutes(progress.overdueByMinutes)} over the ${minutes(estimatedWaitTime)} quoted`
                : `Within the ${minutes(estimatedWaitTime)} quoted`}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-ink-soft">
              {progress.isOverdue ? "Running late" : "Ready in about"}
            </p>
            <p
              className={`mt-1 font-display text-4xl tabular-nums ${
                progress.isOverdue ? "text-danger" : "text-ink"
              }`}
            >
              {progress.isOverdue
                ? `+${progress.overdueByMinutes}`
                : progress.remainingMinutes}
              <span className="ml-1 text-lg text-ink-faint">min</span>
            </p>
            <p className="mt-1 text-sm text-ink-faint">
              {progress.isOverdue
                ? `Past the ${minutes(estimatedWaitTime)} we quoted`
                : `Quoted ${minutes(estimatedWaitTime)} · ${minutes(progress.elapsedMinutes)} so far`}
            </p>

            <div
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={estimatedWaitTime}
              aria-valuenow={progress.elapsedMinutes}
              aria-label="Progress towards the estimated wait"
            >
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  progress.isOverdue ? "bg-danger" : "bg-accent"
                }`}
                style={{ width: `${Math.max(3, progress.fraction * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ol className="mt-4 flex flex-col gap-0.5">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.status} className="flex items-start gap-3">
              <div className="flex flex-col items-center self-stretch">
                <span
                  aria-hidden
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] ${
                    done
                      ? "border-success bg-success text-white"
                      : active
                        ? "border-accent bg-accent-soft text-accent animate-pulse-soft"
                        : "border-border-strong bg-surface"
                  }`}
                >
                  {done ? "✓" : ""}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={`w-0.5 flex-1 ${done ? "bg-success" : "bg-border-subtle"}`}
                  />
                )}
              </div>
              <div className={`pb-4 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                <p
                  className={`text-sm font-medium ${
                    active ? "text-accent" : done ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-ink-faint">{step.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
