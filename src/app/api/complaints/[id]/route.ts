import { prisma } from "@/lib/prisma";
import { fail, handleError, ok } from "@/lib/api";
import { resolveComplaintSchema } from "@/lib/validation";

/**
 * PATCH /api/complaints/:id
 *
 * The other half of requirement 4. A complaint was already stored against the
 * order and shown to the waiter, but nothing could ever change its status — so
 * Complaint.status existed in the model, was displayed as "Open", and stayed
 * that way forever. This is what closes it.
 *
 * Resolving is reversible: a complaint marked resolved in error can be reopened
 * rather than being a one-way door.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = resolveComplaintSchema.parse(await req.json());

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!complaint) return fail("That complaint does not exist", 404);

    const updated = await prisma.complaint.update({
      where: { id },
      data: { status },
    });

    return ok(updated);
  } catch (error) {
    return handleError(error);
  }
}
