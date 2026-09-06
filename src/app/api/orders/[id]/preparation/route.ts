import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { recordPreparationSchema } from "@/lib/validation";

/**
 * PATCH /api/orders/:id/preparation
 *
 * Requirement 3 — the waiter opens an order and records the chef and the
 * bartender who prepared it.
 *
 * Both are optional individually because a drinks-only order has no chef and a
 * food-only order has no bartender, but at least one must be given. The staff
 * named must work at the restaurant the order was placed in, and must actually
 * hold the role being recorded: a waiter cannot be entered as the chef.
 *
 * Recording preparation moves the order to PREPARING, which is what puts it in
 * front of the customer as "being prepared".
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = recordPreparationSchema.parse(await req.json());

    const order = await prisma.customerOrder.findFirst({
      where: { OR: [{ id }, { reference: id }] },
      include: {
        items: { include: { item: { select: { category: { select: { type: true } } } } } },
        preparation: true,
      },
    });
    if (!order) return fail("That order does not exist", 404);
    if (order.status === "PAID") {
      return fail("This order has already been paid for", 409);
    }

    const wantedChef = body.chefId ?? null;
    const wantedBartender = body.bartenderId ?? null;

    // Whoever is named must belong to this restaurant and hold that role.
    for (const [staffId, role] of [
      [wantedChef, "CHEF"],
      [wantedBartender, "BARTENDER"],
    ] as const) {
      if (!staffId) continue;
      const member = await prisma.staff.findFirst({
        where: { id: staffId, restaurantId: order.restaurantId, role },
        select: { id: true },
      });
      if (!member) {
        // Either they work somewhere else, or they work here in another role.
        return fail(`That staff member is not a ${role.toLowerCase()} at this restaurant`, 400);
      }
    }

    // An order with no food should not name a chef, and vice versa — the same
    // rule the seeded data follows.
    const hasFood = order.items.some((l) => l.item.category.type === "FOOD");
    const hasDrink = order.items.some((l) => l.item.category.type === "DRINK");
    if (wantedChef && !hasFood) return fail("This order has no food, so it has no chef", 400);
    if (wantedBartender && !hasDrink) return fail("This order has no drinks, so it has no bartender", 400);
    if (hasFood && !wantedChef) return fail("This order contains food, so a chef is required", 400);
    if (hasDrink && !wantedBartender) return fail("This order contains drinks, so a bartender is required", 400);

    const [, updated] = await prisma.$transaction([
      prisma.orderPreparation.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          chefId: wantedChef,
          bartenderId: wantedBartender,
          preparationStart: order.preparation?.preparationStart ?? new Date(),
        },
        update: { chefId: wantedChef, bartenderId: wantedBartender },
      }),
      prisma.customerOrder.update({
        where: { id: order.id },
        data: order.status === "PLACED" ? { status: "PREPARING" } : {},
        include: {
          preparation: {
            include: {
              chef: { select: { id: true, firstName: true, lastName: true } },
              bartender: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    return ok(updated);
  } catch (error) {
    return handleError(error);
  }
}
