import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createRatingSchema } from "@/lib/validation";

/**
 * POST /api/orders/:id/rating
 *
 * Requirement 4 — a rating from 1 to 5 stored against the order.
 *
 * The model says an order may have one rating (1:0..1), and the schema puts a
 * unique constraint on Rating.orderId to enforce it. Rating again therefore
 * replaces the previous score rather than adding a second one — a customer
 * changing their mind is reasonable, two ratings on one order is not.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = createRatingSchema.parse(await req.json());

    const order = await prisma.customerOrder.findFirst({
      where: { OR: [{ id }, { reference: id }] },
      select: { id: true, customerId: true, status: true },
    });
    if (!order) return fail("That order does not exist", 404);
    if (order.status === "PLACED") {
      return fail("This order has not been prepared yet, so there is nothing to rate", 409);
    }

    const rating = await prisma.rating.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        customerId: order.customerId,
        value: body.value,
        comment: body.comment ?? null,
      },
      update: { value: body.value, comment: body.comment ?? null, ratingDate: new Date() },
    });

    return ok(rating, 201);
  } catch (error) {
    return handleError(error);
  }
}
