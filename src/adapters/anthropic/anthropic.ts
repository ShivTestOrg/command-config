import Anthropic from "@anthropic-ai/sdk";
import { Context } from "../../types";

export class SuperAnthropic {
  protected client: Anthropic;
  protected context: Context;
  constructor(client: Anthropic, context: Context) {
    this.client = client;
    this.context = context;
  }
}
