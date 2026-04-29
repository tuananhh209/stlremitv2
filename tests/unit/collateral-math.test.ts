// Feature: stellar-remittance-mvp, Property 14: Reserve Deducts Collateral Pool
import fc from "fast-check";

interface MockContractState {
  totalCollateral: number;
  reservations: Map<string, number>;
}

function reserve(
  state: MockContractState,
  txId: string,
  amount: number
): MockContractState {
  const available = state.totalCollateral;
  if (available < amount) throw new Error("InsufficientFunds");
  if (state.reservations.has(txId)) throw new Error("TxAlreadyProcessed");

  const newReservations = new Map(state.reservations);
  newReservations.set(txId, amount);

  return {
    totalCollateral: state.totalCollateral - amount,
    reservations: newReservations,
  };
}

function getReserved(state: MockContractState, txId: string): number {
  return state.reservations.get(txId) ?? 0;
}

describe("Collateral Math", () => {
  // Property 14
  test("Property 14: reserve deducts exactly the specified amount from available pool", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(500), noNaN: true }),
        fc.uuid(),
        (totalCollateral, reserveAmount, txId) => {
          if (reserveAmount > totalCollateral) return; // skip invalid case

          const initial: MockContractState = {
            totalCollateral,
            reservations: new Map(),
          };

          const after = reserve(initial, txId, reserveAmount);

          // Available balance decreased by exactly reserveAmount
          expect(Math.abs(after.totalCollateral - (totalCollateral - reserveAmount))).toBeLessThan(1e-9);

          // Reserved amount for txId equals reserveAmount
          expect(Math.abs(getReserved(after, txId) - reserveAmount)).toBeLessThan(1e-9);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("reserve fails when amount exceeds available balance", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(50), noNaN: true }),
        fc.uuid(),
        (available, extra, txId) => {
          const state: MockContractState = {
            totalCollateral: available,
            reservations: new Map(),
          };
          expect(() => reserve(state, txId, available + extra + 0.001)).toThrow(
            "InsufficientFunds"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test("double reserve with same txId is rejected", () => {
    const state: MockContractState = {
      totalCollateral: 1000,
      reservations: new Map([["tx1", 100]]),
    };
    expect(() => reserve(state, "tx1", 50)).toThrow("TxAlreadyProcessed");
  });
});
