import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import "./models";
import "./policies";
import retros from "./api/retros";

PluginManager.add([
  {
    ...config,
    type: Hook.API,
    value: retros,
  },
]);
