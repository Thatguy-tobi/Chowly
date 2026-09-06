import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";

/**
 * Read the database back and re-check the invariants.
 *
 * The seed data is validated before it is written, but that proves the
 * generator is consistent, not that the rows landed in Postgres intact. This
 * queries what is actually stored and checks the arithmetic and the
 * relationships again from the other side.
 *
 * Run:  npx tsx prisma/verify.ts
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set.");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const n = (d: unknown) => Number(d);

async function main() {
  const counts = {
    restaurants: await prisma.restaurant.count(),
    categories: await prisma.category.count(),
    customers: await prisma.customer.count(),
    staff: await prisma.staff.count(),
    menus: await prisma.menu.count(),
    menuItems: await prisma.menuItem.count(),
    orders: await prisma.customerOrder.count(),
    orderItems: await prisma.orderItem.count(),
    preparations: await prisma.orderPreparation.count(),
    complaints: await prisma.complaint.count(),
    ratings: await prisma.rating.count(),
    payments: await prisma.payment.count(),
  };

  console.log("Row counts in Postgres:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(14)} ${String(v).padStart(4)}`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`  ${"TOTAL".padEnd(14)} ${String(total).padStart(4)}\n`);

  const orders = await prisma.customerOrder.findMany({
    include: {
      items: { include: { item: { include: { category: true } } } },
      preparation: { include: { chef: true, bartender: true } },
      payment: true,
      rating: true,
      complaints: true,
      waiter: true,
    },
  });

  for (const o of orders) {
    check(o.items.length > 0, `${o.reference} has no items`);

    // subtotal and order total arithmetic
    let sum = 0;
    for (const li of o.items) {
      check(
        li.quantity * n(li.unitPrice) === n(li.subtotal),
        `${o.reference}/${li.itemId}: ${li.quantity} x ${n(li.unitPrice)} != ${n(li.subtotal)}`
      );
      check(
        n(li.unitPrice) === n(li.item.price),
        `${o.reference}/${li.itemId}: unit price differs from the menu price`
      );
      sum += n(li.subtotal);
    }
    check(sum === n(o.orderTotal), `${o.reference}: items sum ${sum} != orderTotal ${n(o.orderTotal)}`);

    // the waiter must work at the restaurant the order was placed in
    if (o.waiter) {
      check(o.waiter.role === "WAITER", `${o.reference}: assigned staff is not a waiter`);
      check(o.waiter.restaurantId === o.restaurantId, `${o.reference}: waiter is at another restaurant`);
    }

    // payment
    if (o.status === "PAID") {
      check(o.payment !== null, `${o.reference} is PAID but has no payment`);
      if (o.payment) {
        check(n(o.payment.amount) === n(o.orderTotal), `${o.reference}: payment amount != order total`);
        check(o.payment.isPretend, `${o.reference}: payment is not flagged as pretend`);
      }
    } else {
      check(o.payment === null, `${o.reference} is ${o.status} but carries a payment`);
    }

    // preparation, and the end time that only exists once the food is done
    if (o.status === "PLACED") {
      check(o.preparation === null, `${o.reference} is PLACED but has a preparation record`);
    } else {
      check(o.preparation !== null, `${o.reference} is ${o.status} but has no preparation record`);
      if (o.preparation) {
        const p = o.preparation;
        check(p.chefId !== null || p.bartenderId !== null, `${o.reference}: preparation has neither chef nor bartender`);
        if (p.chef) check(p.chef.restaurantId === o.restaurantId, `${o.reference}: chef at another restaurant`);
        if (p.bartender) check(p.bartender.restaurantId === o.restaurantId, `${o.reference}: bartender at another restaurant`);

        const hasFood = o.items.some((li) => li.item.category.type === "FOOD");
        const hasDrink = o.items.some((li) => li.item.category.type === "DRINK");
        check(hasFood === (p.chefId !== null), `${o.reference}: chef set does not match whether the order has food`);
        check(hasDrink === (p.bartenderId !== null), `${o.reference}: bartender set does not match whether the order has drinks`);

        if (o.status === "PREPARING") {
          check(p.preparationEnd === null, `${o.reference} is still PREPARING but has an end time`);
        } else {
          check(p.preparationEnd !== null, `${o.reference} is ${o.status} but has no end time`);
          if (p.preparationStart && p.preparationEnd) {
            check(p.preparationEnd > p.preparationStart, `${o.reference}: preparation ends before it starts`);
          }
        }
      }
    }

    // feedback belongs to the customer who placed the order
    for (const c of o.complaints) {
      check(c.customerId === o.customerId, `${o.reference}: complaint filed by another customer`);
    }
    if (o.rating) {
      check(o.rating.customerId === o.customerId, `${o.reference}: rating given by another customer`);
      check(o.rating.value >= 1 && o.rating.value <= 5, `${o.reference}: rating out of range`);
    }
  }

  // every menu must have items, or the customer sees an empty menu
  const menus = await prisma.menu.findMany({ include: { _count: { select: { items: true } } } });
  for (const m of menus) check(m._count.items > 0, `menu ${m.id} has no items`);

  console.log(problems.length === 0
    ? `All checks passed against the live database (${orders.length} orders inspected).`
    : `${problems.length} PROBLEM(S):`);
  problems.slice(0, 25).forEach((p) => console.log("  -", p));

  // a worked example, read straight out of Postgres
  const sample = orders.find((o) => o.status === "PAID" && o.items.length >= 3);
  if (sample) {
    console.log(`\nWorked example — ${sample.reference} (table ${sample.tableNumber}, ${sample.status})`);
    for (const li of sample.items) {
      console.log(
        `  ${li.item.emoji ?? " "} ${li.item.name.padEnd(26)} ${li.item.category.type.padEnd(5)} ` +
        `${li.quantity} x ${n(li.unitPrice).toLocaleString()} = ${n(li.subtotal).toLocaleString().padStart(8)}` +
        `   prep ${li.item.preparationTimeMinutes}m`
      );
    }
    console.log(`  ${"".padEnd(28)} quoted wait ${sample.estimatedWaitTime}m   total N${n(sample.orderTotal).toLocaleString()}`);
    console.log(`  chef: ${sample.preparation?.chef?.firstName ?? "-"}   bartender: ${sample.preparation?.bartender?.firstName ?? "-"}   waiter: ${sample.waiter?.firstName ?? "-"}`);
    console.log(`  paid: N${n(sample.payment!.amount).toLocaleString()} by ${sample.payment!.method} (pretend: ${sample.payment!.isPretend})`);
  }

  if (problems.length > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
