import path from "path";
import { Context } from "../types";
import { Scope } from "../types/github";
import { Target } from "../types/target";
import { checkUserRepoPermissions } from "./user-permission";

export async function targetBuilder(context: Context, scope: Scope): Promise<Record<string, Target>> {
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

    // Check Access to the base targets
    const hasPermission = await checkUserRepoPermissions(context, owner, repo);

    baseTargets.push({
      type: target.type || "main",
      owner,
      repo,
      localDir: path.join(owner, repo),
      url: target.name,
      scope: target.scope === "REPO" ? Scope.REPO : Scope.ORG,
      filePath: target.type === "dev" ? config.devConfigPath : config.configPath,
      readonly: !hasPermission,
    });
  }

  // Add base targets to map
  baseTargets.forEach((target) => {
    targetMap[buildIdForTarget(target)] = target;
  });

  logger.info(`Base targets: ${JSON.stringify(targetMap, null, 2)}`);

  if (scope === Scope.REPO) {
    // For repository scope, only include this repo
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;
    // Add config target for the repo
    const repoTarget: Target = {
      type: "config",
      owner: repoOwner,
      repo: repoName,
      localDir: path.join(repoOwner, repoName),
      url: `https://github.com/${repoOwner}/${repoName}.git`,
      filePath: config.configPath,
      scope: Scope.REPO,
      readonly: false,
    };
    // Add dev config target for the same repo
    const repoDevTarget: Target = {
      ...repoTarget,
      type: "dev",
      scope: Scope.REPO,
      filePath: config.devConfigPath,
      readonly: false,
    };

    targetMap[buildIdForTarget(repoTarget)] = repoTarget;
    targetMap[buildIdForTarget(repoDevTarget)] = repoDevTarget;
  } else if (scope === Scope.ORG) {
    // For organization scope, add the current org for repo target .ubiquity-os.git
    const orgName = payload.repository.owner.login || (payload.organization && payload.organization.login);
    if (!orgName) {
      throw logger.error("Organization not found in payload.");
    }
    const orgRepoTarget: Target = {
      type: "config",
      owner: orgName,
      repo: ".ubiquity-os",
      localDir: path.join(orgName, ".ubiquity-os"),
      url: `https://github.com/${orgName}/.ubiquity-os.git`,
      filePath: config.configPath,
      scope: Scope.ORG,
      readonly: false,
    };

    targetMap[buildIdForTarget(orgRepoTarget)] = orgRepoTarget;
  } else {
    throw logger.error("Invalid scope provided.");
  }

  return targetMap;
}

// ID Builder for the target
function buildIdForTarget(target: Target): string {
  return `${target.owner}/${target.repo}/${target.type}`;
}
