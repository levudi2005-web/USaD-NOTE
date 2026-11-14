export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

const formats = {
  pdf: {
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
  },
  docx: {
    extensions: ["docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ],
  },
  xlsx: {
    extensions: ["xlsx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
    ],
  },
  xls: {
    extensions: ["xls"],
    mimeTypes: ["application/vnd.ms-excel", "application/octet-stream"],
  },
  csv: {
    extensions: ["csv"],
    mimeTypes: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  },
  pptx: {
    extensions: ["pptx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
    ],
  },
  epub: {
    extensions: ["epub"],
    mimeTypes: ["application/epub+zip", "application/zip"],
  },
  md: {
    extensions: ["md", "markdown"],
    mimeTypes: ["text/markdown", "text/plain"],
  },
  txt: {
    extensions: ["txt"],
    mimeTypes: ["text/plain"],
  },
  image: {
    extensions: ["png", "jpg", "jpeg", "webp", "bmp"],
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/bmp",
      "application/octet-stream",
    ],
  },
};

const extensionOf = (name = "") =>
  name.split(".").pop()?.toLocaleLowerCase() ?? "";

const typeForExtension = (extension) =>
  Object.entries(formats).find(([, format]) =>
    format.extensions.includes(extension)
  )?.[0] ?? "";

const readSignature = async (file) =>
  new Uint8Array(await file.slice(0, 16).arrayBuffer());

const isZipSignature = (bytes) =>
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  [0x03, 0x05, 0x07].includes(bytes[2]) &&
  [0x04, 0x06, 0x08].includes(bytes[3]);

const signatureMatches = (type, bytes) => {
  switch (type) {
    case "pdf":
      return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    case "docx":
    case "xlsx":
    case "pptx":
    case "epub":
      return isZipSignature(bytes);
    case "xls":
      return [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
        (value, index) => bytes[index] === value
      );
    case "image":
      return (
        (bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47) ||
        (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") ||
        String.fromCharCode(...bytes.slice(0, 2)) === "BM"
      );
    default:
      return true;
  }
};

export const detectFileType = (file) => {
  const extension = extensionOf(file?.name);
  if (extension === "doc") return "unsupported-doc";
  return typeForExtension(extension) || "unsupported";
};

export const validateFile = async (file) => {
  const type = detectFileType(file);
  const errors = [];
  if (!file || typeof file.name !== "string" || typeof file.size !== "number") {
    return {
      valid: false,
      type: "unsupported",
      errors: [{ code: "invalid-file", message: "Tệp không hợp lệ." }],
    };
  }
  if (type === "unsupported-doc") {
    errors.push({
      code: "legacy-doc",
      message: "Định dạng DOC cũ chưa được hỗ trợ; hãy chuyển sang DOCX.",
    });
  } else if (type === "unsupported") {
    errors.push({
      code: "unsupported-format",
      message: "Định dạng tệp này chưa được hỗ trợ.",
    });
  }
  if (!file.name.trim()) {
    errors.push({ code: "missing-name", message: "Tệp cần có tên hợp lệ." });
  }
  if (file.size === 0) {
    errors.push({ code: "empty-file", message: "Tệp đang trống." });
  }
  const sizeLimit = type === "image" ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
  if (file.size > sizeLimit) {
    errors.push({
      code: "file-too-large",
      message: `Tệp vượt giới hạn ${Math.round(sizeLimit / 1024 / 1024)} MB.`,
    });
  }
  const fileInfo = formats[type];
  if (fileInfo && file.type && !fileInfo.mimeTypes.includes(file.type)) {
    errors.push({
      code: "mime-mismatch",
      message: "Loại MIME của tệp không khớp với phần mở rộng.",
    });
  }
  if (
    fileInfo &&
    !errors.length &&
    ["pdf", "docx", "xlsx", "xls", "pptx", "epub", "image"].includes(type)
  ) {
    const signature = await readSignature(file);
    if (!signatureMatches(type, signature)) {
      errors.push({
        code: "invalid-signature",
        message: "Nội dung tệp không khớp với định dạng đã khai báo.",
      });
    }
  }
  return { valid: errors.length === 0, type, errors };
};
