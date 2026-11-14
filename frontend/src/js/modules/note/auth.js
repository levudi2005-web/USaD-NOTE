import api, { setToken } from "./api.js";

const setFormMessage = (
  form,
  message,
  type = "danger",
  recoveryCode = null
) => {
  let messageEl = form.querySelector("[data-auth-message]");
  if (!messageEl) {
    messageEl = document.createElement("div");
    messageEl.dataset.authMessage = "";
    messageEl.className = "alert mt-3";
    messageEl.setAttribute("role", "alert");
    form.prepend(messageEl);
  }

  messageEl.className = `alert alert-${type} mt-3`;
  messageEl.replaceChildren();
  const text = document.createElement("p");
  text.className = "mb-0";
  text.textContent = message;
  messageEl.append(text);

  if (recoveryCode) {
    const code = document.createElement("code");
    code.className = "d-block p-2 mt-2 bg-body rounded user-select-all";
    code.textContent = recoveryCode;
    messageEl.append(code);

    const continueButton = document.createElement("button");
    continueButton.className = "btn btn-sm btn-success mt-3";
    continueButton.type = "button";
    continueButton.textContent = "Tôi đã lưu mã, tiếp tục";
    continueButton.addEventListener("click", () => {
      window.location.assign("index.html");
    });
    messageEl.append(continueButton);
  }
};

export const initAuth = () => {
  document
    .querySelector("[data-login-form]")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);

      try {
        const result = await api.auth.login(
          String(data.get("email") || "").trim(),
          String(data.get("password") || "")
        );
        setToken(result.access_token);
        window.location.assign("index.html");
      } catch (error) {
        setFormMessage(form, error.message || "Không thể đăng nhập.");
      }
    });

  document
    .querySelector("[data-register-form]")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);

      try {
        const result = await api.auth.register(
          String(data.get("email") || "").trim(),
          String(data.get("password") || ""),
          String(data.get("name") || "").trim()
        );
        setToken(result.access_token);
        setFormMessage(
          form,
          "Tài khoản đã được tạo. Hãy lưu mã khôi phục này ở nơi an toàn; mã chỉ được hiển thị một lần.",
          "success",
          result.recovery_code
        );
      } catch (error) {
        setFormMessage(form, error.message || "Không thể tạo tài khoản.");
      }
    });
};
