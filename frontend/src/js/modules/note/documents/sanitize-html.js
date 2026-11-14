export const sanitizeHtml = async (html) => {
  const { default: purifier } = await import("dompurify");
  const DOMPurify =
    typeof process !== "undefined" && process.versions?.node
      ? purifier(window)
      : purifier;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "audio",
      "embed",
      "form",
      "iframe",
      "img",
      "input",
      "link",
      "meta",
      "object",
      "script",
      "source",
      "style",
      "video",
    ],
    FORBID_ATTR: ["style", "src", "srcset"],
  });
};
