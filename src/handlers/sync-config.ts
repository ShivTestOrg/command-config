import { checkUserPermissions } from "../helpers/user-permission";
import { Context } from "../types";
import { Scope } from "../types/github";
import { syncAgent } from "./sync-configs-agent";

export async function syncConfigs(context: Context) {
  const { payload, logger, eventName, command } = context;

  if (payload.comment.user?.type === "Bot") {
    throw logger.error("Comment is from a bot. Skipping.");
  }

  // Check user permissions before proceeding allow only if (admin || write)
  // eslint-disable-next-line
  // TODO: Handle Privacy Settings for user
  if ((await checkUserPermissions(context)) === false) {
    throw logger.error("User does not have the required permissions. Skipping.");
  }

  // Use the payload to determine if this is a pull or issue
  if (eventName === "pull_request_review_comment.created") {
    // eslint-disable-next-line
    // TODO: Implement Pull Request Review Comment Support
    throw logger.error("This is a pull request, not supported for now");
  }

  // Fetch the Editor Instruction and Scope
  let editorInstruction;
  let scope: Scope = Scope.REPO;
  if (command && command.name !== "autoedit") {
    editorInstruction = command.parameters.editorInstruction;
    scope = command.parameters.scope as Scope;
  } else if (payload.comment.body.trim().startsWith("/autoedit")) {
    const commentBody = payload.comment.body.trim().replace("/autoedit", "").trim();
    const parts = commentBody.split(" ", 2);
    editorInstruction = parts[0];
    scope = parts[1]?.toUpperCase() === "ORG" ? Scope.ORG : Scope.REPO;
  } else if (!editorInstruction) {
    return { status: 200, reason: logger.info("No editor instruction found in comment. Skipping.").logMessage.raw };
  }
  await syncAgent(editorInstruction, scope, context);
}
