import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import "./models";
import "./policies";
import oncall from "./api/oncall";
import OnCallNotifyTask from "./tasks/OnCallNotifyTask";

PluginManager.add([
  {
    ...config,
    type: Hook.API,
    value: oncall,
  },
  {
    type: Hook.Task,
    value: OnCallNotifyTask,
  },
]);
