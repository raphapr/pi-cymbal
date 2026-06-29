import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildChangedArgs, ChangedParams, type ChangedArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerChangedTool(pi: ExtensionAPI): void {
  registerCymbalTool<ChangedArgs>(pi, {
    name: "cymbal_changed",
    label: "Cymbal Changed",
    description:
      "Review what your current git diff affects in one call with `cymbal changed`. Reports the changed symbols and their references plus transitive impact.",
    parameters: ChangedParams,
    buildArgs: buildChangedArgs,
    availabilityCommand: "changed",
    promptSnippet:
      "cymbal_changed: Review what your current git diff affects (changed symbols, references, transitive impact) in one call.",
    promptGuidelines: [
      "Use cymbal_changed to see the references and transitive impact of your uncommitted changes before refactors or PRs.",
      "Use staged to scope to staged changes, or base to diff against a git ref; the two cannot be combined.",
    ],
  });
}
