import path from "path";
import { Context } from "../types";
import { Target } from "../types/target";
import { checkOrgPermissions, checkUserRepoPermissions } from "./user-permission";
import { getFileContent } from "./get-file-content";

export async function targetBuilder(context: Context): Promise<Record<string, Target>> {
  const { payload, config, logger } = context;
  const targetMap: Record<string, Target> = {};

  const baseTargets: Target[] = [];
  for (const target of config.defaultTargets) {
    const match = RegExp(/github\.com\/([^/]+)\/([^/]+)(\.git)?$/).exec(target.name);
    if (!match) {
      throw logger.error(`Invalid GitHub URL: ${target.name}`);
    }
    const owner = match[1];
    const repo = match[2].replace(".git", "");

    const hasRepoPermission = await checkUserRepoPermissions(context, owner, repo);

    baseTargets.push({
      type: target.type || "main",
      owner,
      repo,
      localDir: path.join(owner, repo),
      url: target.name,
      filePath: target.type === "dev" ? config.devConfigPath : config.configPath,
      readonly: !hasRepoPermission,
    });
  }

  // Add base targets to map
  baseTargets.forEach((target) => {
    targetMap[buildIdForTarget(target)] = target;
  });

  logger.info(`Base targets: ${JSON.stringify(targetMap, null, 2)}`);

  // Current repository details
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;

  try {
    // Try to get repo level configs
    const repoConfig = await getFileContent(context, repoOwner, repoName, config.configPath);
    const repoDevConfig = await getFileContent(context, repoOwner, repoName, config.devConfigPath);

    // Add repo level configs if they exist
    if (repoConfig || repoDevConfig) {
      // Only add targets for configs that actually exist
      if (repoConfig) {
        const repoTarget: Target = {
          type: "config",
          owner: repoOwner,
          repo: repoName,
          localDir: path.join(repoOwner, repoName),
          url: `https://github.com/${repoOwner}/${repoName}.git`,
          filePath: config.configPath,
          readonly: false,
        };
        targetMap[buildIdForTarget(repoTarget)] = repoTarget;
      }

      // Only add dev config if it exists
      if (repoDevConfig) {
        const repoDevTarget: Target = {
          type: "dev",
          owner: repoOwner,
          repo: repoName,
          localDir: path.join(repoOwner, repoName),
          url: `https://github.com/${repoOwner}/${repoName}.git`,
          filePath: config.devConfigPath,
          readonly: false,
        };
        targetMap[buildIdForTarget(repoDevTarget)] = repoDevTarget;
      }
    }

    // Fall back to org config if no repo configs exist
    const orgName = payload.repository.owner.login || (payload.organization && payload.organization.login);
    if (!orgName) {
      throw logger.error("Organization not found in payload.");
    }

    // Check if org config exists and user has permission
    const orgConfig = await getFileContent(context, orgName, ".ubiquity-os", config.configPath);
    if (!orgConfig) {
      logger.info("No configuration found at repository or organization level.");
      return targetMap; // Return just the base targets
    }

    const hasOrgPermission = await checkOrgPermissions(context, orgName, ".ubiquity-os");
    const orgRepoTarget: Target = {
      type: "config",
      owner: orgName,
      repo: ".ubiquity-os",
      localDir: path.join(orgName, ".ubiquity-os"),
      url: `https://github.com/${orgName}/.ubiquity-os.git`,
      filePath: config.configPath,
      readonly: !hasOrgPermission,
    };

    targetMap[buildIdForTarget(orgRepoTarget)] = orgRepoTarget;
  } catch (error: unknown) {
    // Log the error but don't throw - allow operation to continue
    logger.info(`Error accessing configurations: ${error || "Unknown error"}`);
  }

  return targetMap;
}

// ID Builder for the target
function buildIdForTarget(target: Target): string {
  return `${target.owner}/${target.repo}/${target.type}`;
}
