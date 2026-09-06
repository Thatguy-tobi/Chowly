/**
 * Estimated waiting time for an order, in minutes.
 *
 * A kitchen does not cook two fish one after the other, and a bartender does
 * not make three lattes in series. So the wait is driven by the single slowest
 * item in each stream, plus a small allowance for each additional portion:
 *
 *     food  = slowest food item  + 3 minutes per extra food portion
 *     drink = slowest drink item + 2 minutes per extra drink portion
 *
 * The chef and the bartender work at the same time, so the order is ready when
 * the slower of the two streams finishes — hence max(), not the sum.
 *
 * This is deliberately identical to the formula in docs/generate-seed-data.py.
 * If the two ever diverge, seeded orders and live orders would quote waits on
 * different rules and the data would stop making sense as a whole.
 */

const EXTRA_FOOD_PORTION_MINUTES = 3;
const EXTRA_DRINK_PORTION_MINUTES = 2;

export type WaitTimeLine = {
  quantity: number;
  preparationTimeMinutes: number;
  categoryType: "FOOD" | "DRINK";
};

export function estimateWaitMinutes(lines: WaitTimeLine[]): number {
  let slowestFood = 0;
  let slowestDrink = 0;
  let foodPortions = 0;
  let drinkPortions = 0;

  for (const line of lines) {
    if (line.categoryType === "FOOD") {
      slowestFood = Math.max(slowestFood, line.preparationTimeMinutes);
      foodPortions += line.quantity;
    } else {
      slowestDrink = Math.max(slowestDrink, line.preparationTimeMinutes);
      drinkPortions += line.quantity;
    }
  }

  const foodWait = foodPortions
    ? slowestFood + EXTRA_FOOD_PORTION_MINUTES * (foodPortions - 1)
    : 0;
  const drinkWait = drinkPortions
    ? slowestDrink + EXTRA_DRINK_PORTION_MINUTES * (drinkPortions - 1)
    : 0;

  return Math.max(foodWait, drinkWait);
}

/**
 * How an order is progressing against the time it was quoted.
 * `PLACED`/`PREPARING` orders count from now; finished ones from when served.
 */
export function waitProgress(
  orderDate: Date,
  estimatedWaitMinutes: number,
  servedAt: Date | null,
  now: Date = new Date()
) {
  const end = servedAt ?? now;
  const elapsedMinutes = Math.max(0, Math.floor((end.getTime() - orderDate.getTime()) / 60000));
  const remainingMinutes = Math.max(0, estimatedWaitMinutes - elapsedMinutes);
  return {
    elapsedMinutes,
    remainingMinutes,
    isOverdue: elapsedMinutes > estimatedWaitMinutes,
    overdueByMinutes: Math.max(0, elapsedMinutes - estimatedWaitMinutes),
    /** 0..1, clamped — for a progress bar. */
    fraction: estimatedWaitMinutes === 0 ? 1 : Math.min(1, elapsedMinutes / estimatedWaitMinutes),
  };
}
