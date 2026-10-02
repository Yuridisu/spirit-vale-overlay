// Serves the companion on its own, without the game or the desktop shell, to work on its pages.
//   bun run packages/companion/scripts/dev.ts [data directory]
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildCompanionRenderer } from "../../../apps/desktop/src/build-shared.ts";
import { createCompanionService } from "../src/bun/service.ts";
import { playWav } from "../src/bun/sound-player.ts";

const workspace = path.resolve(import.meta.dir, "../../..");
const scratch = mkdtempSync(path.join(os.tmpdir(), "companion-dev-"));
const rendererDirectory = path.join(scratch, "renderer");
await buildCompanionRenderer({ workspace, outdir: rendererDirectory });
const service = await createCompanionService({
  dataDirectory: process.argv[2] ?? path.join(scratch, "data"),
  rendererDirectory,
  version: "dev",
  playSound: playWav,
});
service.activate();
console.log(`Companion ready at ${service.origin}`);
