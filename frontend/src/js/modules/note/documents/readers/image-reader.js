const simdModule = Uint8Array.from([
  0,
  97,
  115,
  109,
  1,
  0,
  0,
  0,
  1,
  4,
  1,
  96,
  0,
  0,
  3,
  2,
  1,
  0,
  10,
  23,
  1,
  21,
  0,
  253,
  12,
  ...new Array(16).fill(0),
  26,
  11,
]);

const localWorkerOptions = () => {
  const simdSupported = WebAssembly.validate(simdModule);
  const coreVariant = simdSupported ? "simd-lstm" : "lstm";
  return {
    workerPath: new URL("tesseract/worker.min.js", document.baseURI).href,
    corePath: new URL(
      `tesseract/core/tesseract-core-${coreVariant}.wasm.js`,
      document.baseURI
    ).href,
    langPath: new URL("tessdata/", document.baseURI).href,
    gzip: true,
    workerBlobURL: false,
  };
};

export const readImage = async (
  file,
  metadata,
  { onProgress = () => {}, tesseractOptions = {} } = {}
) => {
  const isNodeRuntime =
    typeof process !== "undefined" && Boolean(process.versions?.node);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng+vie", 1, {
    ...(isNodeRuntime ? {} : localWorkerOptions()),
    ...tesseractOptions,
    logger: ({ status, progress }) =>
      onProgress({
        phase: "ocr",
        progress: Number.isFinite(progress) ? progress : null,
        message: status || "Đang nhận diện chữ…",
      }),
  });
  try {
    const image =
      isNodeRuntime && typeof file.arrayBuffer === "function"
        ? await file.arrayBuffer()
        : file;
    const result = await worker.recognize(image);
    const text = result.data.text.trim();
    return {
      ...metadata,
      text,
      segments: [
        { kind: "image", index: 0, label: "Nội dung nhận diện", text },
      ],
      metadata: {
        ...metadata,
        language: "vie+eng",
        confidence: Math.round(result.data.confidence),
      },
      warnings: [],
      error: null,
    };
  } finally {
    await worker.terminate();
  }
};
