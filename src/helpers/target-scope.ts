import path from "path";
import { Context } from "../types";
import { Scope } from "../types/github";
import { Target } from "../types/target";

export function targetBuilder(context: Context, scope: Scope): Record<string, Target> {
  const { payload, config, logger } = context;
  const targetMap: Record<string, Target> = {};

  const baseTargets: Target[] = config.defaultTargets.map((target) => {
    const match = RegExp(/github\.com\/([^/]+)\/([^/]+)(\.git)?$/).exec(target.name);
    if (!match) {
      throw logger.error(`Invalid GitHub URL: ${target.name}`);
    }
    const owner = match[1];
    const repo = match[2].replace(".git", "");
    return {
      type: target.type || "main",
      owner,
      repo,
      localDir: path.join(owner, repo),
      url: target.name,
      filePath: target.type === "dev" ? config.devConfigPath : config.configPath,
    };
  });

  // Add base targets to map
  baseTargets.forEach((target) => {
    targetMap[target.filePath] = target;
  });

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
    };
    // Add dev config target for the same repo
    const repoDevTarget: Target = {
      ...repoTarget,
      type: "dev",
      filePath: config.devConfigPath,
    };

    targetMap[repoTarget.filePath] = repoTarget;
    targetMap[repoDevTarget.filePath] = repoDevTarget;
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
    };

    targetMap[orgRepoTarget.filePath] = orgRepoTarget;
  } else {
    throw logger.error("Invalid scope provided.");
  }

  return targetMap;
}
