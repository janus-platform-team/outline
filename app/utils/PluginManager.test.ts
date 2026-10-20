import { createLazyComponent } from "~/components/LazyLoad";
import { Hook, PluginManager } from "./PluginManager";

const SettingsComponent = () => null;
const Icon = () => null;
const component = createLazyComponent(async () => ({
  default: SettingsComponent,
}));

describe("PluginManager", () => {
  it("returns registered hooks from observable plugin arrays", () => {
    PluginManager.add([
      {
        id: "test-settings-plugin-low",
        name: "Low priority plugin",
        type: Hook.Settings,
        priority: 20,
        value: {
          group: "Integrations",
          icon: Icon,
          component,
        },
      },
      {
        id: "test-settings-plugin-high",
        name: "High priority plugin",
        type: Hook.Settings,
        priority: 10,
        value: {
          group: "Integrations",
          icon: Icon,
          component,
        },
      },
    ]);

    const hooks = PluginManager.getHooks(Hook.Settings).filter((plugin) =>
      plugin.id.startsWith("test-settings-plugin")
    );

    expect(hooks.map((plugin) => plugin.id)).toEqual([
      "test-settings-plugin-high",
      "test-settings-plugin-low",
    ]);
  });

  it("returns registered route and sidebar item hooks", () => {
    PluginManager.add([
      {
        id: "test-route-plugin",
        name: "Route plugin",
        type: Hook.Route,
        value: {
          path: "/test-route",
          exact: true,
          component,
        },
      },
      {
        id: "test-sidebar-plugin",
        name: "Sidebar plugin",
        type: Hook.SidebarItem,
        value: {
          to: "/test-route",
          label: "Test",
          icon: Icon,
        },
      },
    ]);

    expect(
      PluginManager.getHook(Hook.Route, "test-route-plugin")?.value.path
    ).toEqual("/test-route");
    expect(
      PluginManager.getHook(Hook.SidebarItem, "test-sidebar-plugin")?.value.to
    ).toEqual("/test-route");
  });
});
