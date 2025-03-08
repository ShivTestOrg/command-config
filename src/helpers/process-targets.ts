import { getFileContent } from "./get-file-content";
import { Context } from "../types";
import { Target } from "../types/target";
import { applyChanges } from "./apply-changes";
import { parseConfig } from "./validator";
import { Manifest } from "../types/github";
import { fetchManifests } from "./fetch-manifests";

export async function processTargetRepos(target: Target, parserCode: string, editorInstrcution: string, context: Context): Promise<string | undefined> {
  const currentFileContents = await getFileContent(context, target.owner, target.repo, target.filePath);
  if (!currentFileContents) throw context.logger.error("File content not found. for target: " + JSON.stringify(target));

  // Parse Config
  const parsedUrls = parseConfig(currentFileContents, context.logger);

  const manifestCache: Record<string, Manifest> = {};
  // Fetch Manifest
  const manifests = await fetchManifests(parsedUrls, manifestCache, context);
  console.log(manifests);
  context.logger.info(`Fetched ${manifests.length} manifests`);

  // Build Prompt
  const { adapters } = context;
  const prompt = adapters.openai.completions.promptBuilder(currentFileContents, parserCode, JSON.stringify(manifests), target.url);

  context.logger.info(`Prompt: ${prompt}`);
  // Update the file with the new content by making a LLM call
  const llmResponse = await adapters.openai.completions.createCompletions(prompt, editorInstrcution);

  // Log the updated file contents
  context.logger.info(`Updated file contents: ${JSON.stringify(llmResponse)}`);
  const updatedFileContents = llmResponse.text;

  // eslint-disable-next-line
  const diffConfirmed = true; // This should be a result of a diff check
  if (diffConfirmed) {
    // Apply Changes
    const { pullRequestUrl } = await applyChanges(target, updatedFileContents, context);
    context.logger.info(`Pull request created: ${pullRequestUrl}`);
    return pullRequestUrl;
  } else {
    context.logger.info("Changes not confirmed. Skipping the update.");
  }
}
