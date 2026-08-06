import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { loadCymbalConfig } from "../src/config.ts";

test("loadCymbalConfig merges trusted project settings over global settings", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-cymbal-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const agentDir = join(root, "agent");
  const cwd = join(root, "repo");
  await mkdir(join(agentDir, "extensions"), { recursive: true });
  await mkdir(join(cwd, ".pi"), { recursive: true });
  await writeFile(join(agentDir, "extensions", "pi-cymbal.json"), JSON.stringify({ systemPrompt: false }));
  await writeFile(join(cwd, ".pi", "pi-cymbal.json"), JSON.stringify({ systemPrompt: true, nudges: false }));

  assert.deepEqual(loadCymbalConfig(cwd, true, agentDir), { systemPrompt: true, nudges: false });
  assert.deepEqual(loadCymbalConfig(cwd, false, agentDir), { systemPrompt: false, nudges: true });
});
