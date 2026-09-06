/**
 * Presentation helpers. Prices are whole naira throughout — the menu has no
 * kobo — so amounts are handled as integers and never as floats.
 */

export function naira(amount: number | string): string {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

export function minutes(value: number): string {
  if (value < 60) return `${value} min`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function clockTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function dateAndTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const STATUS_LABELS = {
  PLACED: "Order placed",
  PREPARING: "Being prepared",
  SERVED: "Served",
  PAID: "Paid",
} as const;

export function statusLabel(status: keyof typeof STATUS_LABELS): string {
  return STATUS_LABELS[status];
}

export function staffName(s: { firstName: string; lastName: string } | null | undefined): string {
  return s ? `${s.firstName} ${s.lastName}` : "—";
}
