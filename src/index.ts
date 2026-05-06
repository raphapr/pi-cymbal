import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerCymbalHooks } from "./hooks.js";
import { registerImpactTool } from "./tools/impact.js";
import { registerImplsTool } from "./tools/impls.js";
import { registerImportersTool } from "./tools/importers.js";
import { registerMapTool } from "./tools/map.js";
import { registerOptionalTools } from "./tools/optional.js";
import { registerOutlineTool } from "./tools/outline.js";
import { registerRefsTool } from "./tools/refs.js";
import { registerSearchTool } from "./tools/search.js";
import { registerShowTool } from "./tools/show.js";

export default function cymbalExtension(pi: ExtensionAPI): void {
  registerMapTool(pi);
  registerSearchTool(pi);
  registerOutlineTool(pi);
  registerShowTool(pi);
  registerRefsTool(pi);
  registerImpactTool(pi);
  registerImportersTool(pi);
  registerImplsTool(pi);
  registerOptionalTools(pi);
  registerCymbalHooks(pi);
}
