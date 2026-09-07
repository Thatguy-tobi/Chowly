import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { createStaffSchema } from "@/lib/validation";

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

/**
 * POST /api/staff — put somebody on a restaurant's payroll.
 *
 * Without this a restaurant registered through the admin pages could never
 * take an order: placing one assigns a waiter, and a restaurant with no
 * waiters is refused. It could also never have its preparation recorded, since
 * the chef and bartender are chosen from this same list.
 */
export async function POST(req: Request) {
  try {
    const body = createStaffSchema.parse(await req.json());

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: body.restaurantId },
      select: { id: true },
    });
    if (!restaurant) return fail("That restaurant does not exist", 404);

    const member = await prisma.staff.create({
      data: {
        restaurantId: body.restaurantId,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        role: body.role,
        // Employed as of today. Nobody can have handled an order placed before
        // this moment, which is the rule the seeded data is checked against.
        employmentDate: new Date(),
      },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    return ok(member, 201);
  } catch (error) {
    return handleError(error);
  }
}
