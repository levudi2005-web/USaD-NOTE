import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/u, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let client;

export const isSharingConfigured = () =>
  Boolean(supabaseUrl && supabaseAnonKey);

export const getSupabaseClient = () => {
  if (!isSharingConfigured()) {
    throw new Error(
      "Chia sẻ chưa được cấu hình. Hãy thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY."
    );
  }
  client ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
};

const readError = async (error) => {
  const response = error?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (typeof body.error === "string") return body.error;
    } catch {
      // Use the SDK error when the response is not JSON.
    }
  }
  return error?.message || "Không thể kết nối dịch vụ chia sẻ.";
};

export const manageDocumentShare = async (body) => {
  const { data, error } = await getSupabaseClient().functions.invoke(
    "manage-document-share",
    { body }
  );
  if (error) {
    const requestError = new Error(await readError(error), { cause: error });
    requestError.status = error.context?.status ?? error.status;
    throw requestError;
  }
  return data;
};

export const requestPublicShare = async (body, mode = "json") => {
  if (!isSharingConfigured()) {
    throw new Error("Trang chia sẻ chưa được cấu hình.");
  }
  const response = await fetch(
    `${supabaseUrl}/functions/v1/public-document-share`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    let detail = "Không thể mở tài liệu được chia sẻ.";
    try {
      const payload = await response.json();
      if (typeof payload.error === "string") detail = payload.error;
      const error = new Error(detail);
      error.status = response.status;
      error.passwordRequired = payload.passwordRequired === true;
      throw error;
    } catch (error) {
      if (error instanceof Error && "status" in error) throw error;
      throw new Error(detail, { cause: error });
    }
  }
  return mode === "blob" ? response.blob() : response.json();
};
