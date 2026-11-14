const databaseName = "note-document-content";
const storeName = "documents";
const databaseVersion = 1;

const openDatabase = () =>
  new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("Trình duyệt này không hỗ trợ IndexedDB."));
      return;
    }
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Không mở được kho tài liệu cục bộ."));
    request.onblocked = () =>
      reject(new Error("Kho tài liệu đang bị chặn bởi một thẻ NOTE khác."));
  });

const runTransaction = async (mode, run) => {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = run(transaction.objectStore(storeName));
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Không thể truy cập kho tài liệu."));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Không thể hoàn tất lưu tài liệu.")
        );
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Đã hủy thao tác lưu tài liệu."));
    }).finally(() => database.close());
  } catch (error) {
    database.close();
    throw error;
  }
};

const serializableResult = (result) => {
  const stored = { ...result };
  delete stored.reader;
  return stored;
};

export const saveDocumentRecord = (id, file, result) =>
  runTransaction("readwrite", (store) =>
    store.put({
      id,
      file,
      result: serializableResult(result),
      updatedAt: new Date().toISOString(),
    })
  );

export const getDocumentRecord = (id) =>
  runTransaction("readonly", (store) => store.get(id));

export const deleteDocumentRecord = (id) =>
  runTransaction("readwrite", (store) => store.delete(id));
