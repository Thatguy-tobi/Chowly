import { prisma } from "@/lib/prisma";
import { handleError, ok } from "@/lib/api";

/**
 * GET /api/stats
 *
 * Everything the dashboard reports, computed here rather than in the browser so
 * the figures come from the database and cannot be assembled out of whatever
 * happened to be loaded on screen.
 *
 * This is deliberately group-wide with a per-restaurant breakdown rather than
 * one restaurant at a time: there are twelve restaurants and around fifty
 * orders between them, so a single restaurant's page would be four rows and a
 * lot of white space. Read together they actually say something.
 *
 * Money is stored as Decimal and converted with Number() only at the point of
 * output. Every price in this application is whole naira, so nothing is lost.
 */
const n = (v: unknown) => Number(v);

export async function GET() {
  try {
    const [restaurants, orders] = await Promise.all([
      prisma.restaurant.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.customerOrder.findMany({
        select: {
          restaurantId: true,
          status: true,
          orderDate: true,
          servedAt: true,
          estimatedWaitTime: true,
          orderTotal: true,
          payment: { select: { amount: true } },
          rating: { select: { value: true } },
          complaints: { select: { status: true } },
          items: {
            select: {
              quantity: true,
              subtotal: true,
              item: { select: { id: true, name: true, emoji: true } },
            },
          },
        },
      }),
    ]);

    /** Minutes actually taken, for an order that reached the table. */
    const actualMinutes = (o: (typeof orders)[number]) =>
      o.servedAt
        ? Math.max(0, Math.round((o.servedAt.getTime() - o.orderDate.getTime()) / 60000))
        : null;

    const summarise = (rows: typeof orders) => {
      const served = rows.filter((o) => o.servedAt !== null);
      const actuals = served.map((o) => actualMinutes(o)!).filter((m) => m !== null);
      const rated = rows.filter((o) => o.rating);
      const late = served.filter((o) => actualMinutes(o)! > o.estimatedWaitTime);

      const avg = (xs: number[]) =>
        xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

      return {
        orders: rows.length,
        byStatus: {
          PLACED: rows.filter((o) => o.status === "PLACED").length,
          PREPARING: rows.filter((o) => o.status === "PREPARING").length,
          SERVED: rows.filter((o) => o.status === "SERVED").length,
          PAID: rows.filter((o) => o.status === "PAID").length,
        },
        // Takings are the sum of payments actually recorded, not of order
        // totals — an unpaid order is money owed, not money taken.
        takings: rows.reduce((sum, o) => sum + (o.payment ? n(o.payment.amount) : 0), 0),
        owed: rows
          .filter((o) => !o.payment)
          .reduce((sum, o) => sum + n(o.orderTotal), 0),
        avgQuotedMinutes: avg(rows.map((o) => o.estimatedWaitTime)),
        avgActualMinutes: avg(actuals),
        servedCount: served.length,
        lateCount: late.length,
        ratingCount: rated.length,
        avgRating: avg(rated.map((o) => o.rating!.value)),
        ratingSpread: [1, 2, 3, 4, 5].map(
          (v) => rated.filter((o) => o.rating!.value === v).length
        ),
        complaints: rows.reduce((sum, o) => sum + o.complaints.length, 0),
        openComplaints: rows.reduce(
          (sum, o) => sum + o.complaints.filter((c) => c.status !== "RESOLVED").length,
          0
        ),
      };
    };

    // Most ordered dishes across the group, by portions rather than by revenue —
    // the question is what the kitchens actually make most of.
    const tally = new Map<
      string,
      { name: string; emoji: string | null; portions: number; revenue: number }
    >();
    for (const o of orders) {
      for (const line of o.items) {
        const e = tally.get(line.item.id) ?? {
          name: line.item.name,
          emoji: line.item.emoji,
          portions: 0,
          revenue: 0,
        };
        e.portions += line.quantity;
        e.revenue += n(line.subtotal);
        tally.set(line.item.id, e);
      }
    }
    const topItems = [...tally.values()]
      .sort((a, b) => b.portions - a.portions || b.revenue - a.revenue)
      .slice(0, 6);

    const byRestaurant = restaurants
      .map((r) => ({
        id: r.id,
        name: r.name,
        ...summarise(orders.filter((o) => o.restaurantId === r.id)),
      }))
      .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));

    return ok({
      restaurantCount: restaurants.length,
      group: summarise(orders),
      byRestaurant,
      topItems,
    });
  } catch (error) {
    return handleError(error);
  }
}
