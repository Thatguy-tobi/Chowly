import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/**
 * Removes test data left behind in the database, without touching anything
 * legitimate.
 *
 * Two things accumulate. Preparation records can be orphaned: seeding upserts
 * rather than replaces, so if an order was worked on through the interface and
 * the seed later reset its status to PLACED, the preparation row survives and
 * leaves a placed order claiming a chef. And customers created while testing
 * sit alongside real ones.
 *
 * This is deliberately narrow. It does not drop tables and it does not touch
 * the seeded dataset or any order placed as a genuine demonstration.
 *
 *   npx tsx prisma/cleanup.ts          list what would be removed
 *   npx tsx prisma/cleanup.ts --apply  remove it
 */
const TEST_CUSTOMER_NAMES = ["FlashTest"];

async function main() {
  const apply = process.argv.includes("--apply");

  // A PLACED order has not been prepared by definition, so any preparation
  // record against one is a leftover.
  const orphanedPreps = await prisma.orderPreparation.findMany({
    where: { order: { status: "PLACED" } },
    select: { id: true, order: { select: { reference: true } } },
  });

  const testCustomers = await prisma.customer.findMany({
    where: { firstName: { in: TEST_CUSTOMER_NAMES } },
    select: { id: true, firstName: true, orders: { select: { reference: true } } },
  });

  console.log(`Orphaned preparation records: ${orphanedPreps.length}`);
  for (const p of orphanedPreps) console.log(`  ${p.order.reference} (${p.id})`);

  console.log(`Test customers: ${testCustomers.length}`);
  for (const c of testCustomers) {
    console.log(
      `  ${c.firstName} — ${c.orders.length} order(s): ${c.orders.map((o) => o.reference).join(", ") || "none"}`
    );
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to remove these.");
    return;
  }

  const prepIds = orphanedPreps.map((p) => p.id);
  if (prepIds.length) {
    await prisma.orderPreparation.deleteMany({ where: { id: { in: prepIds } } });
  }

  for (const c of testCustomers) {
    // Orders cascade to their items, preparation, complaints, rating and
    // payment, so the customer's orders go first and the customer last.
    await prisma.customerOrder.deleteMany({ where: { customerId: c.id } });
    await prisma.customer.delete({ where: { id: c.id } });
  }

  console.log(
    `\nRemoved ${prepIds.length} preparation record(s) and ${testCustomers.length} test customer(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
