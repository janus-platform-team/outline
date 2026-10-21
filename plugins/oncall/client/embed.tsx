import { escapeRegExp } from "es-toolkit/compat";
import { lazy, Suspense } from "react";
import type { EmbedProps } from "@shared/editor/embeds";
import { EmbedDescriptor } from "@shared/editor/embeds";
import env from "~/env";
import { OnCallIcon } from "./Icon";

const LazyOnCallEmbed = lazy(() => import("./components/OnCallEmbed"));

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Returns the regular expressions that match links to on-call calendars on
 * this installation, capturing the calendar id.
 *
 * @returns the regular expressions.
 */
export function calendarLinkRegexes(): RegExp[] {
  const origins = [
    ...new Set([env.URL, window.location.origin].filter(Boolean)),
  ];
  return origins.map(
    (origin) =>
      new RegExp(`^${escapeRegExp(origin)}/oncall/(${uuid})(?:[?#].*)?$`, "i")
  );
}

function OnCallEmbedLoader(props: EmbedProps) {
  return (
    <Suspense fallback={null}>
      <LazyOnCallEmbed {...props} />
    </Suspense>
  );
}

/** The embed that renders an on-call calendar inline in documents. */
export const onCallEmbed = new EmbedDescriptor({
  id: "oncall",
  title: "On-call calendar",
  keywords: "oncall on-call rotation schedule pager shift",
  icon: <OnCallIcon size={18} />,
  placeholder: "Paste an on-call calendar link…",
  hideToolbar: true,
  regexMatch: calendarLinkRegexes(),
  component: OnCallEmbedLoader,
});
