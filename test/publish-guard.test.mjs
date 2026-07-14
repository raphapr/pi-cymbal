import assert from "node:assert/strict";
import test from "node:test";
import { ensureVersionUnpublished, publishDecision } from "../scripts/check-publish.mjs";

const version = "0.5.0";

test("publish guard allows branch dry runs", () => {
  assert.deepEqual(
    publishDecision({ eventName: "workflow_dispatch", dryRun: true, refType: "branch", refName: "main", version }),
    { dryRun: true, publish: false },
  );
});

test("publish guard rejects live publishing from a branch", () => {
  assert.throws(
    () => publishDecision({ eventName: "workflow_dispatch", dryRun: false, refType: "branch", refName: "main", version }),
    /exact tag v0\.5\.0/,
  );
});

test("publish guard accepts a matching live tag", () => {
  for (const eventName of ["release", "workflow_dispatch"]) {
    assert.deepEqual(
      publishDecision({ eventName, dryRun: false, refType: "tag", refName: "v0.5.0", version }),
      { dryRun: false, publish: true },
    );
  }
});

test("publish guard rejects a mismatched tag", () => {
  assert.throws(
    () => publishDecision({ eventName: "release", dryRun: false, refType: "tag", refName: "v0.4.9", version }),
    /exact tag v0\.5\.0/,
  );
});

test("publish guard rejects already published versions", () => {
  assert.throws(
    () => ensureVersionUnpublished({
      name: "pi-cymbal",
      version,
      runNpmView: () => ({ status: 0, stdout: version, stderr: "" }),
    }),
    /already published/,
  );
});

test("publish guard permits npm E404 for an unpublished version", () => {
  assert.doesNotThrow(() => ensureVersionUnpublished({
    name: "pi-cymbal",
    version,
    runNpmView: () => ({ status: 1, stdout: "", stderr: "npm error code E404\nnpm error 404 'pi-cymbal@0.5.0' is not in this registry" }),
  }));
});

test("publish guard rejects unrelated generic 404 responses", () => {
  assert.throws(
    () => ensureVersionUnpublished({
      name: "pi-cymbal",
      version,
      runNpmView: () => ({ status: 1, stdout: "", stderr: "404 Not Found: proxy endpoint" }),
    }),
    /Could not prove/,
  );
});

test("publish guard fails closed on registry errors", () => {
  assert.throws(
    () => ensureVersionUnpublished({
      name: "pi-cymbal",
      version,
      runNpmView: () => ({ status: 1, stdout: "", stderr: "npm error code ECONNRESET" }),
    }),
    /Could not prove/,
  );
});
