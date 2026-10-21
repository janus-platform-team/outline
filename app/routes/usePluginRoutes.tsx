import Route from "~/components/ProfiledRoute";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import useCurrentUser from "~/hooks/useCurrentUser";
import { Hook, PluginManager } from "~/utils/PluginManager";

/**
 * Returns the routes registered by client plugins as `Route` elements. They are
 * returned as an array rather than wrapped in a component so that they can be
 * placed directly inside a `Switch`.
 *
 * @returns the plugin route elements.
 */
export function usePluginRoutes() {
  const team = useCurrentTeam();
  const user = useCurrentUser();

  return PluginManager.getHooks(Hook.Route)
    .filter((plugin) => plugin.value.enabled?.(team, user) ?? true)
    .map((plugin) => (
      <Route
        key={plugin.id}
        exact={plugin.value.exact}
        path={plugin.value.path}
        component={plugin.value.component.Component}
      />
    ));
}
