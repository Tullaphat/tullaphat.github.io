function loadNavbarViewer() {
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

function setupNavbarProfileButton() {
  const menuToggle = document.getElementById("app-user-menu-toggle");
  if (!(menuToggle instanceof HTMLButtonElement)) {
    return;
  }

  const icon = menuToggle.querySelector("i");
  const viewer = loadNavbarViewer() || {};
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

  const viewer = loadNavbarViewer() || {};
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
  const menuToggle = document.getElementById("app-user-menu-toggle");
  const menu = document.getElementById("app-user-menu");
  const settingBtn = document.getElementById("app-user-setting-btn");
  const logoutBtn = document.getElementById("app-logout-btn");

  if (!(menuToggle instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
    return;
  }

  const closeMenu = () => {
    menu.setAttribute("hidden", "");
    menuToggle.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    menu.removeAttribute("hidden");
    menuToggle.setAttribute("aria-expanded", "true");
  };

  menuToggle.addEventListener("click", () => {
    if (menu.hasAttribute("hidden")) {
      openMenu();
      return;
    }

    closeMenu();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest(".app-user-menu-wrap")) {
      return;
    }

    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  if (settingBtn instanceof HTMLButtonElement) {
    settingBtn.addEventListener("click", () => {
      closeMenu();
      window.location.href = "settings.html";
    });
  }

  if (logoutBtn instanceof HTMLButtonElement) {
    logoutBtn.addEventListener("click", () => {
      window.localStorage.removeItem("socialAppCurrentUser");
      window.location.href = "index.html";
    });
  }
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
