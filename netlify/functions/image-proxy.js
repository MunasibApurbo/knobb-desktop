import { proxyImageNetlifyEvent } from "../../server/imageProxy.js";

export async function handler(event) {
  return proxyImageNetlifyEvent(event);
}
