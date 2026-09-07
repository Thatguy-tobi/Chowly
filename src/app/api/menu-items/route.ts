import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createMenuItemSchema } from "@/lib/validation";

/**
 * POST /api/menu-items — put a dish or a drink on a menu.
 *
 * Requirement 1 asks that every item carry a name, a price and a preparation
 * time, so all three are required here rather than optional. The preparation
 * time is not decoration: it is what the wait quoted to a customer is computed
 * from, and an item without one would make that estimate wrong for every order
 * containing it.
 */
export async function POST(req: Request) {
  try {
    const body = createMenuItemSchema.parse(await req.json());

    const [menu, category] = await Promise.all([
      prisma.menu.findUnique({ where: { id: body.menuId }, select: { id: true } }),
      prisma.category.findUnique({ where: { id: body.categoryId }, select: { id: true } }),
    ]);
    if (!menu) return fail("That menu does not exist", 404);
    if (!category) return fail("That category does not exist", 404);

    // The same dish twice on one menu is a mistake rather than a choice, and
    // the customer would see it listed twice.
    const clash = await prisma.menuItem.findFirst({
      where: { menuId: body.menuId, name: { equals: body.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (clash) return fail("That menu already has an item with this name", 409);

    const item = await prisma.menuItem.create({
      data: {
        menuId: body.menuId,
        categoryId: body.categoryId,
        name: body.name,
        description: body.description ?? null,
        price: body.price,
        preparationTimeMinutes: body.preparationTimeMinutes,
        emoji: body.emoji || null,
      },
      include: { category: { select: { name: true, type: true } } },
    });

    return ok(item, 201);
  } catch (error) {
    return handleError(error);
  }
}
