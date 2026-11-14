import { getMetadata } from "./file-metadata";
import { searchInDocument } from "./document-search";
import { detectFileType, validateFile } from "./file-validator";

const errorResult = (metadata, error) => ({
  ...metadata,
  text: "",
  segments: [],
  metadata,
  warnings: [],
  error: {
    code: error.code ?? "read-failed",
    message: error.message || "Không thể đọc nội dung tệp.",
  },
});

export { detectFileType, getMetadata, searchInDocument, validateFile };

export const extractText = (content) =>
  typeof content === "string" ? content : String(content?.text ?? "");

export const readDocument = async (
  file,
  { onProgress = () => {}, tesseractOptions } = {}
) => {
  const validation = await validateFile(file);
  const metadata =
    file && typeof file.name === "string"
      ? getMetadata(file)
      : {
          name: "",
          format: "unsupported",
          mimeType: "",
          size: 0,
          lastModified: null,
        };
  if (!validation.valid) {
    return {
      ...errorResult(metadata, validation.errors[0]),
      validationErrors: validation.errors,
    };
  }
  try {
    let result;
    switch (validation.type) {
      case "pdf": {
        const { readPdf } = await import("./readers/pdf-reader");
        result = await readPdf(file, metadata, onProgress);
        break;
      }
      case "docx": {
        const { readDocx } = await import("./readers/docx-reader");
        result = await readDocx(file, metadata);
        break;
      }
      case "xlsx":
      case "xls":
      case "csv": {
        const { readExcel } = await import("./readers/excel-reader");
        result = await readExcel(file, metadata);
        break;
      }
      case "pptx": {
        const { readPptx } = await import("./readers/pptx-reader");
        result = await readPptx(file, metadata);
        break;
      }
      case "epub": {
        const { readEpub } = await import("./readers/epub-reader");
        result = await readEpub(file, metadata);
        break;
      }
      case "md":
      case "txt": {
        const { readText } = await import("./readers/text-reader");
        result = await readText(file, metadata);
        break;
      }
      case "image": {
        const { readImage } = await import("./readers/image-reader");
        result = await readImage(file, metadata, {
          onProgress,
          tesseractOptions,
        });
        break;
      }
      default:
        return errorResult(metadata, {
          code: "unsupported-format",
          message: "Định dạng tệp này chưa được hỗ trợ.",
        });
    }
    return { ...result, validationErrors: [] };
  } catch (error) {
    return errorResult(metadata, error);
  }
};
