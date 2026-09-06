import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";

/**
 * GET /api/staff?restaurantId=…[&role=CHEF]
 *
 * The staff list the waiter picks the chef and the bartender from. Requirement
 * 3 asks for this list to be one I loaded myself, which it is — it comes from
 * the seeded Staff table.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId");
    const role = url.searchParams.get("role");

    if (!restaurantId) return fail("restaurantId is required", 400);

    const where: Prisma.StaffWhereInput = { restaurantId };
    if (role) {
      if (!["WAITER", "CHEF", "BARTENDER"].includes(role)) return fail("Unknown role", 400);
      where.role = role as Prisma.EnumStaffRoleFilter["equals"];
    }

    const staff = await prisma.staff.findMany({
      where,
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    return ok(staff);
  } catch (error) {
    return handleError(error);
  }
}
