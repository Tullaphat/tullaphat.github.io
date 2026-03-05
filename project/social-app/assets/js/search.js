function loadViewer() {
  try {
    const raw = window.localStorage.getItem("socialAppCurrentUser");
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

function profilePageUrl(username, userId) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  if (normalizedUsername) {
    return `profile.html?username=${encodeURIComponent(normalizedUsername)}`;
  }

  return `profile.html?username=${encodeURIComponent(`user${Number(userId || 0)}`)}`;
}

function getApiBaseUrl() {
  const config = window.APP_CONFIG || {};
  const modeFromQuery = new URLSearchParams(window.location.search).get("mode");
  const modeFromStorage = window.localStorage.getItem("socialAppMode");
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

function setSummary(text) {
  const summary = document.getElementById("search-summary");
  if (summary instanceof HTMLElement) {
    summary.textContent = text;
  }
}

function setListEmptyState(message) {
  const list = document.getElementById("search-result-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = `<p class="search-empty">${message}</p>`;
}

function createUserCard(user) {
  const listItem = document.createElement("article");
  listItem.className = "search-user-card";
  listItem.dataset.userId = String(user.id || "");

  const firstName = user?.firstName || "User";
  const lastName = user?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const avatarText = (firstName || fullName || "U").charAt(0).toUpperCase();
  const avatarUrl = resolveProfileImageUrl(user?.profileImageUrl || "", user?.profileImageFilename || "");
  const username = String(user?.username || `user${Number(user.id || 0)}`).trim().toLowerCase();
  const following = Boolean(user?.isFollowing);

  listItem.innerHTML = `
    <div class="search-user-avatar" ${avatarUrl ? `style="background-image:url('${avatarUrl}')"` : ""}>${
      avatarUrl ? "" : avatarText
    }</div>
    <div class="search-user-meta">
      <h2><a class="search-user-link" href="${profilePageUrl(user?.username || "", user?.id || 0)}">${fullName || "User"}</a></h2>
      <p>@${username}</p>
    </div>
    <button class="follow-result-btn ${following ? "following" : ""}" type="button" data-action="follow-toggle">
      <i class="fa-solid ${following ? "fa-user-check" : "fa-user-plus"}" aria-hidden="true"></i>
      <span>${following ? "Following" : "Follow"}</span>
    </button>
  `;

  return listItem;
}

function renderUsers(users) {
  const list = document.getElementById("search-result-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = "";

  if (!users.length) {
    setListEmptyState("No users found. Try another name.");
    return;
  }

  const fragment = document.createDocumentFragment();
  users.forEach((user) => {
    fragment.appendChild(createUserCard(user));
  });

  list.appendChild(fragment);
}

async function runUserSearch(rawQuery) {
  const query = String(rawQuery || "").trim();
  const userId = getViewerUserId();

  if (!userId) {
    window.location.href = "index.html";
    return;
  }

  if (!query) {
    setSummary("Type a name to find users.");
    setListEmptyState("Search by first name or last name.");
    return;
  }

  setSummary(`Searching for "${query}"...`);
  setListEmptyState("Loading users...");

  try {
    const response = await postJson("search-users.php", {
      userId,
      query,
      limit: 30,
    });

    const users = Array.isArray(response?.data?.users) ? response.data.users : [];
    renderUsers(users);
    setSummary(`Found ${users.length} user(s) for "${query}".`);
  } catch (error) {
    setSummary("Search failed.");
    setListEmptyState(`Cannot search users: ${error.message}`);
  }
}

function getTopbarSearchInput() {
  const input = document.getElementById("topbar-search-input");
  if (!(input instanceof HTMLInputElement)) {
    return null;
  }

  return input;
}

function syncSearchQueryToUrl(query) {
  const url = new URL(window.location.href);
  if (query) {
    url.searchParams.set("q", query);
  } else {
    url.searchParams.delete("q");
  }

  window.history.replaceState({}, "", url.toString());
}

function setupTopbarSearch() {
  const input = getTopbarSearchInput();
  if (!input) {
    return;
  }

  input.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const query = input.value.trim();
    syncSearchQueryToUrl(query);
    await runUserSearch(query);
  });
}

function setupFollowButtons() {
  document.addEventListener("click", async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) {
      return;
    }

    const button = rawTarget.closest('.follow-result-btn[data-action="follow-toggle"]');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const card = button.closest(".search-user-card");
    const targetUserId = Number(card?.dataset.userId || 0);
    const userId = getViewerUserId();

    if (!userId || targetUserId <= 0) {
      window.alert("Please login again before following users.");
      return;
    }

    button.disabled = true;

    try {
      const response = await postJson("toggle-follow.php", {
        userId,
        targetUserId,
      });

      const isFollowing = Boolean(response?.data?.isFollowing);
      button.classList.toggle("following", isFollowing);
      button.innerHTML = isFollowing
        ? '<i class="fa-solid fa-user-check" aria-hidden="true"></i><span>Following</span>'
        : '<i class="fa-solid fa-user-plus" aria-hidden="true"></i><span>Follow</span>';
    } catch (error) {
      window.alert(`Cannot update follow: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
}

function bootstrapSearchFromQuery() {
  const input = getTopbarSearchInput();
  if (!input) {
    return;
  }

  const query = new URLSearchParams(window.location.search).get("q") || "";
  input.value = query;
  runUserSearch(query);
}

setupTopbarSearch();
setupFollowButtons();
bootstrapSearchFromQuery();
