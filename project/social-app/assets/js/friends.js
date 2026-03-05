const friendsUtils = window.SocialAppUtils || {
  loadViewer() {
    try {
      const raw = window.localStorage.getItem("socialAppCurrentUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  getViewerUserId() {
    const viewer = friendsUtils.loadViewer() || {};
    return Number(viewer.id || 0);
  },
  profilePageUrl(username, userId) {
    const normalizedUsername = String(username || "").trim().toLowerCase();
    if (normalizedUsername) {
      return `profile.html?username=${encodeURIComponent(normalizedUsername)}`;
    }

    return `profile.html?username=${encodeURIComponent(`user${Number(userId || 0)}`)}`;
  },
  resolveProfileImageUrl(profileImageUrl, profileImageFilename) {
    if (profileImageFilename) {
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

      return `${apiBase[normalizedMode]}/uploads/profile/${encodeURIComponent(profileImageFilename)}`;
    }

    return profileImageUrl || "";
  },
  async postJson(endpoint, payload) {
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

    const response = await fetch(`${apiBase[normalizedMode]}/${endpoint}`, {
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
  },
};

const friendsGetViewerUserId = friendsUtils.getViewerUserId;
const friendsProfilePageUrl = friendsUtils.profilePageUrl;
const friendsResolveProfileImageUrl = friendsUtils.resolveProfileImageUrl;
const friendsPostJson = friendsUtils.postJson;

function setSummary(text) {
  const summary = document.getElementById("friends-summary");
  if (summary instanceof HTMLElement) {
    summary.textContent = text;
  }
}

function setEmpty(message) {
  const list = document.getElementById("friends-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = `<p class="search-empty">${message}</p>`;
}

function createFriendCard(user) {
  const card = document.createElement("article");
  card.className = "search-user-card";
  card.dataset.userId = String(user.id || "");

  const firstName = user?.firstName || "User";
  const lastName = user?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const avatarText = (firstName || fullName || "U").charAt(0).toUpperCase();
  const avatarUrl = friendsResolveProfileImageUrl(user?.profileImageUrl || "", user?.profileImageFilename || "");
  const username = String(user?.username || `user${Number(user.id || 0)}`).trim().toLowerCase();

  card.innerHTML = `
    <div class="search-user-avatar" ${avatarUrl ? `style="background-image:url('${avatarUrl}')"` : ""}>${
      avatarUrl ? "" : avatarText
    }</div>
    <div class="search-user-meta">
      <h2><a class="search-user-link" href="${friendsProfilePageUrl(user?.username || "", user?.id || 0)}">${fullName || "User"}</a></h2>
      <p>@${username}</p>
    </div>
    <button class="follow-result-btn following" type="button" data-action="unfollow">
      <i class="fa-solid fa-user-check" aria-hidden="true"></i>
      <span>Following</span>
    </button>
  `;

  return card;
}

function renderFriends(users) {
  const list = document.getElementById("friends-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = "";

  if (!users.length) {
    setEmpty("You are not following anyone yet.");
    setSummary("Following 0 user(s).");
    return;
  }

  const fragment = document.createDocumentFragment();
  users.forEach((user) => {
    fragment.appendChild(createFriendCard(user));
  });

  list.appendChild(fragment);
  setSummary(`Following ${users.length} user(s).`);
}

async function loadFollowingUsers() {
  const userId = friendsGetViewerUserId();
  if (!userId) {
    window.location.href = "index.html";
    return;
  }

  try {
    const response = await friendsPostJson("list-following-users.php", {
      userId,
      limit: 100,
    });

    const users = Array.isArray(response?.data?.users) ? response.data.users : [];
    renderFriends(users);
  } catch (error) {
    setSummary("Cannot load friends.");
    setEmpty(`Failed to load following users: ${error.message}`);
  }
}

function setupUnfollow() {
  document.addEventListener("click", async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) {
      return;
    }

    const button = rawTarget.closest('.follow-result-btn[data-action="unfollow"]');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const card = button.closest(".search-user-card");
    const targetUserId = Number(card?.dataset.userId || 0);
    const userId = friendsGetViewerUserId();

    if (!userId || targetUserId <= 0) {
      window.alert("Please login again before updating follow.");
      return;
    }

    button.disabled = true;

    try {
      const response = await friendsPostJson("toggle-follow.php", {
        userId,
        targetUserId,
      });

      const isFollowing = Boolean(response?.data?.isFollowing);
      if (!isFollowing && card instanceof HTMLElement) {
        card.remove();
        const remain = document.querySelectorAll("#friends-list .search-user-card").length;
        if (!remain) {
          setEmpty("You are not following anyone yet.");
        }

        setSummary(`Following ${remain} user(s).`);

        window.dispatchEvent(
          new CustomEvent("socialapp:following-changed", {
            detail: {
              totalFollowing: remain,
            },
          })
        );
      } else if (isFollowing) {
        window.dispatchEvent(
          new CustomEvent("socialapp:following-changed", {
            detail: {
              delta: 1,
            },
          })
        );
      }
    } catch (error) {
      window.alert(`Cannot update follow: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
}

setupUnfollow();
loadFollowingUsers();
