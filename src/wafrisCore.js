import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const base = dirname(fileURLToPath(import.meta.url));

export default readFileSync(
  path.join(base, "../lib/lua/dist/wafris_core.lua"),
  "utf8",
);
