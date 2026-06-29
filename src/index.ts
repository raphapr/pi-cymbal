import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCymbalHooks } from "./hooks.js";
import { registerChangedTool } from "./tools/changed.js";
import { registerDiffTool } from "./tools/diff.js";
import { registerImpactTool } from "./tools/impact.js";
import { registerImplsTool } from "./tools/impls.js";
import { registerImportersTool } from "./tools/importers.js";
import { registerIndexTool } from "./tools/index.js";
import { registerMapTool } from "./tools/map.js";
import { registerOptionalTools } from "./tools/optional.js";
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
  registerCymbalHooks(pi);
}
