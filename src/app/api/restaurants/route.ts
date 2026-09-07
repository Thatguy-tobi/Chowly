import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createRestaurantSchema } from "@/lib/validation";

/**
 * GET /api/restaurants — every restaurant on the platform, for the picker.
 *
 * Each one carries canTakeOrders, which is the same test the order endpoint
 * applies: an order is refused unless a waiter can be assigned to it, and there
 * is nothing to order unless something is available on an active menu. Working
 * that out here rather than in the browser means the picker cannot offer a
 * restaurant that would then reject the order at the checkout — which is what
 * happened to the first restaurant registered through the admin pages.
 */
export async function GET() {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        openingTime: true,
        closingTime: true,
        _count: { select: { menus: true, staff: true } },
      },
    });

    const [waiterCounts, itemCounts] = await Promise.all([
      prisma.staff.groupBy({
        by: ["restaurantId"],
        where: { role: "WAITER" },
        _count: { _all: true },
      }),
      prisma.menuItem.groupBy({
        by: ["menuId"],
        where: { isAvailable: true, menu: { isActive: true } },
        _count: { _all: true },
      }),
    ]);

    // menuId → restaurantId, so available items can be counted per restaurant.
    const menus = await prisma.menu.findMany({
      where: { isActive: true },
      select: { id: true, restaurantId: true },
    });
    const itemsByRestaurant = new Map<string, number>();
    for (const row of itemCounts) {
      const menu = menus.find((m) => m.id === row.menuId);
      if (!menu) continue;
      itemsByRestaurant.set(
        menu.restaurantId,
        (itemsByRestaurant.get(menu.restaurantId) ?? 0) + row._count._all
      );
    }
    const waitersByRestaurant = new Map(
      waiterCounts.map((w) => [w.restaurantId, w._count._all])
    );

    return ok(
      restaurants.map((r) => {
        const waiters = waitersByRestaurant.get(r.id) ?? 0;
        const items = itemsByRestaurant.get(r.id) ?? 0;
        return {
          ...r,
          itemCount: items,
          canTakeOrders: waiters > 0 && items > 0,
        };
      })
    );
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/restaurants — register a new restaurant.
 *
 * The brief only requires a menu that I loaded myself, which the seeded data
 * already satisfies; this is the admin side, so a restaurant can be added
 * without editing the seed. There is no login anywhere in this application, so
 * this endpoint is open — see the note on the admin page. That is acceptable
 * for an assignment and would not be outside one.
 */
export async function POST(req: Request) {
  try {
    const body = createRestaurantSchema.parse(await req.json());

    // Two restaurants of the same name at the same address is a duplicate
    // rather than a second branch, and the customer picker would be unusable.
    const clash = await prisma.restaurant.findFirst({
      where: {
        name: { equals: body.name, mode: "insensitive" },
        address: { equals: body.address, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (clash) return fail("A restaurant with that name and address already exists", 409);

    const restaurant = await prisma.restaurant.create({ data: body });
    return ok(restaurant, 201);
  } catch (error) {
    return handleError(error);
  }
}
