import { Scope } from "./github";

export type Target = {
  type: string;
  owner: string;
  repo: string;
  localDir: string;
  url: string;
  scope: Scope;
  filePath: string;
  readonly: boolean;
};
