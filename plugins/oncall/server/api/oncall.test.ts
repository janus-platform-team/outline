import {
  buildAdmin,
  buildGuestUser,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import type { User } from "@server/models";
import { addDays, dayOfWeek } from "../../shared/dates";
import type {
  OnCallCalendarData,
  OnCallRotationData,
} from "../../shared/types";

const server = getTestServer();

const today = new Date().toISOString().slice(0, 10);
const webhookUrl = "https://hooks.slack.com/services/T000/B000/XXXX";

async function createCalendar(
  user: User,
  body: Record<string, unknown> = {}
): Promise<OnCallCalendarData> {
  const res = await server.post("/api/oncallCalendars.create", user, {
    body: { name: "Platform", timezone: "UTC", ...body },
  });
  expect(res.status).toEqual(200);
  return (await res.json()).data;
}

async function createRotation(
  user: User,
  calendarId: string,
  memberIds: string[],
  body: Record<string, unknown> = {}
): Promise<OnCallRotationData> {
  // Started two weeks ago so that the third weekly shift is in progress.
  const startDate = addDays(today, -14);
  const res = await server.post("/api/oncallRotations.create", user, {
    body: {
      calendarId,
      name: "Primary",
      startDate,
      startDayOfWeek: dayOfWeek(startDate),
      shiftLengthDays: 7,
      memberIds,
      ...body,
    },
  });
  expect(res.status).toEqual(200);
  return (await res.json()).data;
}

async function getSchedule(
  user: User,
  id: string,
  startDate: string,
  endDate: string
) {
  const res = await server.post("/api/oncallCalendars.schedule", user, {
    body: { id, startDate, endDate },
  });
  expect(res.status).toEqual(200);
  return (await res.json()).data;
}

describe("#oncallCalendars.create", () => {
  it("should require authentication", async () => {
    const res = await server.post("/api/oncallCalendars.create", {
      body: { name: "Platform" },
    });
    expect(res.status).toEqual(401);
  });

  it("should create a calendar without exposing the webhook", async () => {
    const user = await buildUser();
    const calendar = await createCalendar(user, {
      timezone: "Europe/Berlin",
      slackWebhookUrl: webhookUrl,
    });

    expect(calendar.name).toEqual("Platform");
    expect(calendar.timezone).toEqual("Europe/Berlin");
    expect(calendar.slackConfigured).toBe(true);
    expect(JSON.stringify(calendar)).not.toContain("hooks.slack.com");
  });

  it("should reject webhooks that are not Slack", async () => {
    const user = await buildUser();
    const res = await server.post("/api/oncallCalendars.create", user, {
      body: { name: "Platform", slackWebhookUrl: "https://example.com/hook" },
    });
    expect(res.status).toEqual(400);
  });

  it("should reject invalid timezones", async () => {
    const user = await buildUser();
    const res = await server.post("/api/oncallCalendars.create", user, {
      body: { name: "Platform", timezone: "Mars/Olympus" },
    });
    expect(res.status).toEqual(400);
  });

  it("should not allow guests", async () => {
    const guest = await buildGuestUser();
    const res = await server.post("/api/oncallCalendars.create", guest, {
      body: { name: "Platform" },
    });
    expect(res.status).toEqual(403);
  });
});

describe("#oncallCalendars.info", () => {
  it("should allow team members to read", async () => {
    const owner = await buildUser();
    const member = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);

    const res = await server.post("/api/oncallCalendars.info", member, {
      body: { id: calendar.id },
    });
    expect(res.status).toEqual(200);
    expect((await res.json()).data.today).toEqual(today);
  });

  it("should not allow other teams to read", async () => {
    const owner = await buildUser();
    const other = await buildUser();
    const calendar = await createCalendar(owner);

    const res = await server.post("/api/oncallCalendars.info", other, {
      body: { id: calendar.id },
    });
    expect(res.status).toEqual(403);
  });
});

describe("#oncallCalendars.list", () => {
  it("should list the calendars of the team", async () => {
    const team = await buildTeam();
    const user = await buildUser({ teamId: team.id });
    await createCalendar(user, { name: "B" });
    await createCalendar(user, { name: "A" });
    await createCalendar(await buildUser());

    const res = await server.post("/api/oncallCalendars.list", user);
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.map((c: OnCallCalendarData) => c.name)).toEqual([
      "A",
      "B",
    ]);
  });
});

describe("#oncallCalendars.update", () => {
  it("should only allow the creator or an admin to update", async () => {
    const owner = await buildUser();
    const member = await buildUser({ teamId: owner.teamId });
    const admin = await buildAdmin({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);

    const denied = await server.post("/api/oncallCalendars.update", member, {
      body: { id: calendar.id, name: "Nope" },
    });
    expect(denied.status).toEqual(403);

    const res = await server.post("/api/oncallCalendars.update", admin, {
      body: { id: calendar.id, name: "Renamed", slackWebhookUrl: webhookUrl },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.name).toEqual("Renamed");
    expect(body.data.slackConfigured).toBe(true);
  });

  it("should clear the webhook", async () => {
    const owner = await buildUser();
    const calendar = await createCalendar(owner, {
      slackWebhookUrl: webhookUrl,
    });

    const res = await server.post("/api/oncallCalendars.update", owner, {
      body: { id: calendar.id, slackWebhookUrl: null },
    });
    expect((await res.json()).data.slackConfigured).toBe(false);
  });
});

describe("#oncallCalendars.delete", () => {
  it("should delete a calendar", async () => {
    const owner = await buildUser();
    const calendar = await createCalendar(owner);

    const res = await server.post("/api/oncallCalendars.delete", owner, {
      body: { id: calendar.id },
    });
    expect(res.status).toEqual(200);

    const info = await server.post("/api/oncallCalendars.info", owner, {
      body: { id: calendar.id },
    });
    expect(info.status).toEqual(404);
  });
});

describe("#oncallRotations.create", () => {
  it("should create a rotation and resolve the current shift", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const c = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);

    const rotation = await createRotation(owner, calendar.id, [
      owner.id,
      b.id,
      c.id,
    ]);

    expect(rotation.memberIds).toEqual([owner.id, b.id, c.id]);
    expect(rotation.segments).toHaveLength(1);
    expect(rotation.currentShift?.userId).toEqual(c.id);
    expect(rotation.currentShift?.endDate).toEqual(addDays(today, 6));
  });

  it("should reject users from another team", async () => {
    const owner = await buildUser();
    const other = await buildUser();
    const calendar = await createCalendar(owner);

    const res = await server.post("/api/oncallRotations.create", owner, {
      body: {
        calendarId: calendar.id,
        name: "Primary",
        startDate: today,
        startDayOfWeek: 1,
        shiftLengthDays: 7,
        memberIds: [other.id],
      },
    });
    expect(res.status).toEqual(400);
  });
});

describe("#oncallRotations.update", () => {
  it("should not change the start date after the rotation started", async () => {
    const owner = await buildUser();
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);

    const res = await server.post("/api/oncallRotations.update", owner, {
      body: { id: rotation.id, startDate: addDays(today, -3) },
    });
    expect(res.status).toEqual(400);
  });

  it("should change the shift length after the current shift", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id, b.id]);
    const before = await getSchedule(owner, calendar.id, addDays(today, -14), today);

    const res = await server.post("/api/oncallRotations.update", owner, {
      body: { id: rotation.id, shiftLengthDays: 1 },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.shiftLengthDays).toEqual(1);
    expect(body.data.segments).toHaveLength(2);
    expect(body.data.segments[1].effectiveDate).toEqual(addDays(today, 7));

    const after = await getSchedule(owner, calendar.id, addDays(today, -14), today);
    expect(after.rotations).toEqual(before.rotations);
  });
});

describe("#oncallRotations.addMember", () => {
  it("should not change the current or past shifts", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const c = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id, b.id]);
    const before = await getSchedule(
      owner,
      calendar.id,
      addDays(today, -14),
      addDays(today, 6)
    );

    const res = await server.post("/api/oncallRotations.addMember", owner, {
      body: { id: rotation.id, userId: c.id, effectiveDate: today },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.effectiveDate).toEqual(addDays(today, 7));
    expect(body.data.rotation.segments).toHaveLength(2);
    expect(body.data.preview.map((s: { userId: string }) => s.userId)).toEqual(
      [b.id, c.id, owner.id, b.id, c.id, owner.id]
    );

    const after = await getSchedule(
      owner,
      calendar.id,
      addDays(today, -14),
      addDays(today, 6)
    );
    expect(after.rotations).toEqual(before.rotations);
  });

  it("should not persist a preview", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);

    const res = await server.post("/api/oncallRotations.addMember", owner, {
      body: {
        id: rotation.id,
        userId: b.id,
        effectiveDate: today,
        preview: true,
      },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.rotation).toBeUndefined();

    const info = await server.post("/api/oncallCalendars.info", owner, {
      body: { id: calendar.id },
    });
    expect((await info.json()).data.rotations[0].segments).toHaveLength(1);
  });

  it("should reject past effective dates", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);

    const res = await server.post("/api/oncallRotations.addMember", owner, {
      body: { id: rotation.id, userId: b.id, effectiveDate: addDays(today, -1) },
    });
    expect(res.status).toEqual(400);
  });

  it("should not allow members who cannot update the calendar", async () => {
    const owner = await buildUser();
    const member = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);

    const res = await server.post("/api/oncallRotations.addMember", member, {
      body: { id: rotation.id, userId: member.id, effectiveDate: today },
    });
    expect(res.status).toEqual(403);
  });
});

describe("#oncallRotations.removeMember", () => {
  it("should remove a member from the next shift", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const c = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [
      owner.id,
      b.id,
      c.id,
    ]);

    // c is on call now, owner would be next
    const res = await server.post("/api/oncallRotations.removeMember", owner, {
      body: { id: rotation.id, userId: owner.id, effectiveDate: today },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.rotation.currentShift.userId).toEqual(c.id);
    expect(body.data.preview[0].userId).toEqual(b.id);
  });

  it("should reject users who are not members", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);

    const res = await server.post("/api/oncallRotations.removeMember", owner, {
      body: { id: rotation.id, userId: b.id, effectiveDate: today },
    });
    expect(res.status).toEqual(400);
  });
});

describe("#oncallOverrides.create", () => {
  it("should override the schedule for a range", async () => {
    const owner = await buildUser();
    const b = await buildUser({ teamId: owner.teamId });
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);

    const res = await server.post("/api/oncallOverrides.create", owner, {
      body: {
        rotationId: rotation.id,
        userId: b.id,
        startDate: addDays(today, 1),
        endDate: addDays(today, 2),
        reason: "Conference",
      },
    });
    const override = (await res.json()).data;
    expect(res.status).toEqual(200);

    const schedule = await getSchedule(
      owner,
      calendar.id,
      today,
      addDays(today, 3)
    );
    expect(schedule.rotations[0].shifts).toEqual([
      { startDate: today, endDate: today, userId: owner.id },
      {
        startDate: addDays(today, 1),
        endDate: addDays(today, 2),
        userId: b.id,
        overrideId: override.id,
      },
      { startDate: addDays(today, 3), endDate: addDays(today, 3), userId: owner.id },
    ]);
    expect(schedule.overrides).toHaveLength(1);
  });

  it("should reject overlapping overrides", async () => {
    const owner = await buildUser();
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);
    const body = {
      rotationId: rotation.id,
      userId: owner.id,
      startDate: addDays(today, 1),
      endDate: addDays(today, 3),
    };

    const first = await server.post("/api/oncallOverrides.create", owner, {
      body,
    });
    expect(first.status).toEqual(200);

    const second = await server.post("/api/oncallOverrides.create", owner, {
      body: { ...body, startDate: addDays(today, 3), endDate: addDays(today, 4) },
    });
    expect(second.status).toEqual(400);
  });

  it("should reject overrides in the past", async () => {
    const owner = await buildUser();
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);

    const res = await server.post("/api/oncallOverrides.create", owner, {
      body: {
        rotationId: rotation.id,
        userId: owner.id,
        startDate: addDays(today, -2),
        endDate: today,
      },
    });
    expect(res.status).toEqual(400);
  });
});

describe("#oncallOverrides.delete", () => {
  it("should delete an override", async () => {
    const owner = await buildUser();
    const calendar = await createCalendar(owner);
    const rotation = await createRotation(owner, calendar.id, [owner.id]);
    const created = await server.post("/api/oncallOverrides.create", owner, {
      body: {
        rotationId: rotation.id,
        userId: owner.id,
        startDate: today,
        endDate: today,
      },
    });
    const override = (await created.json()).data;

    const res = await server.post("/api/oncallOverrides.delete", owner, {
      body: { id: override.id },
    });
    expect(res.status).toEqual(200);

    const schedule = await getSchedule(owner, calendar.id, today, today);
    expect(schedule.overrides).toHaveLength(0);
  });
});

describe("#oncallCalendars.schedule", () => {
  it("should limit the date range", async () => {
    const owner = await buildUser();
    const calendar = await createCalendar(owner);

    const res = await server.post("/api/oncallCalendars.schedule", owner, {
      body: { id: calendar.id, startDate: today, endDate: addDays(today, 200) },
    });
    expect(res.status).toEqual(400);
  });
});
