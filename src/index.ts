import { syncConfigs } from "./handlers/sync-config";
import { Context } from "./types";
import { isCommentEvent } from "./types/typeguards";

/**
 * The main plugin function. Split for easier testing.
 */
export async function runPlugin(context: Context) {
  const { logger, eventName } = context;

  if (isCommentEvent(context)) {
    return await syncConfigs(context);
  }

  logger.error(`Unsupported event: ${eventName}`);
}
