import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { updateStatusSchema } from "@/lib/validation";

/**
 * PATCH /api/orders/:id/status
 *
 * The waiter marking an order as served. PAID is not settable here — that only
 * happens by actually recording a payment, so an order cannot be marked paid
 * without a Payment row to show for it.
 *
 * An order cannot be served before somebody has been recorded as preparing it,
 * which keeps requirement 3 from being skipped over.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = updateStatusSchema.parse(await req.json());

    const order = await prisma.customerOrder.findFirst({
      where: { OR: [{ id }, { reference: id }] },
      include: { preparation: true },
    });
    if (!order) return fail("That order does not exist", 404);
    if (order.status === "PAID") return fail("This order has already been paid for", 409);

    if (status === "SERVED") {
      if (!order.preparation) {
        return fail("Record who prepared this order before marking it served", 409);
      }

      const now = new Date();
      const updated = await prisma.customerOrder.update({
        where: { id: order.id },
        data: {
          status: "SERVED",
          servedAt: now,
          preparation: { update: { preparationEnd: now } },
        },
        include: {
          preparation: {
            include: {
              chef: { select: { firstName: true, lastName: true } },
              bartender: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      return ok(updated);
    }

    const updated = await prisma.customerOrder.update({
      where: { id: order.id },
      data: { status: "PREPARING" },
    });
    return ok(updated);
  } catch (error) {
    return handleError(error);
  }
}
