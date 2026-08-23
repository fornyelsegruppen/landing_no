let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/**
 * Synthetic fixtures only. Values are intentionally reserved/example data so
 * tests and screenshots cannot be confused with real customers.
 */
export function makeAnonymousLeadFixture(
  overrides: Partial<Record<string, unknown>> = {},
) {
  const id = nextId("lead");
  return {
    id,
    name: "Testkunde",
    email: `${id}@example.invalid`,
    phone: "+47 000 00 000",
    address: "Testveien 1",
    postalCode: "0001",
    service: "takvask",
    ...overrides,
  };
}

export function makeAnonymousJobFixture(
  overrides: Partial<Record<string, unknown>> = {},
) {
  const id = nextId("job");
  return {
    id,
    type: "test.operation",
    status: "pending",
    correlationId: `corr-${id}`,
    payload: { entityId: "synthetic-entity" },
    ...overrides,
  };
}
