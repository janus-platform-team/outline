import Logger from "@server/logging/Logger";
import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import router from "./auth/awsSaml";
import env from "./env";

const enabled = !!env.AWS_SAML_SSO_ENDPOINT && !!env.AWS_SAML_CERT;

if (enabled) {
  PluginManager.add([
    {
      ...config,
      type: Hook.AuthProvider,
      value: { router, id: config.id },
      name: env.AWS_SAML_DISPLAY_NAME || config.name,
    },
  ]);
  Logger.info("plugins", "AWS Identity Center (SAML) plugin registered");
}
