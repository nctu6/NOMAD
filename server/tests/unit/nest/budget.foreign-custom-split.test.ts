/**
 * A custom split in a foreign currency adds up to what its payer was credited.
 * BUDGET-SVC-DB-095 and 096.
 *
 * 136,000 ISK at 136.34 ISK per euro is 997.51 EUR, but each 34,000 ISK quarter
 * is 249.376 and rounded up on its own, so four of them came to 997.52: the
 * balances ended a cent off zero, a cent the settle-up list had no payment for.
 */
import { BudgetService } from '../../../src/nest/budget/budget.service';
import { TripMembersModule } from '../../../src/nest/trip-members/trip-members.module';
import { createSnapshotTestDb } from '../../helpers/db-mock';
import { addTripMember, makeTrip } from '../../helpers/factories/trips';
import { makeUser } from '../../helpers/factories/users';
import { createTestModule, type TestModule } from '../../helpers/test-module';
import { MikroORM } from '@mikro-orm/core';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = createSnapshotTestDb();
let t: TestModule;
let budget: BudgetService;
const orm = () => t.get(MikroORM);

beforeAll(async () => {
  t = await createTestModule({ db, imports: [TripMembersModule] });
  budget = t.get(BudgetService);
});

afterAll(async () => {
  await t.close();
  db.close();
});

async function seedQuarters() {
  const users = [
    (await makeUser(orm())).user,
    (await makeUser(orm())).user,
    (await makeUser(orm())).user,
    (await makeUser(orm())).user,
  ];
  const trip = await makeTrip(orm(), users[0].id);
  await addTripMember(orm(), trip.id, users[1].id);
  await addTripMember(orm(), trip.id, users[2].id);
  await addTripMember(orm(), trip.id, users[3].id);
  await budget.createBudgetItem(trip.id, {
    name: 'Sky Lagoon',
    currency: 'ISK',
    exchange_rate: 136.34,
    payers: [{ user_id: users[0].id, amount: 136000 }],
    members: users.map((u) => ({ user_id: u.id, amount: 34000 })),
  });
  return { trip, users };
}

describe('a custom split in a foreign currency', () => {
  it('BUDGET-SVC-DB-095: the balances add up to zero and settle-up clears every one of them', async () => {
    const { trip, users } = await seedQuarters();
    const result = await budget.calculateSettlement(trip.id, { tripCurrency: 'EUR' });

    const cents = result.balances.map((b) => Math.round(b.balance * 100));
    expect(cents.reduce((a, c) => a + c, 0)).toBe(0);
    // The payer has the lowest id, so the tie hands them one of the three rounded-up quarters.
    expect(result.balances.find((b) => b.user_id === users[0].id)?.balance).toBe(748.13);
    const owed = result.flows
      .filter((f) => f.to.user_id === users[0].id)
      .reduce((a, f) => a + Math.round(f.amount * 100), 0);
    expect(owed).toBe(74813);
  });

  it('BUDGET-SVC-DB-096: the per-person shares add up to the bill', async () => {
    const { trip } = await seedQuarters();
    const people = await budget.getPerPersonSummary(trip.id);
    expect(people.reduce((a, p) => a + Math.round(p.total_assigned * 100), 0)).toBe(99751);
  });
});
