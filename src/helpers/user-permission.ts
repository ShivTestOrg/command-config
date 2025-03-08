import { Context } from "../types";
import { Scope } from "../types/github";

async function checkUserRepoPermissions(context: Context, owner: string, repo: string): Promise<boolean> {
  const { octokit, logger } = context;
  const sender = context.payload.comment.user?.login;
  if (!sender) {
    throw logger.error("Sender not found in payload.");
  }
  const permissions = await octokit.rest.repos.getCollaboratorPermissionLevel({
    owner,
    repo,
    username: sender,
  });
  return permissions.data.permission === "admin" || permissions.data.permission === "write";
}

// Function to determine if the user is an admin for a repo/organization
export async function checkUserPermissions(context: Context, scope?: Scope, owner?: string, repo?: string): Promise<boolean> {
  // Fetch the sender's username
  const { payload, logger, octokit, config } = context;

  // Fetch the sender's username
  const sender = payload.comment.user?.login;

  if (!sender) {
    throw logger.error("Sender not found in payload.");
  }

  // Check permissions for default targets and reject on first failure
  if (config.defaultTargets && config.defaultTargets.length > 0) {
    await Promise.all(
      config.defaultTargets.map(async (target) => {
        const match = RegExp(/github\.com\/([^/]+)\/([^/]+)(\.git)?$/).exec(target.name);
        if (!match) {
          throw logger.error(`Invalid GitHub URL: ${target.name}`);
        }
        const targetOwner = match[1];
        const targetRepo = match[2].replace(".git", "");
        const hasPermission = await checkUserRepoPermissions(context, targetOwner, targetRepo);
        if (!hasPermission) {
          throw new Error(`User ${sender} lacks permission for ${target.name}`);
        }
      })
    );
  }

  // Extract repository or organization information
  const repository = payload.repository;
  if (!owner || !repo) {
    if (!repository) {
      throw logger.error("Repository not found in payload.");
    }
    owner = repository.organization?.login || repository.owner.login;
    repo = repository.name;
  }

  const hasPermission = await checkUserRepoPermissions(context, owner, repo);
  if (scope && scope === "REPO") return hasPermission;

  // Check user permissions for current organization if scope is not REPO
  const orgPermissions = await octokit.rest.orgs.checkMembershipForUser({
    org: owner,
    username: sender,
  });
  // eslint-disable-next-line
  // TODO: Handle Privacy Settings for user (hide membership?)
  return orgPermissions.headers.status === "204";
}
