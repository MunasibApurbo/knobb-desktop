import { proxyAudioNetlifyRequest } from "../../server/audioProxy.js";

export default async function audioProxy(request) {
  return proxyAudioNetlifyRequest(request);
}
