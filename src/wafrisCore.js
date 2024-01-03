import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const base = dirname(fileURLToPath(import.meta.url));

const core = readFileSync(
  path.join(base, "../lib/lua/dist/wafris_core.lua"),
  "utf8",
);

export default core;
