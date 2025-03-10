import { checkUserPermissions } from "../helpers/user-permission";
import { Context } from "../types";
import { Scope } from "../types/github";
import { syncAgent } from "./sync-configs-agent";

export async function syncConfigs(context: Context) {
  const { payload, logger, eventName } = context;

  if (payload.comment.user?.type === "Bot") {
    throw logger.error("Comment is from a bot. Skipping.");
  }

  // Use the payload to determine if this is a pull or issue
  if (eventName === "pull_request_review_comment.created") {
    // eslint-disable-next-line
    // TODO: Implement Pull Request Review Comment Support
    throw logger.error("This is a pull request, not supported for now");
  }

  // Fetch the Editor Instruction and Scope
  const result = extractEditorInstructionAndScope(context);
  if (!result) {
    return { status: 200, reason: logger.info("No editor instruction found in comment. Skipping.").logMessage.raw };
  }
  const { editorInstruction, scope } = result;

  // Check user permissions before proceeding allow only if (admin || write)
  // eslint-disable-next-line
  // TODO: Handle Privacy Settings for user
  if ((await checkUserPermissions(context, scope)) === false) {
    throw logger.error("User does not have the required permissions. Skipping.");
  }

  const prUrls = await syncAgent(editorInstruction, scope, context);
  if (prUrls.length === 0) {
    return { status: 200, reason: logger.info("No pull requests created.").logMessage.raw };
  } else {
    const pluralSuffix = prUrls.length > 1 ? "s" : "";
    const prList = prUrls
      .map((url) => {
        return `- ${url}`;
      })
      .join("\n");
    const message = `Successfully created ${prUrls.length} pull request${pluralSuffix}:\n\n${prList}`;
    await context.commentHandler.postComment(context, logger.ok(message));
    return { status: 200, reason: logger.info(message).logMessage.raw };
  }
}

function extractEditorInstructionAndScope(context: Context): { editorInstruction: string; scope: Scope } | null {
  const { payload, command, logger } = context;

  let editorInstruction;
  let scope;

  if (command && command.name !== "config") {
    editorInstruction = command.parameters.editorInstruction;
    scope = command.parameters.scope as Scope;
  } else if (payload.comment.body.trim().startsWith("/config")) {
    const commentBody = payload.comment.body.trim().replace("/config", "").trim();
    const parts = commentBody.split(" ");
    const scopeValue = parts[0]?.toUpperCase();

    if (!scopeValue || scopeValue.trim() === "") {
      throw logger.error("Scope value cannot be empty. Please provide a valid scope value.");
    }

    if (!Object.values(Scope).includes(scopeValue as Scope)) {
      throw logger.error(`Invalid scope value: ${scopeValue}. Valid values are: ${Object.values(Scope).join(", ")}`);
    }

    scope = scopeValue === Scope.ORG ? Scope.ORG : Scope.REPO;
    editorInstruction = parts.slice(1).join(" ");
  } else {
    return null;
  }
  if (!editorInstruction || editorInstruction.trim() === "") {
    throw logger.error("Editor instruction cannot be empty. Please provide editing instructions.");
  }

  return { editorInstruction, scope };
}
