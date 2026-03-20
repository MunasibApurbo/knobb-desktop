import {
  PROFILE_BANNER_MAX_SOURCE_BYTES,
  PROFILE_BANNER_MAX_STORAGE_BYTES,
  formatBytes,
  validateProfileBannerDimensions,
  validateProfileBannerFile,
  validateProfileBannerUploadBlob,
} from "@/lib/profileBannerUpload";

describe("profileBannerUpload", () => {
  it("formats byte values into readable labels", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("rejects unsupported banner image types", () => {
    expect(
      validateProfileBannerFile({
        size: PROFILE_BANNER_MAX_SOURCE_BYTES,
        type: "image/gif",
      } as File),
    ).toBe("Use a JPG, PNG, or WebP image for your profile banner.");
  });

  it("rejects oversized source files", () => {
    expect(
      validateProfileBannerFile({
        size: PROFILE_BANNER_MAX_SOURCE_BYTES + 1,
        type: "image/png",
      } as File),
    ).toContain("2 MB");
  });

  it("accepts supported files within the source limit", () => {
    expect(
      validateProfileBannerFile({
        size: PROFILE_BANNER_MAX_SOURCE_BYTES,
        type: "image/webp",
      } as File),
    ).toBeNull();
  });

  it("rejects undersized banner dimensions", () => {
    expect(validateProfileBannerDimensions(900, 500)).toBe("Profile banners must be at least 1200x540.");
  });

  it("accepts valid banner dimensions", () => {
    expect(validateProfileBannerDimensions(1600, 900)).toBeNull();
  });

  it("rejects cropped uploads that still exceed the storage limit", () => {
    expect(
      validateProfileBannerUploadBlob({
        size: PROFILE_BANNER_MAX_STORAGE_BYTES + 1,
      } as Blob),
    ).toContain("2 MB");
  });
});
