import { createLazyComponent } from "~/components/LazyLoad";
import { Hook, PluginManager } from "~/utils/PluginManager";
import config from "../plugin.json";
import { OnCallIcon } from "./Icon";
import { onCallEmbed } from "./embed";

const CalendarList = createLazyComponent(() => import("./scenes/CalendarList"));
const Calendar = createLazyComponent(() => import("./scenes/Calendar"));

const enabled = (_: unknown, user: { isGuest: boolean }) => !user.isGuest;

PluginManager.add([
  {
    ...config,
    type: Hook.Icon,
    value: OnCallIcon,
  },
  {
    ...config,
    id: "oncall-list",
    type: Hook.Route,
    value: {
      path: "/oncall",
      exact: true,
      component: CalendarList,
      enabled,
    },
  },
  {
    ...config,
    id: "oncall-calendar",
    type: Hook.Route,
    value: {
      path: "/oncall/:id",
      exact: true,
      component: Calendar,
      enabled,
    },
  },
  {
    ...config,
    type: Hook.SidebarItem,
    value: {
      to: "/oncall",
      label: "On-call",
      icon: OnCallIcon,
      preload: CalendarList.preload,
      enabled,
    },
  },
  {
    ...config,
    type: Hook.Embed,
    value: onCallEmbed,
  },
]);
