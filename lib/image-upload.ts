const IMAGE_DATA_URI = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export class InvalidImageError extends Error {}

export function validateImageDataUri(value: unknown, maxBytes = 5 * 1024 * 1024): string {
  if (typeof value !== "string") throw new InvalidImageError("Image is required");
  const match = value.match(IMAGE_DATA_URI);
  if (!match) throw new InvalidImageError("Only PNG, JPEG, or WebP images are allowed");
  const bytes = Math.floor(match[2].length * 3 / 4) - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
  if (bytes > maxBytes) throw new InvalidImageError("Image exceeds 5 MB");
  return value;
}
