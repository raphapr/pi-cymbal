import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

test("package declares a Pi extension manifest", async () => {
  const packageJson = JSON.parse(await readFile(resolve(process.cwd(), "package.json"), "utf8"));
  const extensionPath = packageJson.pi?.extensions?.[0];

  assert.ok(packageJson.keywords.includes("pi-package"));
  assert.equal(extensionPath, "./src/index.ts");
  assert.equal(packageJson.pi.image, "https://raw.githubusercontent.com/raphapr/pi-cymbal/main/assets/pi-cymbal-gallery.png");
  assert.ok(packageJson.files.includes("assets/"));

  const extension = await import(resolve(process.cwd(), extensionPath));
  assert.equal(typeof extension.default, "function");
});
