import { FinanceDB } from './db';

let counter = 0;

/** A fresh in-memory database for each test (fake-indexeddb). */
export function createTestDb(): FinanceDB {
  return new FinanceDB(`test-${Date.now()}-${counter++}`);
}
