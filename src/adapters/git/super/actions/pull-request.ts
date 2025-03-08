import { Context } from "../../../../types/context";
import { Target } from "../../../../types/target";
import { GitSuper } from "../index";

export class PullRequest extends GitSuper {
  constructor(context: Context) {
    super(context);
  }

  async create(target: Target, fileContent: string, commitMessage: string = "Update file content") {
    const { owner, repo, filePath } = target;

    try {
      // Get the default branch
      const { data: repository } = await this._context.octokit.rest.repos.get({
        owner,
        repo,
      });
      const defaultBranch = repository.default_branch;

      // Create a new branch
      const timestamp = new Date().getTime();
      const branchName = `update-${filePath.replace(/\//g, "-")}-${timestamp}`;

      // Get the SHA of the default branch
      const { data: ref } = await this._context.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
      });

      // Create new branch
      await this._context.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      });

      // Update file in new branch
      const content = Buffer.from(fileContent).toString("base64");
      await this._context.octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: commitMessage,
        content,
        branch: branchName,
      });

      // Create pull request
      const { data: pr } = await this._context.octokit.rest.pulls.create({
        owner,
        repo,
        title: `Update ${filePath}`,
        body: "Automated update using autoedit",
        head: branchName,
        base: defaultBranch,
      });

      return {
        pullRequestUrl: pr.html_url,
        branch: branchName,
      };
    } catch (error) {
      this._context.logger.error("Error creating pull request:", { stack: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}
