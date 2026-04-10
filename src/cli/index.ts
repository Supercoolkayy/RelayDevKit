#!/usr/bin/env node

import { Command } from "commander";
import { up } from "./commands/up.js";
import { down } from "./commands/down.js";
import { status } from "./commands/status.js";
import { logs } from "./commands/logs.js";

const program = new Command();

program
  .name("relaydevkit")
  .description("RelayDevKit CLI")
  .version("0.1.0");

program.command("up").action(up);
program.command("down").action(down);
program.command("status").action(status);
program.command("logs").action(logs);

program.parse();