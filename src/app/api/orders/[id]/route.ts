import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";

/**
 * GET /api/orders/:id
 *
 * Everything about one order — its items, who is preparing it, and any
 * complaint, rating or payment against it. Accepts either the generated id or
 * the human reference such as ORD046, because the reference is what appears on
 * screen and what a waiter would be told.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const order = await prisma.customerOrder.findFirst({
      where: { OR: [{ id }, { reference: id }] },
      include: {
        restaurant: { select: { id: true, name: true, address: true } },
        customer: { select: { id: true, firstName: true } },
        waiter: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                emoji: true,
                preparationTimeMinutes: true,
                category: { select: { name: true, type: true } },
              },
            },
          },
        },
        preparation: {
          include: {
            chef: { select: { id: true, firstName: true, lastName: true } },
            bartender: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        payment: true,
        rating: true,
        complaints: { orderBy: { complaintDate: "desc" } },
      },
    });

    if (!order) return fail("That order does not exist", 404);
    return ok(order);
  } catch (error) {
    return handleError(error);
  }
}
