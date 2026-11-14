import { sanitizeHtml } from "../sanitize-html";

export const readDocx = async (file, metadata) => {
  const xmldomModule = await import("@xmldom/xmldom");
  const xmldom = xmldomModule.default ?? xmldomModule;
  if (!xmldom.DOMParser.__noteCompatibility) {
    const OriginalParser = xmldom.DOMParser;
    class MammothCompatibleParser extends OriginalParser {
      constructor(options = {}) {
        const { errorHandler, onError, ...rest } = options;
        super({ ...rest, onError: onError ?? errorHandler });
      }

      parseFromString(source, mimeType = "application/xml") {
        return super.parseFromString(source, mimeType);
      }
    }
    MammothCompatibleParser.__noteCompatibility = true;
    xmldom.DOMParser = MammothCompatibleParser;
  }
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const arrayBuffer = await file.arrayBuffer();
  const input =
    typeof process !== "undefined" && process.versions?.node
      ? { buffer: Buffer.from(arrayBuffer) }
      : { arrayBuffer };
  const [raw, converted] = await Promise.all([
    mammoth.extractRawText(input),
    mammoth.convertToHtml(input),
  ]);
  const html = await sanitizeHtml(converted.value);
  const segments = raw.value
    .split(/\n+/u)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      kind: "paragraph",
      index,
      label: `Đoạn ${index + 1}`,
      text,
    }));
  return {
    ...metadata,
    text: raw.value,
    html,
    segments,
    metadata: {
      ...metadata,
      paragraphCount: segments.length,
      messageCount: converted.messages.length,
    },
    warnings: converted.messages
      .filter((message) => message.type === "warning")
      .map((message) => message.message),
    error: null,
  };
};
