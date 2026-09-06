import { prisma } from "@/lib/prisma";
import { handleError, ok } from "@/lib/api";

/** GET /api/restaurants — every restaurant on the platform, for the picker. */
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
    return ok(restaurants);
  } catch (error) {
    return handleError(error);
  }
}
