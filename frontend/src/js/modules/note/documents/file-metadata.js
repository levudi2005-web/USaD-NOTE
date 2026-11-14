import { detectFileType } from "./file-validator";

export const getMetadata = (file) => ({
  name: file.name,
  format: detectFileType(file),
  mimeType: file.type || "application/octet-stream",
  size: file.size,
  lastModified: file.lastModified
    ? new Date(file.lastModified).toISOString()
    : null,
});
