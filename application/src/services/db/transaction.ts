import type { DB, Transaction } from './types';

const UNSET = Symbol('db.transaction.unset');

export const runTransactionOn = async <T>(
  db: DB,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> => {
  let outcome: T | typeof UNSET = UNSET;

  await db.transaction(async tx => {
    outcome = await work(tx);
  });

  if (outcome === UNSET) {
    throw new Error('Transaction resolved without executing its callback.');
  }

  return outcome;
};
