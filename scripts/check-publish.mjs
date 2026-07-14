import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function publishDecision({ eventName, dryRun, refType, refName, version }) {
  const isDryRun = eventName === "workflow_dispatch" && dryRun;
  if (isDryRun) return { dryRun: true, publish: false };

  const isLive = eventName === "release" || eventName === "workflow_dispatch";
  if (!isLive) throw new Error(`Unsupported publish event: ${eventName || "<empty>"}`);

  const expectedTag = `v${version}`;
  if (refType !== "tag" || refName !== expectedTag) {
    throw new Error(`Live publish requires the exact tag ${expectedTag}; received ${refType || "<empty>"} ${refName || "<empty>"}`);
  }

  return { dryRun: false, publish: true };
}

export function ensureVersionUnpublished({ name, version, runNpmView = defaultNpmView }) {
  const result = runNpmView(name, version);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");

  if (result.status === 0) {
    throw new Error(`${name}@${version} is already published`);
  }

  const spec = `${name}@${version}`;
  if (/\bE404\b/.test(output) && output.includes(spec)) return;
  throw new Error(`Could not prove ${name}@${version} is unpublished:\n${output || `npm exited ${result.status}`}`);
}

function defaultNpmView(name, version) {
  return spawnSync("npm", ["view", `${name}@${version}`, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readPackage() {
  return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
}

function parseBoolean(value) {
  return value === "true" || value === "1";
}

export function main(env = process.env) {
  const packageJson = readPackage();
  const decision = publishDecision({
    eventName: env.GITHUB_EVENT_NAME,
    dryRun: parseBoolean(env.INPUT_DRY_RUN),
    refType: env.GITHUB_REF_TYPE,
    refName: env.GITHUB_REF_NAME,
    version: packageJson.version,
  });

  if (decision.publish) {
    ensureVersionUnpublished({ name: packageJson.name, version: packageJson.version });
    console.log(`Live publish guard passed for ${packageJson.name}@${packageJson.version}`);
  } else {
    console.log(`Dry-run guard passed for ${packageJson.name}@${packageJson.version}`);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedPath === import.meta.url) main();
