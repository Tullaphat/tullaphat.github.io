const navbarUtils = window.SocialAppUtils || {
  loadViewer() {
    try {
      const raw = window.localStorage.getItem("socialAppCurrentUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

const navbarLoadViewer = navbarUtils.loadViewer;
const { setupUserMenu } = window.SocialAppNavbar || {};

function setupNavbarProfileButton() {
  const menuToggle = document.getElementById("app-user-menu-toggle");
  if (!(menuToggle instanceof HTMLButtonElement)) {
    return;
  }

  const icon = menuToggle.querySelector("i");
  const viewer = navbarLoadViewer() || {};
  const profileImage =
    viewer.profileImage ||
    viewer.profileImageUrl ||
    window.localStorage.getItem("socialAppProfileImage") ||
    "";

  if (!profileImage) {
    menuToggle.classList.remove("has-photo");
    menuToggle.style.backgroundImage = "";
    if (icon instanceof HTMLElement) {
      icon.removeAttribute("hidden");
    }
    return;
  }

  menuToggle.style.backgroundImage = `url(${profileImage})`;
  menuToggle.classList.add("has-photo");
  if (icon instanceof HTMLElement) {
    icon.setAttribute("hidden", "");
  }
}

function setupLeftSidebarProfile() {
  const nameNode = document.getElementById("app-left-name");
  const usernameNode = document.getElementById("app-left-username");
  const avatarNode = document.getElementById("app-left-avatar");

  if (!(nameNode instanceof HTMLElement) || !(usernameNode instanceof HTMLElement) || !(avatarNode instanceof HTMLElement)) {
    return;
  }

  const viewer = navbarLoadViewer() || {};
  const firstName = String(viewer.firstName || "User");
  const lastName = String(viewer.lastName || "");
  const username = String(viewer.username || "").trim().toLowerCase();
  const profileImage =
    viewer.profileImage ||
    viewer.profileImageUrl ||
    window.localStorage.getItem("socialAppProfileImage") ||
    "";

  const fullName = `${firstName} ${lastName}`.trim();
  nameNode.textContent = fullName || "User";
  usernameNode.textContent = username ? `@${username}` : "@user";

  if (profileImage) {
    avatarNode.textContent = "";
    avatarNode.style.backgroundImage = `url(${profileImage})`;
    return;
  }

  avatarNode.style.backgroundImage = "";
  avatarNode.textContent = (firstName || "U").charAt(0).toUpperCase();
}

function setupNavbarMenu() {
  if (typeof setupUserMenu !== "function") {
    return;
  }

  setupUserMenu({
    menuToggleId: "app-user-menu-toggle",
    menuId: "app-user-menu",
    settingBtnId: "app-user-setting-btn",
    logoutBtnId: "app-logout-btn",
    menuWrapSelector: ".app-user-menu-wrap",
    settingsPage: "settings.html",
    logoutPage: "index.html",
  });
}

function setupNavbarSearch() {
  const input = document.getElementById("topbar-search-input");
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const onSearchPage = window.location.pathname.endsWith("/search.html") || window.location.pathname.endsWith("search.html");
  if (onSearchPage) {
    return;
  }

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const query = input.value.trim();

    if (!query) {
      window.location.href = "search.html";
      return;
    }

    window.location.href = `search.html?q=${encodeURIComponent(query)}`;
  });
}

setupNavbarProfileButton();
setupNavbarMenu();
setupNavbarSearch();
setupLeftSidebarProfile();
