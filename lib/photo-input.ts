export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validatePhotoFile(file: { size: number; type: string }) {
  if (!acceptedTypes.has(file.type)) return "type" as const;
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_PHOTO_BYTES) return "size" as const;
  return null;
}

export function markerPosition(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  return { x: Math.max(.06, Math.min(.94, (clientX - rect.left) / rect.width)), y: Math.max(.1, Math.min(.88, (clientY - rect.top) / rect.height)) };
}

/** Fit the annotation plane to the visible image, excluding letterbox bars. */
export function containedPhotoBounds(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number) {
  if (![imageWidth, imageHeight, frameWidth, frameHeight].every((n) => Number.isFinite(n) && n > 0)) return null;
  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { left: (frameWidth - width) / 2, top: (frameHeight - height) / 2, width, height };
}
