import { createLazyComponent } from "~/components/LazyLoad";
import { Hook, PluginManager } from "~/utils/PluginManager";
import config from "../plugin.json";
import { RetroIcon } from "./Icon";

const RetroList = createLazyComponent(() => import("./scenes/RetroList"));
const Retro = createLazyComponent(() => import("./scenes/Retro"));

const enabled = (_: unknown, user: { isGuest: boolean }) => !user.isGuest;

PluginManager.add([
  {
    ...config,
    type: Hook.Icon,
    value: RetroIcon,
  },
  {
    ...config,
    id: "retro-list",
    type: Hook.Route,
    value: {
      path: "/retros",
      exact: true,
      component: RetroList,
      enabled,
    },
  },
  {
    ...config,
    id: "retro-board",
    type: Hook.Route,
    value: {
      path: "/retros/:id",
      exact: true,
      component: Retro,
      enabled,
    },
  },
  {
    ...config,
    type: Hook.SidebarItem,
    value: {
      to: "/retros",
      label: "Retros",
      icon: RetroIcon,
      preload: RetroList.preload,
      enabled,
    },
  },
]);
