import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import useCurrentUser from "~/hooks/useCurrentUser";
import { Hook, PluginManager } from "~/utils/PluginManager";
import SidebarLink from "./SidebarLink";

/**
 * Renders the sidebar links registered by client plugins.
 */
export const PluginLinks = observer(function PluginLinks() {
  const { t } = useTranslation();
  const team = useCurrentTeam();
  const user = useCurrentUser();

  return (
    <>
      {PluginManager.getHooks(Hook.SidebarItem)
        .filter((plugin) => plugin.value.enabled?.(team, user) ?? true)
        .map((plugin) => {
          const { to, label, icon: Icon, preload } = plugin.value;

          return (
            <SidebarLink
              key={plugin.id}
              to={to}
              icon={<Icon />}
              exact={false}
              label={t(label)}
              onClickIntent={preload ? () => void preload() : undefined}
            />
          );
        })}
    </>
  );
});
