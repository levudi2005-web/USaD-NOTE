import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import {
  hashShareToken,
  isShareActive,
  verifySharePassword,
} from "../_shared/share-security.js";

const bucket = "note-private-documents";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "apikey, authorization, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "apikey, authorization, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);

  let input: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Yêu cầu không hợp lệ." }, 400);
    }
    input = body as Record<string, unknown>;
  } catch {
    return json({ error: "Yêu cầu không hợp lệ." }, 400);
  }
  if (
    typeof input.token !== "string" ||
    !["metadata", "view", "download"].includes(String(input.mode)) ||
    (input.password !== undefined &&
      (typeof input.password !== "string" || input.password.length > 256))
  ) {
    return json({ error: "Liên kết chia sẻ không hợp lệ." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server configuration.");
    return json({ error: "Dịch vụ chia sẻ chưa được cấu hình." }, 503);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const tokenHash = await hashShareToken(input.token);
    const { data: share, error: shareError } = await supabase
      .from("note_document_shares")
      .select(
        "id, owner_id, document_id, enabled, can_download, description, password_hash, expires_at, revoked_at"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (shareError) throw shareError;
    if (!share || !isShareActive(share)) {
      return json(
        { error: "Liên kết không tồn tại, đã hết hạn hoặc đã bị thu hồi." },
        404
      );
    }

    const password = typeof input.password === "string" ? input.password : "";
    if (share.password_hash) {
      if (!password) return json({ passwordRequired: true }, 401);
      if (!(await verifySharePassword(password, share.password_hash))) {
        return json({ error: "Mật khẩu không chính xác." }, 403);
      }
    }

    const { data: document, error: documentError } = await supabase
      .from("note_shared_documents")
      .select(
        "name, file_type, content_type, size_bytes, storage_path, updated_at, owner_id"
      )
      .eq("id", share.document_id)
      .eq("owner_id", share.owner_id)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return json({ error: "Tài liệu không khả dụng." }, 404);

    if (input.mode === "metadata") {
      return json(
        {
          name: document.name,
          description: share.description,
          fileType: document.file_type,
          contentType: document.content_type,
          sizeBytes: document.size_bytes,
          updatedAt: document.updated_at,
          canDownload: share.can_download,
        },
        200
      );
    }
    if (input.mode === "download" && !share.can_download) {
      return json({ error: "Chủ sở hữu không cho phép tải tài liệu." }, 403);
    }

    const { data: file, error: fileError } = await supabase.storage
      .from(bucket)
      .download(document.storage_path);
    if (fileError || !file) {
      console.error("Shared file retrieval failed:", fileError);
      return json({ error: "Không thể mở tài liệu được chia sẻ." }, 404);
    }
    const safeName = document.name.replace(/[\r\n"\\]/gu, "_");
    const disposition = input.mode === "download" ? "attachment" : "inline";
    return new Response(file.stream(), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Content-Length": String(document.size_bytes),
        "Content-Type": document.content_type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Mã chia sẻ không hợp lệ."
    ) {
      return json({ error: "Liên kết không hợp lệ." }, 404);
    }
    console.error("Public document share failed:", error);
    return json({ error: "Không thể mở tài liệu được chia sẻ." }, 500);
  }
});
