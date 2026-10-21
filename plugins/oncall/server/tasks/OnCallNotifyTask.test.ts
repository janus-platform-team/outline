import { randomUUID } from "node:crypto";
import { http, HttpResponse } from "msw";
import { buildUser } from "@server/test/factories";
import { server } from "@server/test/msw";
import type { User } from "@server/models";
import { addDays, dayOfWeek } from "../../shared/dates";
import {
  OnCallCalendar,
  OnCallOverride,
  OnCallRotation,
  OnCallRotationSegment,
} from "../models";
import OnCallNotifyTask from "./OnCallNotifyTask";

const today = "2026-10-26";
const requests: { url: string; body: { text: string } }[] = [];
const props = {
  limit: 100,
  partition: { partitionIndex: 0, partitionCount: 1 },
};

async function setup(options: {
  members: User[];
  startDate: string;
  notifyHour?: number;
  notifyOnChange?: boolean;
}) {
  const [owner] = options.members;
  const webhookUrl = `https://hooks.slack.com/services/${randomUUID()}`;
  const calendar = await OnCallCalendar.create({
    name: "Platform",
    timezone: "UTC",
    notifyHour: options.notifyHour ?? 9,
    slackWebhookUrl: webhookUrl,
    teamId: owner.teamId,
    createdById: owner.id,
  });
  const rotation = await OnCallRotation.create({
    calendarId: calendar.id,
    name: "Primary",
    color: "#0366d6",
    startDate: options.startDate,
    startDayOfWeek: dayOfWeek(options.startDate),
    shiftLengthDays: 7,
    notifyOnChange: options.notifyOnChange ?? true,
  });
  await OnCallRotationSegment.create({
    rotationId: rotation.id,
    effectiveDate: options.startDate,
    memberIds: options.members.map((member) => member.id),
    startIndex: 0,
    shiftLengthDays: 7,
  });

  return { calendar, rotation, webhookUrl };
}

function callsFor(webhookUrl: string) {
  return requests
    .filter((request) => request.url === webhookUrl)
    .map((request) => request.body);
}

describe("OnCallNotifyTask", () => {
  beforeEach(() => {
    server.use(
      http.post(/^https:\/\/hooks\.slack\.com\//, async ({ request }) => {
        requests.push({
          url: request.url,
          body: (await request.json()) as { text: string },
        });
        return HttpResponse.text("ok");
      })
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${today}T10:00:00Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifies once when the on-call user changes", async () => {
    const a = await buildUser({ name: "Ada" });
    const b = await buildUser({ teamId: a.teamId, name: "Grace" });
    const { rotation, webhookUrl } = await setup({
      members: [a, b],
      startDate: addDays(today, -7),
    });

    await new OnCallNotifyTask().perform(props);
    await new OnCallNotifyTask().perform(props);

    const calls = callsFor(webhookUrl);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain("Grace is now on call");
    expect(calls[0].text).toContain("Previously: Ada");

    await rotation.reload();
    expect(rotation.lastNotifiedDate).toEqual(today);
  });

  it("does not notify when the on-call user is unchanged", async () => {
    const a = await buildUser();
    const b = await buildUser({ teamId: a.teamId });
    const { rotation, webhookUrl } = await setup({
      members: [a, b],
      startDate: addDays(today, -3),
    });

    await new OnCallNotifyTask().perform(props);

    expect(callsFor(webhookUrl)).toHaveLength(0);
    await rotation.reload();
    expect(rotation.lastNotifiedDate).toEqual(today);
  });

  it("waits until the notify hour", async () => {
    const a = await buildUser();
    const b = await buildUser({ teamId: a.teamId });
    const { rotation, webhookUrl } = await setup({
      members: [a, b],
      startDate: addDays(today, -7),
      notifyHour: 11,
    });

    await new OnCallNotifyTask().perform(props);
    expect(callsFor(webhookUrl)).toHaveLength(0);
    await rotation.reload();
    expect(rotation.lastNotifiedDate).toBeNull();

    vi.setSystemTime(new Date(`${today}T11:00:00Z`));
    await new OnCallNotifyTask().perform(props);
    expect(callsFor(webhookUrl)).toHaveLength(1);
  });

  it("notifies when an override starts", async () => {
    const a = await buildUser();
    const b = await buildUser({ teamId: a.teamId, name: "Linus" });
    const { rotation, webhookUrl } = await setup({
      members: [a],
      startDate: addDays(today, -3),
    });
    await OnCallOverride.create({
      rotationId: rotation.id,
      userId: b.id,
      createdById: a.id,
      startDate: today,
      endDate: addDays(today, 1),
    });

    await new OnCallNotifyTask().perform(props);

    const calls = callsFor(webhookUrl);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain("Linus is now on call");
  });

  it("skips rotations without notifications enabled", async () => {
    const a = await buildUser();
    const b = await buildUser({ teamId: a.teamId });
    const { webhookUrl } = await setup({
      members: [a, b],
      startDate: addDays(today, -7),
      notifyOnChange: false,
    });

    await new OnCallNotifyTask().perform(props);
    expect(callsFor(webhookUrl)).toHaveLength(0);
  });
});
