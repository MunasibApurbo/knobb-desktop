import { handleDiscordWebhookRequest } from "../../server/discordWebhookProxy.js";

export async function handler(event) {
  return await handleDiscordWebhookRequest({
    method: event.httpMethod || "GET",
    headers: event.headers || {},
    bodyText: event.body || "",
    env: process.env,
    fetchImpl: fetch,
  });
}
