(function initNavbarShared(windowObj) {
  function setupUserMenu(options) {
    const {
      menuToggleId,
      menuId,
      settingBtnId,
      logoutBtnId,
      menuWrapSelector,
      settingsPage = "settings.html",
      logoutPage = "index.html",
      onBeforeNavigate,
    } = options || {};

    const menuToggle = document.getElementById(menuToggleId || "");
    const menu = document.getElementById(menuId || "");
    const settingBtn = document.getElementById(settingBtnId || "");
    const logoutBtn = document.getElementById(logoutBtnId || "");

    if (!(menuToggle instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
      return null;
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

      const wrapSelector = menuWrapSelector || "";
      if (wrapSelector && target.closest(wrapSelector)) {
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
        if (typeof onBeforeNavigate === "function") {
          onBeforeNavigate("settings");
        }

        windowObj.location.href = settingsPage;
      });
    }

    if (logoutBtn instanceof HTMLButtonElement) {
      logoutBtn.addEventListener("click", () => {
        if (typeof onBeforeNavigate === "function") {
          onBeforeNavigate("logout");
        }

        windowObj.localStorage.removeItem("socialAppCurrentUser");
        windowObj.location.href = logoutPage;
      });
    }

    return {
      closeMenu,
      openMenu,
      menu,
      menuToggle,
    };
  }

  windowObj.SocialAppNavbar = {
    setupUserMenu,
  };
})(window);
