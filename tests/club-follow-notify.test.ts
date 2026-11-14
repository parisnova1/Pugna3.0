import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./helpers/fake-prisma";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-prisma")).fakeDb.prisma }));

import { getClubFollowerUserIds } from "@/lib/recipients";

describe("who hears about a club's newly published event", () => {
  beforeEach(() => {
    fakeDb.reset();
    fakeDb.tables.clubFollow.push(
      { id: "f1", userId: "ann", clubId: "club-1" },
      { id: "f2", userId: "bo", clubId: "club-1" },
      { id: "f3", userId: "cy", clubId: "club-1" },
      { id: "f4", userId: "dee", clubId: "club-2" },
    );
  });

  it("is that club's followers only", async () => {
    expect((await getClubFollowerUserIds("club-1")).sort()).toEqual(["ann", "bo", "cy"]);
    expect(await getClubFollowerUserIds("club-2")).toEqual(["dee"]);
    expect(await getClubFollowerUserIds("club-3")).toEqual([]);
  });

  it("skips people who are already told another way (the publisher, nominated fighters)", async () => {
    expect((await getClubFollowerUserIds("club-1", ["bo", "someone-else"])).sort()).toEqual(["ann", "cy"]);
  });

  it("lists each person once", async () => {
    fakeDb.tables.clubFollow.push({ id: "f5", userId: "ann", clubId: "club-1" });
    expect((await getClubFollowerUserIds("club-1")).filter((id) => id === "ann")).toHaveLength(1);
  });
});
