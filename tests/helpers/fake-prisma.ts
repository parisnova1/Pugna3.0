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
  "club",
  "clubEventInvite",
  "clubEventRequest",
  "clubEventParticipation",
  "eventHostMember",
  "nomination",
  "checkIn",
] as const;
type Table = (typeof TABLES)[number];

/** Column defaults the real schema applies on create. */
const DEFAULTS: Partial<Record<Table, Row>> = { clubEventInvite: { status: "PENDING" }, clubEventRequest: { status: "PENDING" } };

/** Relations the fake can resolve from `include`: table -> relation name -> [target table, foreign key on this row]. */
const RELATIONS: Partial<Record<Table, Record<string, [Table, string]>>> = {
  clubEventInvite: { event: ["event", "eventId"], invitedClub: ["club", "invitedClubId"] },
  clubEventParticipation: { event: ["event", "eventId"], club: ["club", "clubId"] },
  nomination: { fighter: ["fighterProfile", "fighterId"], event: ["event", "eventId"] },
};

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  return Object.entries(where ?? {}).every(([key, expected]) => {
    if (key === "OR") return (expected as Record<string, unknown>[]).some((alt) => matches(row, alt));
    const actual = row[key];
    if (actual === undefined && expected && typeof expected === "object" && !(expected instanceof Date) && key.includes("_")) {
      return matches(row, expected as Record<string, unknown>);
    }
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const filter = expected as Record<string, unknown>;
      if ("in" in filter) return (filter.in as unknown[]).includes(actual);
      if ("notIn" in filter) return !(filter.notIn as unknown[]).includes(actual);
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
    const withIncludes = (row: Row, include?: Record<string, unknown>): Row => {
      const copy = structuredClone(row);
      for (const rel of Object.keys(include ?? {})) {
        const link = RELATIONS[name]?.[rel];
        if (link) copy[rel] = structuredClone(tables[link[0]].find((t) => t.id === row[link[1]]) ?? null);
      }
      return copy;
    };
    const find = async ({ where, include }: { where?: Record<string, unknown>; include?: Record<string, unknown> } = {}) => {
      const row = tables[name].find((r) => matches(r, where));
      return row ? withIncludes(row, include) : null;
    };
    return {
      findUnique: find,
      findFirst: find,
      findMany: async ({ where, include }: { where?: Record<string, unknown>; include?: Record<string, unknown> } = {}) =>
        tables[name].filter((r) => matches(r, where)).map((r) => withIncludes(r, include)),
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
      upsert: async ({ where, update, create }: { where: Record<string, unknown>; update: Row; create: Row }) => {
        const row = tables[name].find((r) => matches(r, where));
        if (row) {
          Object.assign(row, update);
          mutations.push(`${name}.update`);
          return structuredClone(row);
        }
        mutations.push(`${name}.create`);
        const made = { id: `${name}-${tables[name].length + 1}`, ...create };
        tables[name].push(made);
        return structuredClone(made);
      },
      delete: async ({ where }: { where: Record<string, unknown> }) => {
        mutations.push(`${name}.delete`);
        const i = tables[name].findIndex((r) => matches(r, where));
        if (i < 0) throw new Error(`${name}.delete: no row`);
        return tables[name].splice(i, 1)[0];
      },
      create: async ({ data, include }: { data: Row; include?: Record<string, unknown> }) => {
        mutations.push(`${name}.create`);
        const row = { id: `${name}-${tables[name].length + 1}`, ...(DEFAULTS[name] ?? {}), ...data };
        tables[name].push(row);
        return withIncludes(row, include);
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
