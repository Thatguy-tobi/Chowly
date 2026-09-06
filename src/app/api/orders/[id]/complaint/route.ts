import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createComplaintSchema } from "@/lib/validation";

/**
 * POST /api/orders/:id/complaint
 *
 * Requirement 4 — the customer complains about an order and it is stored
 * against that order. The complaint is filed under the customer who placed the
 * order; it is not something the browser gets to choose, so a complaint can
 * never be attributed to the wrong person.
 *
 * More than one complaint per order is allowed, matching the model, where
 * Complaint is a many side of CustomerOrder rather than a one-to-one.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = createComplaintSchema.parse(await req.json());

    const order = await prisma.customerOrder.findFirst({
      where: { OR: [{ id }, { reference: id }] },
      select: { id: true, customerId: true },
    });
    if (!order) return fail("That order does not exist", 404);

    const complaint = await prisma.complaint.create({
      data: {
        orderId: order.id,
        customerId: order.customerId,
        complaintText: body.complaintText,
      },
    });

    return ok(complaint, 201);
  } catch (error) {
    return handleError(error);
  }
}
