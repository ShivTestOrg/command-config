import Anthropic from "@anthropic-ai/sdk";
import { Context } from "../types";
import { SuperAnthropic } from "./anthropic/anthropic";
import { GitAdapter } from "./git/git";
import { PullRequest } from "./git/super/actions/pull-request";

export function createAdapters(anthropic: Anthropic, context: Context) {
  return {
    anthropic: {
      super: new SuperAnthropic(anthropic, context),
    },
    git: {
      super: new GitAdapter(context),
      pull_request: new PullRequest(context),
    },
  };
}
