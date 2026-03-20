import { handleYoutubeMusicProxyEvent } from "../../server/youtubeMusicProxy.js";

export async function handler(event) {
  return handleYoutubeMusicProxyEvent(event);
}
