import { addDays } from "./dates";
import {
  applyMembershipChange,
  applyScheduleChange,
  findOverlappingOverride,
  getChangeBoundary,
  getShiftRange,
  groupShifts,
  previewShifts,
  reanchorRotation,
  resolveRotationUser,
  resolveSchedule,
} from "./schedule";
import type { RotationSegment } from "./types";

// 2026-10-19 is a Monday
const start = "2026-10-19";

function weekly(memberIds: string[], shiftLengthDays = 7): RotationSegment[] {
  return [{ effectiveDate: start, memberIds, startIndex: 0, shiftLengthDays }];
}

function usersFrom(
  segments: RotationSegment[],
  from: string,
  count: number,
  step: number
) {
  return Array.from({ length: count }, (_, i) =>
    resolveRotationUser(segments, addDays(from, i * step))
  );
}

describe("resolveRotationUser", () => {
  it("returns null before the rotation starts", () => {
    expect(resolveRotationUser(weekly(["a", "b"]), "2026-10-18")).toBeNull();
  });

  it("returns null when the rotation has no members", () => {
    expect(resolveRotationUser(weekly([]), start)).toBeNull();
  });

  it.each([1, 3, 7])("rotates every %i days", (length) => {
    const segments = weekly(["a", "b", "c"], length);
    expect(usersFrom(segments, start, 4, length)).toEqual(["a", "b", "c", "a"]);
    expect(resolveRotationUser(segments, addDays(start, length - 1))).toEqual(
      "a"
    );
  });

  it("respects the start index", () => {
    const segments: RotationSegment[] = [
      {
        effectiveDate: start,
        memberIds: ["a", "b"],
        startIndex: 1,
        shiftLengthDays: 7,
      },
    ];
    expect(usersFrom(segments, start, 3, 7)).toEqual(["b", "a", "b"]);
  });
});

describe("getShiftRange", () => {
  it("returns the shift containing a date", () => {
    expect(getShiftRange(weekly(["a"]), "2026-10-21")).toEqual({
      startDate: "2026-10-19",
      endDate: "2026-10-25",
    });
  });

  it("cuts a shift short at the next segment", () => {
    const segments: RotationSegment[] = [
      ...weekly(["a", "b"]),
      {
        effectiveDate: "2026-10-23",
        memberIds: ["a", "b"],
        startIndex: 1,
        shiftLengthDays: 7,
      },
    ];
    expect(getShiftRange(segments, "2026-10-21")?.endDate).toEqual(
      "2026-10-22"
    );
  });
});

describe("getChangeBoundary", () => {
  it("snaps to the boundary after the current shift", () => {
    const segments = weekly(["a", "b"]);
    expect(getChangeBoundary(segments, "2026-10-21", "2026-10-21")).toEqual(
      "2026-10-26"
    );
    expect(getChangeBoundary(segments, "2026-10-19", "2026-10-21")).toEqual(
      "2026-10-26"
    );
  });

  it("snaps a future date to the following boundary", () => {
    const segments = weekly(["a", "b"]);
    expect(getChangeBoundary(segments, "2026-11-03", "2026-10-21")).toEqual(
      "2026-11-09"
    );
    expect(getChangeBoundary(segments, "2026-11-02", "2026-10-21")).toEqual(
      "2026-11-02"
    );
  });

  it("uses the start of a rotation that has not started", () => {
    const segments = weekly(["a", "b"]);
    expect(getChangeBoundary(segments, "2026-10-10", "2026-10-10")).toEqual(
      start
    );
  });
});

describe("applyMembershipChange", () => {
  const today = "2026-10-21";

  it("adds a member without changing current or past shifts", () => {
    const before = weekly(["a", "b"]);
    const boundary = getChangeBoundary(before, today, today);
    const after = applyMembershipChange(
      before,
      { type: "add", userId: "c" },
      boundary,
      7
    );

    const past = resolveSchedule(before, [], start, "2026-10-25");
    expect(resolveSchedule(after, [], start, "2026-10-25")).toEqual(past);
    // a is on call now, b would have been next and stays next
    expect(usersFrom(after, "2026-10-26", 4, 7)).toEqual(["b", "c", "a", "b"]);
  });

  it("adds a member at a position", () => {
    const after = applyMembershipChange(
      weekly(["a", "b"]),
      { type: "add", userId: "c", position: 0 },
      "2026-10-26",
      7
    );
    expect(after[1].memberIds).toEqual(["c", "a", "b"]);
    expect(usersFrom(after, "2026-10-26", 3, 7)).toEqual(["b", "c", "a"]);
  });

  it("continues with the next person when the next person is removed", () => {
    const before = weekly(["a", "b", "c"]);
    const after = applyMembershipChange(
      before,
      { type: "remove", userId: "b" },
      "2026-10-26",
      7
    );
    expect(resolveRotationUser(after, "2026-10-21")).toEqual("a");
    expect(usersFrom(after, "2026-10-26", 3, 7)).toEqual(["c", "a", "c"]);
  });

  it("removes the current person only from the next shift", () => {
    const after = applyMembershipChange(
      weekly(["a", "b", "c"]),
      { type: "remove", userId: "a" },
      "2026-10-26",
      7
    );
    expect(resolveRotationUser(after, "2026-10-25")).toEqual("a");
    expect(usersFrom(after, "2026-10-26", 3, 7)).toEqual(["b", "c", "b"]);
  });

  it("modifies the first segment in place before the rotation starts", () => {
    const after = applyMembershipChange(
      weekly(["a", "b"]),
      { type: "remove", userId: "a" },
      start,
      7
    );
    expect(after).toHaveLength(1);
    expect(after[0].memberIds).toEqual(["b"]);
    expect(resolveRotationUser(after, start)).toEqual("b");
  });

  it("applies the change to later scheduled segments", () => {
    const first = applyMembershipChange(
      weekly(["a", "b"]),
      { type: "add", userId: "c" },
      "2026-11-09",
      7
    );
    const second = applyMembershipChange(
      first,
      { type: "remove", userId: "b" },
      "2026-10-26",
      7
    );

    expect(second.map((s) => s.effectiveDate)).toEqual([
      start,
      "2026-10-26",
      "2026-11-09",
    ]);
    expect(second[2].memberIds).toEqual(["a", "c"]);
    // b would have been on call on 2026-11-09, so a continues until c joins
    expect(usersFrom(second, start, 6, 7)).toEqual([
      "a",
      "a",
      "a",
      "a",
      "c",
      "a",
    ]);
  });

  it("creates a segment for a rotation without segments", () => {
    expect(
      applyMembershipChange([], { type: "add", userId: "a" }, start, 3)
    ).toEqual([
      {
        effectiveDate: start,
        memberIds: ["a"],
        startIndex: 0,
        shiftLengthDays: 3,
      },
    ]);
  });

  it("throws when the change is before the rotation starts", () => {
    expect(() =>
      applyMembershipChange(
        weekly(["a"]),
        { type: "add", userId: "b" },
        "2026-10-01",
        7
      )
    ).toThrow();
  });
});

describe("applyScheduleChange", () => {
  it("changes the shift length from a boundary onward", () => {
    const before = weekly(["a", "b", "c"]);
    const after = applyScheduleChange(before, "2026-10-26", 1);
    expect(resolveSchedule(after, [], start, "2026-10-25")).toEqual(
      resolveSchedule(before, [], start, "2026-10-25")
    );
    expect(usersFrom(after, "2026-10-26", 4, 1)).toEqual(["b", "c", "a", "b"]);
  });

  it("starts with the next person when the boundary is mid-shift", () => {
    const after = applyScheduleChange(weekly(["a", "b"]), "2026-10-23", 7);
    expect(resolveRotationUser(after, "2026-10-22")).toEqual("a");
    expect(resolveRotationUser(after, "2026-10-23")).toEqual("b");
    expect(resolveRotationUser(after, "2026-10-30")).toEqual("a");
  });

  it("moves later segments onto the new grid", () => {
    const withLater = applyMembershipChange(
      weekly(["a", "b"]),
      { type: "add", userId: "c" },
      "2026-11-09",
      7
    );
    const after = applyScheduleChange(withLater, "2026-10-26", 3);
    // 2026-11-09 is 14 days after the boundary, the next 3 day boundary is 15
    expect(after.map((s) => s.effectiveDate)).toEqual([
      start,
      "2026-10-26",
      "2026-11-10",
    ]);
    expect(after[2].shiftLengthDays).toEqual(3);
  });
});

describe("reanchorRotation", () => {
  it("moves the start of a rotation", () => {
    const after = reanchorRotation(weekly(["a", "b"]), "2026-10-21", 2);
    expect(after).toEqual([
      {
        effectiveDate: "2026-10-21",
        memberIds: ["a", "b"],
        startIndex: 0,
        shiftLengthDays: 2,
      },
    ]);
  });
});

describe("overrides", () => {
  const overrides = [
    { id: "o1", userId: "z", startDate: "2026-10-22", endDate: "2026-10-23" },
  ];

  it("replaces the rotation user without shifting the order", () => {
    const days = resolveSchedule(
      weekly(["a", "b"]),
      overrides,
      "2026-10-21",
      "2026-10-26"
    );
    expect(days.map((d) => d.userId)).toEqual(["a", "z", "z", "a", "a", "b"]);
    expect(days[1].overrideId).toEqual("o1");
  });

  it("groups days into shifts", () => {
    const days = resolveSchedule(
      weekly(["a", "b"]),
      overrides,
      "2026-10-21",
      "2026-10-26"
    );
    expect(groupShifts(days)).toEqual([
      { startDate: "2026-10-21", endDate: "2026-10-21", userId: "a" },
      {
        startDate: "2026-10-22",
        endDate: "2026-10-23",
        userId: "z",
        overrideId: "o1",
      },
      { startDate: "2026-10-24", endDate: "2026-10-25", userId: "a" },
      { startDate: "2026-10-26", endDate: "2026-10-26", userId: "b" },
    ]);
  });

  it("finds overlapping overrides", () => {
    expect(
      findOverlappingOverride(overrides, "2026-10-23", "2026-10-30")
    ).toBeDefined();
    expect(
      findOverlappingOverride(overrides, "2026-10-24", "2026-10-30")
    ).toBeUndefined();
  });
});

describe("previewShifts", () => {
  it("lists upcoming shifts", () => {
    expect(previewShifts(weekly(["a", "b"]), "2026-10-26", 3)).toEqual([
      { startDate: "2026-10-26", endDate: "2026-11-01", userId: "b" },
      { startDate: "2026-11-02", endDate: "2026-11-08", userId: "a" },
      { startDate: "2026-11-09", endDate: "2026-11-15", userId: "b" },
    ]);
  });
});
