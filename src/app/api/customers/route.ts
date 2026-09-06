import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createCustomerSchema } from "@/lib/validation";

/**
 * POST /api/customers
 *
 * There is no login (requirement 6), but an order still has to belong to a
 * Customer. A person sitting down gives a name and a table number, and that is
 * all we ask of them — so surname, phone and email stay null.
 *
 * The same name is reused rather than duplicated: someone who returns to the
 * same restaurant keeps their order history instead of becoming a second
 * customer. Names are matched case-insensitively and scoped to the restaurant,
 * so a "Tobi" at Mood Lagos is not confused with a different "Tobi" elsewhere.
 */
export async function POST(req: Request) {
  try {
    const body = createCustomerSchema.parse(await req.json());

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: body.restaurantId },
      select: { id: true },
    });
    if (!restaurant) return fail("That restaurant does not exist", 404);

    const existing = await prisma.customer.findFirst({
      where: {
        firstName: { equals: body.name, mode: "insensitive" },
        orders: { some: { restaurantId: body.restaurantId } },
      },
      orderBy: { registrationDate: "desc" },
    });

    const customer =
      existing ??
      (await prisma.customer.create({
        data: { firstName: body.name },
      }));

    return ok({
      id: customer.id,
      name: customer.firstName,
      tableNumber: body.tableNumber,
      restaurantId: body.restaurantId,
      returning: existing !== null,
    });
  } catch (error) {
    return handleError(error);
  }
}
