import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import "./models";
import "./policies";
import oncall from "./api/oncall";

PluginManager.add([
  {
    ...config,
    type: Hook.API,
    value: oncall,
  },
]);
