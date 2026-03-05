 (function renderSharedShell(windowObj) {
  const body = document.body;
  if (!(body instanceof HTMLBodyElement)) {
    return;
  }

  const leftActive = String(body.dataset.leftActive || "").trim();
  const mobileActive = String(body.dataset.mobileActive || "").trim();
  const homeLeftActive = leftActive || "feed";

  const isLeftActive = (key) => (leftActive === key ? " active" : "");
  const isMobileActive = (key) => (mobileActive === key ? " active" : "");
  const isHomeActive = (key) => (homeLeftActive === key ? " active" : "");
  const navClass = (activeClass) => (activeClass ? `class="${activeClass.trim()}"` : "");

  function loadViewer() {
    try {
      const raw = windowObj.localStorage.getItem("socialAppCurrentUser");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function resolveCount(...candidates) {
    for (const value of candidates) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }

    return 0;
  }

  function setTextById(id, text) {
    const node = document.getElementById(id);
    if (node instanceof HTMLElement) {
      node.textContent = String(text);
    }
  }

  function getFollowingCountFromDom() {
    const appNode = document.getElementById("app-left-following-count");
    const homeNode = document.getElementById("home-left-following-count");
    const appCount = Number(appNode?.textContent || NaN);
    const homeCount = Number(homeNode?.textContent || NaN);

    return resolveCount(appCount, homeCount, 0);
  }

  function setFollowingCount(value) {
    const count = Math.max(0, resolveCount(value));
    setTextById("app-left-following-count", count);
    setTextById("home-left-following-count", count);

    try {
      const raw = windowObj.localStorage.getItem("socialAppCurrentUser");
      const viewer = raw ? JSON.parse(raw) : {};
      if (viewer && typeof viewer === "object") {
        viewer.followingCount = count;
        windowObj.localStorage.setItem("socialAppCurrentUser", JSON.stringify(viewer));
      }
    } catch {
      // Ignore localStorage errors.
    }
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
      throw new Error(data?.message || "Request failed");
    }

    return data;
  }

  const appTopbarRoot = document.getElementById("app-topbar-root");
  if (appTopbarRoot instanceof HTMLElement) {
    appTopbarRoot.innerHTML = `
      <a class="app-brand" href="home.html">Social App</a>
      <div class="app-topbar-search">
        <input id="topbar-search-input" type="search" placeholder="Search people, posts, groups" />
      </div>
      <div class="app-topbar-actions">
        <button id="app-notification-btn" class="app-icon-btn app-notify-btn" type="button" aria-label="Notifications">
          <i class="fa-regular fa-bell" aria-hidden="true"></i>
          <span class="app-notify-dot"></span>
        </button>
        <div class="app-user-menu-wrap">
          <button id="app-user-menu-toggle" class="app-icon-btn app-user-menu-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="User menu">
            <i class="fa-regular fa-user" aria-hidden="true"></i>
          </button>
          <div id="app-user-menu" class="app-user-menu" role="menu" hidden>
            <button id="app-user-setting-btn" class="app-user-menu-item" role="menuitem" type="button">
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
              <span>User Setting</span>
            </button>
            <button id="app-logout-btn" class="app-user-menu-item" role="menuitem" type="button">
              <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const appLeftSidebarRoot = document.getElementById("app-left-sidebar-root");
  if (appLeftSidebarRoot instanceof HTMLElement) {
    appLeftSidebarRoot.innerHTML = `
      <section class="app-left-profile">
        <div class="app-left-avatar" id="app-left-avatar"></div>
        <div>
          <h2 id="app-left-name">User</h2>
          <p id="app-left-username">@user</p>
        </div>
      </section>
      <section class="profile-stats" aria-label="Profile stats">
        <div class="profile-stat">
          <strong id="app-left-followers-count">0</strong>
          <span>Followers</span>
        </div>
        <div class="profile-stat">
          <strong id="app-left-following-count">0</strong>
          <span>Following</span>
        </div>
      </section>
      <nav class="app-left-nav">
        <a ${navClass(isLeftActive("feed"))} href="home.html">Feed</a>
        <a ${navClass(isLeftActive("friends"))} href="friends.html">Friends</a>
        <a ${navClass(isLeftActive("bookmarks"))} href="bookmarks.html">Bookmarks</a>
      </nav>
    `;
  }

  const appMobileTabbarRoot = document.getElementById("mobile-tabbar-root");
  if (appMobileTabbarRoot instanceof HTMLElement) {
    appMobileTabbarRoot.innerHTML = `
      <a class="mobile-tabbar-item${isMobileActive("feed")}" href="home.html">
        <i class="fa-solid fa-house" aria-hidden="true"></i>
        <span>Feed</span>
      </a>
      <a class="mobile-tabbar-item${isMobileActive("friends")}" href="friends.html">
        <i class="fa-solid fa-user-group" aria-hidden="true"></i>
        <span>Friends</span>
      </a>
      <a class="mobile-tabbar-item${isMobileActive("bookmarks")}" href="bookmarks.html">
        <i class="fa-solid fa-bookmark" aria-hidden="true"></i>
        <span>Bookmarks</span>
      </a>
    `;
  }

  const homeTopbarRoot = document.getElementById("home-topbar-root");
  if (homeTopbarRoot instanceof HTMLElement) {
    homeTopbarRoot.innerHTML = `
      <div class="brand">Social App</div>
      <div class="topbar-search-wrap">
        <input id="search-input" type="search" placeholder="Search people, posts, groups" />
      </div>
      <div class="topbar-actions">
        <button
          id="mobile-search-toggle"
          class="icon-btn mobile-search-btn"
          type="button"
          aria-label="Open search"
          aria-expanded="false"
        >
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        </button>

        <button id="notification-btn" class="icon-btn notify-btn" type="button" aria-label="Notifications">
          <i class="fa-regular fa-bell" aria-hidden="true"></i>
          <span class="notify-dot"></span>
        </button>

        <div class="user-menu-wrap">
          <button id="user-menu-toggle" class="icon-btn user-menu-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="User menu">
            <i class="fa-regular fa-user" aria-hidden="true"></i>
          </button>
          <div id="user-menu" class="user-menu" role="menu" hidden>
            <button id="user-setting-btn" class="user-menu-item" role="menuitem" type="button">
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
              <span>User Setting</span>
            </button>
            <button id="logout-btn" class="user-menu-item" role="menuitem" type="button">
              <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const homeLeftRoot = document.getElementById("mobile-nav-panel");
  if (homeLeftRoot instanceof HTMLElement) {
    homeLeftRoot.innerHTML = `
      <section class="profile-mini">
        <div class="avatar"></div>
        <div>
          <h2 id="welcome-name">Tullaphat User</h2>
          <p id="welcome-username">@user</p>
        </div>
      </section>

      <section class="profile-stats" aria-label="Profile stats">
        <div class="profile-stat">
          <strong id="home-left-followers-count">0</strong>
          <span>Followers</span>
        </div>
        <div class="profile-stat">
          <strong id="home-left-following-count">0</strong>
          <span>Following</span>
        </div>
      </section>

      <nav class="left-nav">
        <a ${navClass(isHomeActive("feed"))} href="home.html">Feed</a>
        <a ${navClass(isHomeActive("friends"))} href="friends.html">Friends</a>
        <a ${navClass(isHomeActive("bookmarks"))} href="bookmarks.html">Bookmarks</a>
      </nav>
    `;
  }

  const homeMobileTabbarRoot = document.getElementById("home-mobile-tabbar-root");
  if (homeMobileTabbarRoot instanceof HTMLElement) {
    homeMobileTabbarRoot.innerHTML = `
      <a class="mobile-tabbar-item${isMobileActive("feed")}" href="home.html">
        <i class="fa-solid fa-house" aria-hidden="true"></i>
        <span>Feed</span>
      </a>
      <a class="mobile-tabbar-item${isMobileActive("friends")}" href="friends.html">
        <i class="fa-solid fa-user-group" aria-hidden="true"></i>
        <span>Friends</span>
      </a>
      <a class="mobile-tabbar-item${isMobileActive("bookmarks")}" href="bookmarks.html">
        <i class="fa-solid fa-bookmark" aria-hidden="true"></i>
        <span>Bookmarks</span>
      </a>
    `;
  }

  (async function hydrateProfileStats() {
    const viewer = loadViewer() || {};
    const viewerId = Number(viewer.id || 0);

    const followersCount = resolveCount(
      viewer.followersCount,
      viewer.followerCount,
      viewer.followers
    );

    const localFollowingCount = resolveCount(
      viewer.followingCount,
      viewer.following,
      viewer.followingUsersCount
    );

    setTextById("app-left-followers-count", followersCount);
    setTextById("home-left-followers-count", followersCount);
    setFollowingCount(localFollowingCount);

    if (!viewerId) {
      return;
    }

    try {
      const response = await postJson("list-following-users.php", {
        userId: viewerId,
        limit: 200,
      });

      const users = Array.isArray(response?.data?.users) ? response.data.users : [];
      const total = resolveCount(
        response?.data?.totalCount,
        response?.data?.count,
        users.length,
        localFollowingCount
      );

      setFollowingCount(total);
    } catch {
      // Keep local fallback count if API call fails.
    }
  })();

  windowObj.addEventListener("socialapp:following-changed", (event) => {
    const detail = event?.detail || {};
    const totalFollowing = Number(detail.totalFollowing);
    if (!Number.isNaN(totalFollowing) && totalFollowing >= 0) {
      setFollowingCount(totalFollowing);
      return;
    }

    const delta = Number(detail.delta || 0);
    if (Number.isNaN(delta) || delta === 0) {
      return;
    }

    setFollowingCount(getFollowingCountFromDom() + delta);
  });
})(window);
