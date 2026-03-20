import { describe, expect, it } from "vitest";

import { resolveImageProxyTarget } from "../../server/imageProxy.js";

describe("resolveImageProxyTarget", () => {
  it("allows generic remote album artwork hosts", () => {
    expect(resolveImageProxyTarget("https://i1.sndcdn.com/artworks-abc123-t500x500.jpg")).toBe(
      "https://i1.sndcdn.com/artworks-abc123-t500x500.jpg",
    );
  });

  it("blocks localhost targets", () => {
    expect(resolveImageProxyTarget("http://localhost:3000/private.png")).toBeNull();
    expect(resolveImageProxyTarget("http://127.0.0.1:3000/private.png")).toBeNull();
  });

  it("blocks private network IPv4 targets", () => {
    expect(resolveImageProxyTarget("http://192.168.1.10/private.png")).toBeNull();
    expect(resolveImageProxyTarget("http://10.0.0.4/private.png")).toBeNull();
    expect(resolveImageProxyTarget("http://172.20.5.9/private.png")).toBeNull();
  });
});
