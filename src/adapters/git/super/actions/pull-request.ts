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

      console.log("defaultBranch", defaultBranch);

      // Create a new branch
      const timestamp = new Date().getTime();
      const branchName = `update-config-${timestamp}`;

      // Get the SHA of the default branch
      const { data: ref } = await this._context.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
      });

      console.log("ref", ref);

      // Create new branch
      await this._context.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      });

      console.log("Branch Created with name: ", branchName);
      this._context.logger.info(`Branch Created with name: ${branchName}`);

      // Update file in new branch
      const content = Buffer.from(fileContent).toString("base64");
      console.log("New content: ", content);
      this._context.logger.info(`New content: ${content}`);

      // Get the file sha
      const { data: fileData } = await this._context.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branchName,
      });

      const fileSha = "sha" in fileData ? fileData.sha : "";
      console.log("File sha: ", fileSha);
      this._context.logger.info(`File sha: ${fileSha}`);

      // Update the file in the new branch (with the new content and sha from the previous step)
      await this._context.octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: commitMessage,
        content,
        branch: branchName,
        sha: fileSha,
      });
      console.log("File updated in branch: ", branchName);
      this._context.logger.info(`File updated in branch: ${branchName}`);

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
