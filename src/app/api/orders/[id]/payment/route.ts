import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createPaymentSchema } from "@/lib/validation";

/**
 * POST /api/orders/:id/payment
 *
 * Requirement 5 — records the payment and marks the order paid. The brief
 * allows the payment to be pretend, but requires it to be recorded and clearly
 * labelled as pretend.
 *
 * NO MONEY MOVES HERE. Nothing is charged, no card details are taken, and no
 * payment provider is contacted. The row written carries isPretend = true, so
 * the label lives in the data itself and survives being read straight out of
 * the database, rather than being a caption in the interface that could be
 * mistaken for a real transaction.
 *
 * The amount is taken from the order total in the database, never from the
 * request, so a customer cannot decide what their meal costs. Payment.orderId
 * is unique, so an order cannot be paid for twice.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = createPaymentSchema.parse(await req.json());

    const order = await prisma.customerOrder.findFirst({
      where: { OR: [{ id }, { reference: id }] },
      include: { payment: true },
    });
    if (!order) return fail("That order does not exist", 404);
    if (order.payment) return fail("This order has already been paid for", 409);
    if (order.status === "PLACED") {
      return fail("This order has not been prepared yet", 409);
    }

    const reference = `CHW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${order.reference}`;

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.orderTotal, // from the database, not the request
          method: body.method,
          status: "SUCCESSFUL",
          transactionReference: reference,
          isPretend: true, // requirement 5 — recorded, and labelled in the data
        },
      }),
      prisma.customerOrder.update({
        where: { id: order.id },
        data: { status: "PAID" },
      }),
    ]);

    return ok({ ...payment, pretendNotice: "Simulated payment. No money was transferred." }, 201);
  } catch (error) {
    return handleError(error);
  }
}
