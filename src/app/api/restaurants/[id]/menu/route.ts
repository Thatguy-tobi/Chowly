import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";

/**
 * GET /api/restaurants/:id/menu
 *
 * The menu as the customer needs to read it: available items only, grouped by
 * category, with food and drinks separated. Every item carries its price and
 * its preparation time, which is what requirement 1 asks for.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: { id: true, name: true, address: true, openingTime: true, closingTime: true },
    });
    if (!restaurant) return fail("That restaurant does not exist", 404);

    const items = await prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        menu: { restaurantId: id, isActive: true },
      },
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    });

    // Group by category, preserving the sort order the query already applied.
    const byCategory = new Map<
      string,
      {
        id: string;
        name: string;
        type: "FOOD" | "DRINK";
        items: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          preparationTimeMinutes: number;
          emoji: string | null;
        }[];
      }
    >();

    for (const item of items) {
      let group = byCategory.get(item.categoryId);
      if (!group) {
        group = {
          id: item.category.id,
          name: item.category.name,
          type: item.category.type,
          items: [],
        };
        byCategory.set(item.categoryId, group);
      }
      group.items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        preparationTimeMinutes: item.preparationTimeMinutes,
        emoji: item.emoji,
      });
    }

    const categories = [...byCategory.values()];

    return ok({
      restaurant,
      food: categories.filter((c) => c.type === "FOOD"),
      drinks: categories.filter((c) => c.type === "DRINK"),
      itemCount: items.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
