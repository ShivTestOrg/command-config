import { getFileContent } from "./get-file-content";
import { Context } from "../types";
import { Target } from "../types/target";
import { applyChanges } from "./apply-changes";

export async function processTargetRepos(target: Target, parserCode: string, editorInstrcution: string, context: Context) {
  const currentFileContents = await getFileContent(context, target.owner, target.repo, target.filePath);
  // Update the file with the new content by making a LLM call
  const updatedFileContents = currentFileContents + "\n" + "Hello World!"; // This is a dummy update
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const diffConfirmed = true; // This should be a result of a diff check
  if (diffConfirmed) {
    // Apply Changes
    const { pullRequestUrl } = await applyChanges(target, updatedFileContents, context);
    context.logger.info(`Pull request created: ${pullRequestUrl}`);
  } else {
    context.logger.info("Changes not confirmed. Skipping the update.");
  }
}
