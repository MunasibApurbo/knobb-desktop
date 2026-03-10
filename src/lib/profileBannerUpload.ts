export const PROFILE_BANNER_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const PROFILE_BANNER_ACCEPT_ATTRIBUTE = PROFILE_BANNER_ALLOWED_MIME_TYPES.join(",");
export const PROFILE_BANNER_MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const PROFILE_BANNER_MAX_STORAGE_BYTES = 2 * 1024 * 1024;
export const PROFILE_BANNER_MIN_WIDTH = 1200;
export const PROFILE_BANNER_MIN_HEIGHT = 540;
export const PROFILE_BANNER_EXPORT_WIDTH = 1680;
export const PROFILE_BANNER_EXPORT_HEIGHT = 720;

export const PROFILE_BANNER_UPLOAD_REQUIREMENTS = [
  `JPG, PNG, or WebP up to ${formatBytes(PROFILE_BANNER_MAX_SOURCE_BYTES)} before cropping.`,
  `Minimum source size ${PROFILE_BANNER_MIN_WIDTH}x${PROFILE_BANNER_MIN_HEIGHT}.`,
].join(" ");

export const PROFILE_BANNER_EXPORT_NOTE =
  `Saved as JPG up to ${PROFILE_BANNER_EXPORT_WIDTH}x${PROFILE_BANNER_EXPORT_HEIGHT}, max ${formatBytes(PROFILE_BANNER_MAX_STORAGE_BYTES)}.`;

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    const kilobytes = bytes / 1024;
    return `${Number.isInteger(kilobytes) ? kilobytes : kilobytes.toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

export function validateProfileBannerFile(file: Pick<File, "size" | "type">) {
  if (!PROFILE_BANNER_ALLOWED_MIME_TYPES.includes(file.type as (typeof PROFILE_BANNER_ALLOWED_MIME_TYPES)[number])) {
    return "Use a JPG, PNG, or WebP image for your profile banner.";
  }

  if (file.size > PROFILE_BANNER_MAX_SOURCE_BYTES) {
    return `Profile banners must be ${formatBytes(PROFILE_BANNER_MAX_SOURCE_BYTES)} or smaller before cropping.`;
  }

  return null;
}

export function validateProfileBannerDimensions(width: number, height: number) {
  if (width < PROFILE_BANNER_MIN_WIDTH || height < PROFILE_BANNER_MIN_HEIGHT) {
    return `Profile banners must be at least ${PROFILE_BANNER_MIN_WIDTH}x${PROFILE_BANNER_MIN_HEIGHT}.`;
  }

  return null;
}

export function validateProfileBannerUploadBlob(file: Pick<Blob, "size">) {
  if (file.size > PROFILE_BANNER_MAX_STORAGE_BYTES) {
    return `The cropped banner is still larger than ${formatBytes(PROFILE_BANNER_MAX_STORAGE_BYTES)}. Choose a smaller crop or a simpler image.`;
  }

  return null;
}

export async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.addEventListener("load", () => resolve(nextImage));
      nextImage.addEventListener("error", () => reject(new Error("Failed to read the selected image.")));
      nextImage.src = objectUrl;
    });

    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
