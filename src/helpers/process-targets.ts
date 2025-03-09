import { getFileContent } from "./get-file-content";
import { Context } from "../types";
import { Target } from "../types/target";
import { applyChanges } from "./apply-changes";
import { parseConfig, PluginLocation } from "./validator";
import { Manifest } from "../types/github";
import { fetchManifests } from "./fetch-manifests";

export async function processTargetRepos(
  target: Target,
  parserCode: string,
  editorInstrcution: string,
  context: Context,
  manifestStore?: Record<string, Manifest>
): Promise<string | undefined> {
  const { currentFileContents, manifests, addlManifests } = await fetchAndParseFileContent(context, target, manifestStore);

  // Build Prompt
  const { adapters } = context;
  const prompt = adapters.openai.completions.promptBuilder(currentFileContents, parserCode, manifests, target.url, addlManifests);

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

export async function fetchAndParseFileContent(context: Context, target: Target, manifestStore?: Record<string, Manifest>) {
  const currentFileContents = await getFileContent(context, target.owner, target.repo, target.filePath);
  if (!currentFileContents) throw context.logger.error("File content not found. for target: " + JSON.stringify(target));

  // Parse Config
  const parsedUrls = parseConfig(currentFileContents, context.logger);
  // Manifest Cache (to avoid fetching the same manifest multiple times)
  const manifestCache: Record<string, Manifest> = manifestStore || {};
  // Fetch Manifest
  const manifests = await fetchManifests(parsedUrls, manifestCache, context);
  // Fetch Additional Manifests
  const addlManifests: Manifest[] = filterManifestCacheByOwner(manifestCache, parsedUrls);
  return { currentFileContents, manifests, addlManifests };
}

function filterManifestCacheByOwner(manifestCache: Record<string, Manifest>, target: PluginLocation[]): Manifest[] {
  const manifestOwners = target.map((t) => (typeof t === "string" ? t : `${t.owner}/${t.repo}/${t.ref}`));
  return Object.keys(manifestCache)
    .filter((key) => {
      return !manifestOwners.includes(key);
    })
    .filter((key) => {
      //Now We will check for keys starting with the owner (For now we ignore worker plugins)
      for (const refKey of manifestOwners) {
        const owner = refKey.split("/")[0]; // Handle the case where the target is a string
        if (key.startsWith(owner)) {
          return true;
        }
      }
    })
    .map((key) => manifestCache[key]);
}
