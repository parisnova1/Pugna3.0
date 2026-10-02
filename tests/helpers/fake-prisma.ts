/**
 * A tiny in-memory stand-in for the parts of Prisma the authorization tests
 * touch. It implements real `where` matching (equality, `in`, nested relation
 * filters), so a lookup that forgets to scope by event/session genuinely finds
 * the wrong row -- which is exactly the bug these tests exist to catch.
 */
export type Row = Record<string, unknown>;

const TABLES = [
  "event",
  "ring",
  "bout",
  "crowdShout",
  "sparringSession",
  "sparringWeightGroup",
  "sparringParticipant",
  "sparringMatch",
  "fighterProfile",
  "notification",
  "savedBout",
] as const;
type Table = (typeof TABLES)[number];

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  return Object.entries(where ?? {}).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const filter = expected as Record<string, unknown>;
      if ("in" in filter) return (filter.in as unknown[]).includes(actual);
      if ("gt" in filter || "lt" in filter || "not" in filter) return true;
      return actual && typeof actual === "object" ? matches(actual as Row, filter) : false;
    }
    return actual === expected;
  });
}

export function createFakeDb() {
  const tables = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as Record<Table, Row[]>;
  const mutations: string[] = [];

  const model = (name: Table) => {
    // Reads return snapshots (as real Prisma does), so a later update can't rewrite a row the caller already holds.
    const find = async ({ where }: { where?: Record<string, unknown> } = {}) => {
      const row = tables[name].find((r) => matches(r, where));
      return row ? structuredClone(row) : null;
    };
    return {
      findUnique: find,
      findFirst: find,
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => tables[name].filter((r) => matches(r, where)).map((r) => structuredClone(r)),
      count: async ({ where }: { where?: Record<string, unknown> } = {}) => tables[name].filter((r) => matches(r, where)).length,
      update: async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
        mutations.push(`${name}.update`);
        const row = tables[name].find((r) => matches(r, where));
        if (!row) throw new Error(`${name}.update: no row`);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where?: Record<string, unknown>; data: Row }) => {
        const rows = tables[name].filter((r) => matches(r, where));
        if (rows.length) mutations.push(`${name}.updateMany`);
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      create: async ({ data }: { data: Row }) => {
        mutations.push(`${name}.create`);
        const row = { id: `${name}-${tables[name].length + 1}`, ...data };
        tables[name].push(row);
        return row;
      },
      createMany: async ({ data }: { data: Row[] }) => {
        mutations.push(`${name}.createMany`);
        data.forEach((d) => tables[name].push({ id: `${name}-${tables[name].length + 1}`, ...d }));
        return { count: data.length };
      },
    };
  };

  const prisma: Record<string, unknown> = Object.fromEntries(TABLES.map((t) => [t, model(t)]));
  prisma.$transaction = async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[]));

  return {
    prisma,
    tables,
    mutations,
    reset() {
      TABLES.forEach((t) => (tables[t].length = 0));
      mutations.length = 0;
    },
    /** A deep snapshot, for asserting an attack changed nothing. */
    snapshot: () => JSON.stringify(tables),
  };
}

export const fakeDb = createFakeDb();
