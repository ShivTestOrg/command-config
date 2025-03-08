import { getFileContent } from "../helpers/get-file-content";
import { processTargetRepos } from "../helpers/process-targets";
import { targetBuilder } from "../helpers/target-scope";
import { Context } from "../types";
import { Scope } from "../types/github";

export async function syncAgent(editorInstruction: string, scope: Scope, context: Context) {
  const { logger, config } = context;

  //Build target scope could be either (ORG | REPO)
  const targets = targetBuilder(context, scope);

  // Use the config to get the parser details
  const match = RegExp(/github\.com\/([^/]+)\/([^/]+)(\.git)?$/).exec(config.parserPath);
  if (!match) {
    throw logger.error(`Invalid GitHub URL: ${config.parserPath}`);
  }
  const owner = match[1];
  const repo = match[2].replace(".git", "");

  // Fetch the parse code
  const parserCode = await getFileContent(context, owner, repo, "src/github/types/plugin-configuration.ts");
  // Run the Repo Config Extractor on the targets (by this point we know the sender has permissions to the targets)
  for (const target of Object.values(targets)) {
    await processTargetRepos(target, parserCode, editorInstruction, context);
    console.log(target, parserCode, editorInstruction);
  }
}
