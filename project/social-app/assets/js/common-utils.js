(function initSocialAppUtils(windowObj) {
  const localStorageKey = "socialAppCurrentUser";

  function loadViewer() {
    try {
      const raw = windowObj.localStorage.getItem(localStorageKey);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getViewerUserId() {
    const viewer = loadViewer() || {};
    return Number(viewer.id || 0);
  }

  function getApiBaseUrl() {
    const config = windowObj.APP_CONFIG || {};
    const modeFromQuery = new URLSearchParams(windowObj.location.search).get("mode");
    const modeFromStorage = windowObj.localStorage.getItem("socialAppMode");
    const mode = modeFromQuery || modeFromStorage || config.mode || "production";
    const normalizedMode = mode === "local" ? "local" : "production";
    const apiBase = {
      local: "http://localhost/social-app/api",
      production: "https://playground.rankongpor.com/social-app/api",
      ...(config.apiBase || {}),
    };

    return apiBase[normalizedMode];
  }

  function getProfileUploadBasePath() {
    return `${getApiBaseUrl()}/uploads/profile`;
  }

  function resolveProfileImageUrl(profileImageUrl, profileImageFilename) {
    if (profileImageFilename) {
      return `${getProfileUploadBasePath()}/${encodeURIComponent(profileImageFilename)}`;
    }

    if (profileImageUrl) {
      return profileImageUrl;
    }

    return "";
  }

  function profilePageUrl(username, userId) {
    const normalizedUsername = String(username || "").trim().toLowerCase();
    if (normalizedUsername) {
      return `profile.html?username=${encodeURIComponent(normalizedUsername)}`;
    }

    return `profile.html?username=${encodeURIComponent(`user${Number(userId || 0)}`)}`;
  }

  async function postJson(endpoint, payload) {
    const response = await fetch(`${getApiBaseUrl()}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(data?.message || "Request failed");
      error.status = response.status;
      throw error;
    }

    return data;
  }

  windowObj.SocialAppUtils = {
    loadViewer,
    getViewerUserId,
    getApiBaseUrl,
    getProfileUploadBasePath,
    resolveProfileImageUrl,
    profilePageUrl,
    postJson,
  };
})(window);
