import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import {
  createShareToken,
  hashSharePassword,
  hashShareToken,
} from "../_shared/share-security.js";

const bucket = "note-private-documents";
const allowedTypes = new Set([
  "pdf",
  "docx",
  "xlsx",
  "xls",
  "csv",
  "pptx",
  "epub",
  "md",
  "txt",
  "image",
]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/epub+zip",
  "application/zip",
  "text/markdown",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "application/octet-stream",
]);

const json = (body: unknown, status: number, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });

const getCorsHeaders = (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedOrigins.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const getExpiration = (value: unknown) => {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Thời hạn không hợp lệ.");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new Error("Thời hạn chia sẻ phải nằm trong tương lai.");
  }
  return new Date(timestamp).toISOString();
};

const validateDocument = (
  document: Record<string, unknown>,
  ownerId: string
) => {
  const localDocumentId = document.localDocumentId;
  const storagePath = document.storagePath;
  const name = document.name;
  const description = document.description ?? "";
  const fileType = document.fileType;
  const contentType = document.contentType || "application/octet-stream";
  const sizeBytes = document.sizeBytes;
  const pathParts =
    typeof storagePath === "string" ? storagePath.split("/") : [];
  if (
    typeof localDocumentId !== "string" ||
    localDocumentId.length < 1 ||
    localDocumentId.length > 160 ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 240 ||
    typeof description !== "string" ||
    description.length > 1000 ||
    typeof fileType !== "string" ||
    !allowedTypes.has(fileType) ||
    typeof contentType !== "string" ||
    !allowedMimeTypes.has(contentType) ||
    typeof sizeBytes !== "number" ||
    !Number.isInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > 52_428_800 ||
    pathParts.length !== 3 ||
    pathParts[0] !== ownerId ||
    pathParts.some((part) => !/^[A-Za-z0-9._-]+$/u.test(part)) ||
    pathParts.some((part) => part === "." || part === "..")
  ) {
    throw new Error("Thông tin tài liệu không hợp lệ.");
  }
  return {
    localDocumentId,
    storagePath,
    name: name.trim(),
    description: description.trim(),
    fileType,
    contentType,
    sizeBytes,
  };
};

const getOptions = async (input: Record<string, unknown>) => {
  if (
    typeof input.canDownload !== "boolean" ||
    (input.password !== undefined &&
      input.password !== null &&
      typeof input.password !== "string") ||
    (input.description !== undefined &&
      (typeof input.description !== "string" ||
        input.description.length > 1000))
  ) {
    throw new Error("Tùy chọn chia sẻ không hợp lệ.");
  }
  return {
    can_download: input.canDownload,
    ...(input.password === undefined
      ? {}
      : { password_hash: await hashSharePassword(input.password) }),
    description: String(input.description ?? "").trim(),
    expires_at: getExpiration(input.expiresAt),
  };
};

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return corsHeaders
      ? new Response("ok", { headers: corsHeaders })
      : new Response("Origin not allowed", { status: 403 });
  }
  if (!corsHeaders) return new Response("Origin not allowed", { status: 403 });
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, corsHeaders);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/iu)?.[1];
  if (!accessToken) {
    return json(
      { error: "Đăng nhập để quản lý liên kết chia sẻ." },
      401,
      corsHeaders
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server configuration.");
    return json(
      { error: "Dịch vụ chia sẻ chưa được cấu hình." },
      503,
      corsHeaders
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ error: "Phiên đăng nhập không hợp lệ." }, 401, corsHeaders);
  }

  let input: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Yêu cầu không hợp lệ." }, 400, corsHeaders);
    }
    input = body as Record<string, unknown>;
  } catch {
    return json({ error: "Yêu cầu không hợp lệ." }, 400, corsHeaders);
  }

  try {
    const ownerId = authData.user.id;
    if (input.action === "status") {
      if (
        typeof input.localDocumentId !== "string" ||
        input.localDocumentId.length > 160
      ) {
        return json({ error: "Tài liệu không hợp lệ." }, 400, corsHeaders);
      }
      const { data: document, error: documentError } = await supabase
        .from("note_shared_documents")
        .select("id, storage_path")
        .eq("owner_id", ownerId)
        .eq("client_document_id", input.localDocumentId)
        .maybeSingle();
      if (documentError) throw documentError;
      if (!document) return json({ documentExists: false }, 200, corsHeaders);

      const { data: shares, error: shareError } = await supabase
        .from("note_document_shares")
        .select(
          "id, enabled, can_download, description, password_hash, expires_at, created_at, updated_at, revoked_at"
        )
        .eq("owner_id", ownerId)
        .eq("document_id", document.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (shareError) throw shareError;
      const share = shares?.[0];
      return json(
        {
          documentExists: true,
          storagePath: document.storage_path,
          share: share
            ? {
                id: share.id,
                enabled: share.enabled,
                canDownload: share.can_download,
                description: share.description,
                hasPassword: Boolean(share.password_hash),
                expiresAt: share.expires_at,
                createdAt: share.created_at,
                updatedAt: share.updated_at,
                revokedAt: share.revoked_at,
              }
            : null,
        },
        200,
        corsHeaders
      );
    }

    if (input.action === "create") {
      const documentInput = validateDocument(
        (input.document ?? {}) as Record<string, unknown>,
        ownerId
      );
      const options = await getOptions(input);
      const { data: uploadedFiles, error: storageError } =
        await supabase.storage
          .from(bucket)
          .list(`${ownerId}/${documentInput.storagePath.split("/")[1]}`, {
            search: documentInput.storagePath.split("/")[2],
          });
      if (storageError) throw storageError;
      if (
        !uploadedFiles?.some(
          (file) => file.name === documentInput.storagePath.split("/")[2]
        )
      ) {
        return json(
          { error: "Tệp chưa được tải lên kho riêng." },
          400,
          corsHeaders
        );
      }

      const token = createShareToken();
      const tokenHash = await hashShareToken(token);
      const { data: shares, error: shareError } = await supabase.rpc(
        "create_note_document_share",
        {
          p_owner_id: ownerId,
          p_client_document_id: documentInput.localDocumentId,
          p_storage_path: documentInput.storagePath,
          p_name: documentInput.name,
          p_document_description: documentInput.description,
          p_file_type: documentInput.fileType,
          p_content_type: documentInput.contentType,
          p_size_bytes: documentInput.sizeBytes,
          p_token_hash: tokenHash,
          p_can_download: options.can_download,
          p_share_description: options.description,
          p_password_hash: options.password_hash ?? null,
          p_expires_at: options.expires_at,
        }
      );
      if (shareError) throw shareError;
      const share = shares?.[0];
      if (!share) throw new Error("Không thể tạo liên kết chia sẻ.");
      return json(
        {
          token,
          share: {
            id: share.share_id,
            enabled: share.enabled,
            canDownload: share.can_download,
            description: share.description,
            hasPassword: Boolean(share.password_hash),
            expiresAt: share.expires_at,
            createdAt: share.created_at,
            updatedAt: share.updated_at,
            revokedAt: share.revoked_at,
          },
        },
        201,
        corsHeaders
      );
    }

    if (input.action === "update" || input.action === "rotate") {
      if (
        typeof input.shareId !== "string" ||
        !/^[0-9a-f-]{36}$/iu.test(input.shareId)
      ) {
        return json(
          { error: "Liên kết chia sẻ không hợp lệ." },
          400,
          corsHeaders
        );
      }
      const options = await getOptions(input);
      const { data: current, error: lookupError } = await supabase
        .from("note_document_shares")
        .select("id, enabled")
        .eq("id", input.shareId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!current) {
        return json(
          { error: "Không tìm thấy liên kết chia sẻ." },
          404,
          corsHeaders
        );
      }
      if (input.action === "update" && !current.enabled) {
        return json(
          { error: "Liên kết đã bị thu hồi. Hãy tạo liên kết mới." },
          409,
          corsHeaders
        );
      }

      const token = input.action === "rotate" ? createShareToken() : null;
      const changes = {
        ...options,
        updated_at: new Date().toISOString(),
        ...(token
          ? {
              token_hash: await hashShareToken(token),
              enabled: true,
              revoked_at: null,
            }
          : {}),
      };
      const { data: share, error: updateError } = await supabase
        .from("note_document_shares")
        .update(changes)
        .eq("id", input.shareId)
        .eq("owner_id", ownerId)
        .select(
          "id, enabled, can_download, description, password_hash, expires_at, created_at, updated_at, revoked_at"
        )
        .single();
      if (updateError) throw updateError;
      return json(
        {
          token,
          share: {
            id: share.id,
            enabled: share.enabled,
            canDownload: share.can_download,
            description: share.description,
            hasPassword: Boolean(share.password_hash),
            expiresAt: share.expires_at,
            createdAt: share.created_at,
            updatedAt: share.updated_at,
            revokedAt: share.revoked_at,
          },
        },
        200,
        corsHeaders
      );
    }

    if (input.action === "revoke") {
      if (
        typeof input.shareId !== "string" ||
        !/^[0-9a-f-]{36}$/iu.test(input.shareId)
      ) {
        return json(
          { error: "Liên kết chia sẻ không hợp lệ." },
          400,
          corsHeaders
        );
      }
      const now = new Date().toISOString();
      const { data: share, error: revokeError } = await supabase
        .from("note_document_shares")
        .update({ enabled: false, revoked_at: now, updated_at: now })
        .eq("id", input.shareId)
        .eq("owner_id", ownerId)
        .select("id")
        .maybeSingle();
      if (revokeError) throw revokeError;
      if (!share) {
        return json(
          { error: "Không tìm thấy liên kết chia sẻ." },
          404,
          corsHeaders
        );
      }
      return json({ revoked: true }, 200, corsHeaders);
    }

    if (input.action === "delete") {
      if (
        typeof input.localDocumentId !== "string" ||
        input.localDocumentId.length < 1 ||
        input.localDocumentId.length > 160
      ) {
        return json({ error: "Tài liệu không hợp lệ." }, 400, corsHeaders);
      }
      const { data: document, error: documentError } = await supabase
        .from("note_shared_documents")
        .select("id, storage_path")
        .eq("owner_id", ownerId)
        .eq("client_document_id", input.localDocumentId)
        .maybeSingle();
      if (documentError) throw documentError;
      if (!document) return json({ deleted: false }, 200, corsHeaders);

      const now = new Date().toISOString();
      const { error: revokeError } = await supabase
        .from("note_document_shares")
        .update({ enabled: false, revoked_at: now, updated_at: now })
        .eq("owner_id", ownerId)
        .eq("document_id", document.id);
      if (revokeError) throw revokeError;

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([document.storage_path]);
      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from("note_shared_documents")
        .delete()
        .eq("owner_id", ownerId)
        .eq("id", document.id);
      if (deleteError) throw deleteError;
      return json({ deleted: true }, 200, corsHeaders);
    }

    return json(
      { error: "Thao tác chia sẻ không được hỗ trợ." },
      400,
      corsHeaders
    );
  } catch (error) {
    console.error("Document sharing management failed:", error);
    const message =
      error instanceof Error ? error.message : "Không thể quản lý liên kết.";
    return json({ error: message }, 400, corsHeaders);
  }
});
