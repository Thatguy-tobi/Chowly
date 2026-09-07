import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createMenuSchema } from "@/lib/validation";

/**
 * GET /api/menus?restaurantId=… — a restaurant's menus and what is on them.
 *
 * Unlike the customer's menu endpoint this returns inactive menus and
 * unavailable items too, because the point of the admin view is to see and
 * manage everything, not only what is currently on sale.
 */
export async function GET(req: Request) {
  try {
    const restaurantId = new URL(req.url).searchParams.get("restaurantId");
    if (!restaurantId) return fail("restaurantId is required", 400);

    const menus = await prisma.menu.findMany({
      where: { restaurantId },
      orderBy: { createdDate: "asc" },
      include: {
        items: {
          orderBy: { name: "asc" },
          include: { category: { select: { name: true, type: true } } },
        },
      },
    });

    return ok(
      menus.map((m) => ({
        ...m,
        items: m.items.map((i) => ({ ...i, price: Number(i.price) })),
      }))
    );
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/menus — add a menu to a restaurant.
 *
 * A menu is the thing that owns items, so a restaurant needs at least one
 * before anything can be put on sale. New menus are active immediately, which
 * is what makes their items reachable by the customer's menu endpoint.
 */
export async function POST(req: Request) {
  try {
    const body = createMenuSchema.parse(await req.json());

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: body.restaurantId },
      select: { id: true },
    });
    if (!restaurant) return fail("That restaurant does not exist", 404);

    const menu = await prisma.menu.create({
      data: {
        restaurantId: body.restaurantId,
        name: body.name,
        description: body.description ?? null,
      },
    });

    return ok(menu, 201);
  } catch (error) {
    return handleError(error);
  }
}
