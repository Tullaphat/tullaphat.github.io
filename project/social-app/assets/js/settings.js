function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,30}$/.test(username);
}

function getCurrentUser() {
  try {
    return JSON.parse(window.localStorage.getItem("socialAppCurrentUser") || "{}");
  } catch {
    return {};
  }
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

async function postFormData(endpoint, formData) {
  const response = await fetch(`${getApiBaseUrl()}/${endpoint}`, {
    method: "POST",
    body: formData,
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

function getProfileImage() {
  return window.localStorage.getItem("socialAppProfileImage") || "";
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

function applyProfilePreview(imageDataUrl, firstName, lastName) {
  const preview = document.getElementById("profile-preview");
  if (!(preview instanceof HTMLElement)) {
    return;
  }

  if (imageDataUrl) {
    preview.textContent = "";
    preview.style.backgroundImage = `url(${imageDataUrl})`;
    return;
  }

  preview.style.backgroundImage = "";
  preview.textContent = "";
}

function setMessage(message, type) {
  const node = document.getElementById("settings-message");
  if (!(node instanceof HTMLElement)) {
    return;
  }

  node.textContent = message;
  node.classList.remove("error", "success");
  if (type) {
    node.classList.add(type);
  }
}

function loadSettingsForm() {
  const form = document.getElementById("settings-form");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const user = getCurrentUser();
  const firstNameInput = document.getElementById("settings-first-name");
  const lastNameInput = document.getElementById("settings-last-name");
  const emailInput = document.getElementById("settings-email");
  const usernameInput = document.getElementById("settings-username");
  const passwordInput = document.getElementById("settings-password");
  const genderInputs = form.querySelectorAll('input[name="gender"]');
  const profileInput = document.getElementById("profile-picture-input");
  const removeProfileButton = document.getElementById("remove-profile-picture-btn");
  const cancelButton = document.getElementById("cancel-settings-btn");

  let profileImageData =
    resolveProfileImageUrl(user.profileImageUrl || "", user.profileImageFilename || "") ||
    getProfileImage() ||
    user.profileImage ||
    "";
  let selectedProfileFile = null;
  let removeProfileImage = false;

  if (firstNameInput instanceof HTMLInputElement) {
    firstNameInput.value = user.firstName || "";
  }

  if (lastNameInput instanceof HTMLInputElement) {
    lastNameInput.value = user.lastName || "";
  }

  if (emailInput instanceof HTMLInputElement) {
    emailInput.value = user.email || "";
  }

  if (usernameInput instanceof HTMLInputElement) {
    usernameInput.value = String(user.username || "").toLowerCase();
  }

  genderInputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    input.checked = input.value === (user.gender || "");
  });

  applyProfilePreview(profileImageData, user.firstName || "", user.lastName || "");

  if (profileInput instanceof HTMLInputElement) {
    profileInput.addEventListener("change", () => {
      const file = profileInput.files && profileInput.files[0];
      if (!file || !file.type.startsWith("image/")) {
        return;
      }

      selectedProfileFile = file;
      removeProfileImage = false;

      const previewUrl = URL.createObjectURL(file);
      profileImageData = previewUrl;
      const firstName = firstNameInput instanceof HTMLInputElement ? firstNameInput.value : "";
      const lastName = lastNameInput instanceof HTMLInputElement ? lastNameInput.value : "";
      applyProfilePreview(profileImageData, firstName, lastName);
    });
  }

  if (removeProfileButton instanceof HTMLButtonElement) {
    removeProfileButton.addEventListener("click", () => {
      profileImageData = "";
      selectedProfileFile = null;
      removeProfileImage = true;

      if (profileInput instanceof HTMLInputElement) {
        profileInput.value = "";
      }

      const firstName = firstNameInput instanceof HTMLInputElement ? firstNameInput.value : "";
      const lastName = lastNameInput instanceof HTMLInputElement ? lastNameInput.value : "";
      applyProfilePreview("", firstName, lastName);
    });
  }

  if (cancelButton instanceof HTMLButtonElement) {
    cancelButton.addEventListener("click", () => {
      window.location.href = "home.html";
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const firstName = firstNameInput instanceof HTMLInputElement ? firstNameInput.value.trim() : "";
    const lastName = lastNameInput instanceof HTMLInputElement ? lastNameInput.value.trim() : "";
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    const username = usernameInput instanceof HTMLInputElement ? usernameInput.value.trim().toLowerCase() : "";
    const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
    const checkedGender = form.querySelector('input[name="gender"]:checked');
    const gender = checkedGender instanceof HTMLInputElement ? checkedGender.value : "";

    if (!firstName || !lastName) {
      setMessage("First name and last name are required.", "error");
      return;
    }

    if (!isValidEmail(email)) {
      setMessage("Please provide a valid email.", "error");
      return;
    }

    if (!isValidUsername(username)) {
      setMessage("Username must be 3-30 chars using lowercase letters, numbers, or underscore.", "error");
      return;
    }

    if (password && password.length < 8) {
      setMessage("Password must be at least 8 characters.", "error");
      return;
    }

    if (!gender) {
      setMessage("Please select a gender.", "error");
      return;
    }

    if (!user.id) {
      setMessage("Cannot update profile: user id not found. Please login again.", "error");
      return;
    }

    const payload = new FormData();
    payload.append("userId", String(user.id));
    payload.append("firstName", firstName);
    payload.append("lastName", lastName);
    payload.append("email", email);
    payload.append("username", username);
    payload.append("gender", gender);
    payload.append("removeProfileImage", removeProfileImage ? "true" : "false");

    if (password) {
      payload.append("password", password);
    }

    if (selectedProfileFile instanceof File) {
      payload.append("profilePicture", selectedProfileFile);
    }

    setMessage("Saving changes...", "");

    try {
      const response = await postFormData("update-profile.php", payload);
      const updatedUser = response?.data?.user || {};

      const mergedUser = {
        ...user,
        id: updatedUser.id || user.id,
        username: updatedUser.username || user.username || "",
        firstName: updatedUser.firstName || firstName,
        lastName: updatedUser.lastName || lastName,
        email: updatedUser.email || email,
        gender: updatedUser.gender || gender,
        profileImageFilename: updatedUser.profileImageFilename || "",
        profileImageUrl: resolveProfileImageUrl(
          updatedUser.profileImageUrl || "",
          updatedUser.profileImageFilename || ""
        ),
      };

      window.localStorage.setItem("socialAppCurrentUser", JSON.stringify(mergedUser));
      window.localStorage.setItem("socialAppProfileImage", mergedUser.profileImageUrl || "");

      profileImageData = mergedUser.profileImageUrl || "";
      selectedProfileFile = null;
      removeProfileImage = false;
      applyProfilePreview(profileImageData, mergedUser.firstName, mergedUser.lastName);
      setMessage("Profile updated successfully.", "success");
    } catch (error) {
      setMessage(error.message || "Failed to update profile.", "error");
    }
  });
}

loadSettingsForm();
