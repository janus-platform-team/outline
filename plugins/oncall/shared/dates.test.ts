import {
  addDays,
  dayOfWeek,
  daysBetween,
  getLocalDateTime,
  isValidDate,
  isValidTimeZone,
  nextWeekday,
} from "./dates";

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toEqual("2027-01-02");
    expect(addDays("2026-03-01", -1)).toEqual("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-19", "2026-10-26")).toEqual(7);
    expect(daysBetween("2026-10-26", "2026-10-19")).toEqual(-7);
  });

  it("returns the day of the week", () => {
    // 2026-10-19 is a Monday
    expect(dayOfWeek("2026-10-19")).toEqual(1);
    expect(dayOfWeek("2026-10-25")).toEqual(0);
    expect(dayOfWeek("1969-12-31")).toEqual(3);
  });

  it("finds the next weekday", () => {
    expect(nextWeekday("2026-10-19", 1)).toEqual("2026-10-19");
    expect(nextWeekday("2026-10-21", 1)).toEqual("2026-10-26");
    expect(nextWeekday("2026-10-21", 5)).toEqual("2026-10-23");
  });

  it("validates dates", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
  });

  it("validates timezones", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });

  it("returns the local date and hour in a timezone", () => {
    const now = new Date("2026-10-21T23:30:00Z");
    expect(getLocalDateTime("UTC", now)).toEqual({
      date: "2026-10-21",
      hour: 23,
    });
    expect(getLocalDateTime("Europe/Berlin", now)).toEqual({
      date: "2026-10-22",
      hour: 1,
    });
    expect(getLocalDateTime("America/Los_Angeles", now)).toEqual({
      date: "2026-10-21",
      hour: 16,
    });
  });
});
