import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadCymbalConfig } from "./config.js";
import { abortCymbalSession, startCymbalSession, waitForCymbalOperations } from "./cymbal.js";
import { registerCymbalHooks, type HookContext } from "./hooks.js";
import { cleanupSpills, startSpillSession, stopSpillSession, waitForSpillFinalizers } from "./spill.js";
import { registerChangedTool } from "./tools/changed.js";
import { registerDiffTool } from "./tools/diff.js";
import { registerImpactTool } from "./tools/impact.js";
import { registerImplsTool } from "./tools/impls.js";
import { registerImportersTool } from "./tools/importers.js";
import { registerIndexTool } from "./tools/index.js";
import { registerMapTool } from "./tools/map.js";
import { clearAvailabilityCache, registerOptionalTools } from "./tools/optional.js";
import { registerOutlineTool } from "./tools/outline.js";
import { registerRefsTool } from "./tools/refs.js";
import { registerSearchTool } from "./tools/search.js";
import { registerShowTool } from "./tools/show.js";
import { registerStructureTool } from "./tools/structure.js";

export default function cymbalExtension(pi: ExtensionAPI): void {
  registerMapTool(pi);
  registerStructureTool(pi);
  registerDiffTool(pi);
  registerIndexTool(pi);
  registerSearchTool(pi);
  registerOutlineTool(pi);
  registerShowTool(pi);
  registerRefsTool(pi);
  registerImpactTool(pi);
  registerImportersTool(pi);
  registerImplsTool(pi);
  registerChangedTool(pi);
  registerOptionalTools(pi);
  const hooks = registerCymbalHooks(pi);

  pi.on("session_start", async (_event: unknown, ctx: HookContext) => {
    startSpillSession();
    startCymbalSession();
    await hooks.startSession(loadCymbalConfig(ctx.cwd, ctx.isProjectTrusted?.() ?? false));
    await hooks.refreshReminder(ctx);
  });

  pi.on("session_shutdown", async () => {
    const failures: unknown[] = [];
    abortCymbalSession(new DOMException("Cymbal session shut down", "AbortError"));
    stopSpillSession();
    try {
      for (const result of await Promise.allSettled([hooks.shutdown(), waitForCymbalOperations(), waitForSpillFinalizers()])) {
        if (result.status === "rejected") failures.push(result.reason);
      }
    } finally {
      try {
        await cleanupSpills();
      } catch (error) {
        failures.push(error);
      } finally {
        clearAvailabilityCache();
      }
    }
    if (failures.length) throw new AggregateError(failures, "Cymbal session cleanup failed");
  });
}
