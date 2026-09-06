import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createOrderSchema } from "@/lib/validation";
import { estimateWaitMinutes } from "@/lib/wait-time";

/**
 * GET /api/orders
 *
 *   ?customerId=…                 the customer's own orders, across restaurants
 *   ?restaurantId=…[&status=…]    the waiter's queue for one restaurant
 *
 * A customer's orders are deliberately NOT filtered by restaurant. If you
 * ordered at Mood Lagos and are now looking at Terra Kulture, hiding your
 * order would be the wrong answer — so each one is labelled with where it
 * was placed instead.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId");
    const restaurantId = url.searchParams.get("restaurantId");
    const status = url.searchParams.get("status");

    if (!customerId && !restaurantId) {
      return fail("Provide either customerId or restaurantId", 400);
    }

    const where: Prisma.CustomerOrderWhereInput = {};
    if (customerId) where.customerId = customerId;
    if (restaurantId) where.restaurantId = restaurantId;
    if (status) {
      const allowed = ["PLACED", "PREPARING", "SERVED", "PAID"];
      if (!allowed.includes(status)) return fail("Unknown status", 400);
      where.status = status as Prisma.EnumOrderStatusFilter["equals"];
    }

    const orders = await prisma.customerOrder.findMany({
      where,
      orderBy: { orderDate: "desc" },
      include: {
        restaurant: { select: { id: true, name: true } },
        customer: { select: { id: true, firstName: true } },
        waiter: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, emoji: true, preparationTimeMinutes: true } },
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

    return ok(orders);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/orders
 *
 * Requirement 2. The customer's chosen items are priced from the database
 * rather than from anything the browser sent, the total and the estimated wait
 * are computed here, and a waiter is assigned straight away.
 */
export async function POST(req: Request) {
  try {
    const body = createOrderSchema.parse(await req.json());

    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
      select: { id: true },
    });
    if (!customer) return fail("That customer does not exist", 404);

    // Load the chosen items and confirm every one of them is actually on a
    // live menu at this restaurant. Prices come from here, never from the
    // request body — otherwise the browser could name its own price.
    const ids = body.items.map((i) => i.itemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: ids },
        isAvailable: true,
        menu: { restaurantId: body.restaurantId, isActive: true },
      },
      include: { category: { select: { type: true } } },
    });

    if (menuItems.length !== new Set(ids).size) {
      return fail("Some of those items are not available at this restaurant", 400);
    }

    const priced = body.items.map((line) => {
      const item = menuItems.find((m) => m.id === line.itemId)!;
      const unitPrice = Number(item.price);
      return {
        itemId: item.id,
        quantity: line.quantity,
        unitPrice,
        subtotal: unitPrice * line.quantity,
        preparationTimeMinutes: item.preparationTimeMinutes,
        categoryType: item.category.type,
      };
    });

    const orderTotal = priced.reduce((sum, l) => sum + l.subtotal, 0);
    const estimatedWaitTime = estimateWaitMinutes(priced);

    // Assign the waiter with the fewest orders still in progress, so a busy
    // shift spreads across the floor instead of landing on one person.
    const waiters = await prisma.staff.findMany({
      where: { restaurantId: body.restaurantId, role: "WAITER" },
      select: {
        id: true,
        _count: { select: { ordersAsWaiter: { where: { status: { in: ["PLACED", "PREPARING"] } } } } },
      },
    });
    if (waiters.length === 0) {
      return fail("This restaurant has no waiter on duty", 409);
    }
    const waiter = waiters.sort((a, b) => a._count.ordersAsWaiter - b._count.ordersAsWaiter)[0];

    // The reference is what the customer and the waiter say out loud, so it
    // has to be short and readable. It is unique in the database, so on the
    // rare collision of two simultaneous orders we simply try the next number.
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await prisma.customerOrder.count();
      const reference = `ORD${String(count + 1 + attempt).padStart(3, "0")}`;
      try {
        const order = await prisma.customerOrder.create({
          data: {
            reference,
            customerId: body.customerId,
            restaurantId: body.restaurantId,
            waiterId: waiter.id,
            tableNumber: body.tableNumber,
            status: "PLACED",
            estimatedWaitTime,
            orderTotal,
            items: {
              create: priced.map((l) => ({
                itemId: l.itemId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                subtotal: l.subtotal,
              })),
            },
          },
          include: {
            restaurant: { select: { id: true, name: true } },
            waiter: { select: { id: true, firstName: true, lastName: true } },
            items: { include: { item: { select: { id: true, name: true, emoji: true } } } },
          },
        });
        return ok(order, 201);
      } catch (error) {
        const clash =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!clash) throw error;
      }
    }

    return fail("Could not allocate an order reference, please try again", 503);
  } catch (error) {
    return handleError(error);
  }
}
