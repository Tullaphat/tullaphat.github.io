const DEFAULT_CONFIG = {
  mode: "production",
  apiBase: {
    local: "http://localhost/social-app/api",
    production: "https://playground.rankongpor.com/social-app/api",
  },
};

function getAppConfig() {
  const globalConfig = window.APP_CONFIG || {};
  const modeFromQuery = new URLSearchParams(window.location.search).get("mode");
  const modeFromStorage = window.localStorage.getItem("socialAppMode");
  const rawMode = modeFromQuery || globalConfig.mode || modeFromStorage || DEFAULT_CONFIG.mode;
  const mode = rawMode === "local" ? "local" : "production";
  const apiBase = {
    ...DEFAULT_CONFIG.apiBase,
    ...(globalConfig.apiBase || {}),
  };

  window.localStorage.setItem("socialAppMode", mode);

  return {
    mode,
    apiBaseUrl: apiBase[mode],
  };
}

function setAppMode(mode) {
  const normalizedMode = mode === "local" ? "local" : "production";
  window.localStorage.setItem("socialAppMode", normalizedMode);
  return normalizedMode;
}

window.setAppMode = setAppMode;

const APP_RUNTIME = getAppConfig();

function renderModeOverlay() {
  const badge = document.createElement("div");
  const modeLabel = APP_RUNTIME.mode === "local" ? "LOCAL" : "PRODUCTION";
  badge.className = `mode-overlay mode-overlay-${APP_RUNTIME.mode}`;
  badge.setAttribute("aria-live", "polite");
  badge.textContent = `Mode: ${modeLabel}`;
  document.body.appendChild(badge);
}

async function postJson(endpoint, payload) {
  const response = await fetch(`${APP_RUNTIME.apiBaseUrl}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  const responseContentType = response.headers.get("content-type") || "";

  if (responseContentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const rawText = await response.text();
      data = rawText ? { message: rawText } : null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const backendMessage = String(data?.message || "").trim();
    const backendDetail = String(data?.error || "").trim();
    const statusText = `HTTP ${response.status}`;
    const combinedMessage = [backendMessage || statusText, backendDetail].filter(Boolean).join(" | ");
    const error = new Error(combinedMessage || "Request failed");
    error.status = response.status;
    error.payload = data;
    error.endpoint = endpoint;
    throw error;
  }

  return data;
}

function setFormMessage(node, message, state) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  node.textContent = message;
  node.classList.remove("error", "success");

  if (state) {
    node.classList.add(state);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatRequestError(error, fallbackText) {
  const status = Number(error?.status || 0);
  const endpoint = String(error?.endpoint || "").trim();
  const baseMessage = String(error?.message || "").trim() || fallbackText;
  const statusPrefix = status > 0 ? `[${status}] ` : "";
  const endpointSuffix = endpoint ? ` (${endpoint})` : "";

  return `${statusPrefix}${baseMessage}${endpointSuffix}`;
}

function setupLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) {
    return;
  }

  const message = document.getElementById("login-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      rememberMe: Boolean(formData.get("rememberMe")),
    };

    if (!isValidEmail(payload.email)) {
      setFormMessage(message, "Please provide a valid email address.", "error");
      return;
    }

    if (payload.password.length < 8) {
      setFormMessage(message, "Password must be at least 8 characters.", "error");
      return;
    }

    setFormMessage(message, "Logging in...", "success");

    try {
      const response = await postJson("login.php", payload);
      const userEmail = response?.data?.user?.email || payload.email;
      const user = response?.data?.user || { email: userEmail };
      setFormMessage(
        message,
        `Login success (${APP_RUNTIME.mode} mode): ${userEmail}`,
        "success"
      );
      console.log("Login response", response);

      window.localStorage.setItem(
        "socialAppCurrentUser",
        JSON.stringify({
          id: user.id || null,
          username: user.username || "",
          email: user.email || userEmail,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          gender: user.gender || "",
          profileImageFilename: user.profileImageFilename || "",
          profileImageUrl: user.profileImageUrl || "",
        })
      );

      setTimeout(() => {
        window.location.href = "home.html";
      }, 450);
    } catch (error) {
      setFormMessage(
        message,
        `Login failed: ${formatRequestError(error, "Request failed")}. Current mode: ${APP_RUNTIME.mode}.`,
        "error"
      );
      console.error("Login error", error);
    }
  });
}

function setupRegisterForm() {
  const form = document.getElementById("register-form");
  if (!form) {
    return;
  }

  const message = document.getElementById("register-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      gender: String(formData.get("gender") || ""),
    };

    if (!payload.firstName || !payload.lastName) {
      setFormMessage(message, "First name and last name are required.", "error");
      return;
    }

    if (!isValidEmail(payload.email)) {
      setFormMessage(message, "Please provide a valid email address.", "error");
      return;
    }

    if (payload.password.length < 8) {
      setFormMessage(message, "Password must be at least 8 characters.", "error");
      return;
    }

    if (!payload.gender) {
      setFormMessage(message, "Please select a gender.", "error");
      return;
    }

    setFormMessage(message, "Creating account...", "success");

    try {
      const response = await postJson("register.php", payload);
      const createdEmail = response?.data?.email || payload.email;
      setFormMessage(
        message,
        `Register success (${APP_RUNTIME.mode} mode): ${createdEmail}`,
        "success"
      );
      console.log("Register response", response);
      form.reset();
    } catch (error) {
      setFormMessage(
        message,
        `Register failed: ${formatRequestError(error, "Request failed")}. Current mode: ${APP_RUNTIME.mode}.`,
        "error"
      );
      console.error("Register error", error);
    }
  });
}

console.info("Social App API mode", APP_RUNTIME.mode, APP_RUNTIME.apiBaseUrl);
renderModeOverlay();
setupLoginForm();
setupRegisterForm();
