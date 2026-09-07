import { prisma } from "@/lib/prisma";
import { handleError, ok } from "@/lib/api";

/**
 * GET /api/categories — the categories an item can be filed under.
 *
 * Categories are shared across restaurants rather than owned by one, which is
 * what the submitted model describes: "Grills" means the same thing everywhere.
 * The type matters beyond labelling — whether an item is food or drink decides
 * which stream its preparation time counts towards in the wait estimate, and
 * whether a chef or a bartender is recorded against the order.
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    });
    return ok(categories);
  } catch (error) {
    return handleError(error);
  }
}
