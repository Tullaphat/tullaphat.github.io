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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRelativeTime(rawDate) {
  const createdAt = new Date(rawDate);
  if (Number.isNaN(createdAt.getTime())) {
    return "Just now";
  }

  const diffSeconds = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 1000));
  if (diffSeconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day ago`;
  }

  return createdAt.toLocaleDateString();
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

function getReactionValue(post, key) {
  const value = post?.reactions?.[key];
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return Math.max(0, numericValue);
}

function buildPostCard(post) {
  const card = document.createElement("article");
  card.className = "feed-card card-glass";
  card.dataset.postId = String(post.id || "");
  card.dataset.authorId = String(post?.author?.id || "");

  const viewerUserId = getViewerUserId();
  const authorUserId = Number(post?.author?.id || 0);
  const canDelete = viewerUserId > 0 && authorUserId === viewerUserId;

  const firstName = post?.author?.firstName || "User";
  const lastName = post?.author?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const avatarInitial = (firstName || fullName || "U").charAt(0).toUpperCase();
  const authorAvatarUrl = resolveProfileImageUrl(
    post?.author?.profileImageUrl || "",
    post?.author?.profileImageFilename || ""
  );
  const createdAtLabel = formatRelativeTime(post?.createdAt || "");
  const content = typeof post?.content === "string" ? post.content.trim() : "";
  const imageUrls = Array.isArray(post?.imageUrls)
    ? post.imageUrls.filter((url) => typeof url === "string" && url.trim() !== "")
    : [];
  const likeCount = getReactionValue(post, "likeCount");
  const commentCount = getReactionValue(post, "commentCount");
  const bookmarkCount = getReactionValue(post, "bookmarkCount");
  const isLiked = Boolean(post?.reactions?.isLiked);
  const isBookmarked = Boolean(post?.reactions?.isBookmarked);

  card.innerHTML = `
    <header>
      <div class="feed-author-row">
        <div class="feed-author-avatar" ${authorAvatarUrl ? `style="background-image:url('${escapeHtml(authorAvatarUrl)}')"` : ""}>
          ${authorAvatarUrl ? "" : escapeHtml(avatarInitial)}
        </div>
        <div class="feed-author-meta">
          <h3><a class="feed-author-name-link" href="${profilePageUrl(post?.author?.username || "", authorUserId)}">${escapeHtml(fullName || "User")}</a></h3>
          <p>${escapeHtml(createdAtLabel)}</p>
        </div>
      </div>
      <div class="post-menu-wrap">
        <button class="post-menu-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Post options">
          <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
        </button>
        <div class="post-menu" role="menu" hidden>
          <button class="post-menu-item danger" data-action="delete-post" role="menuitem" type="button" ${canDelete ? "" : "disabled"}>
            Delete post
          </button>
        </div>
      </div>
    </header>
    <p class="feed-post-content" ${content ? "" : "hidden"}></p>
    <div class="feed-post-gallery" ${imageUrls.length ? "" : "hidden"}></div>
    <footer>
      <button class="react-btn ${isLiked ? "active" : ""}" data-action="like" type="button"><i class="fa-regular fa-thumbs-up" aria-hidden="true"></i><span>Like</span><span class="react-count">${likeCount}</span></button>
      <button class="react-btn" data-action="comment" type="button"><i class="fa-regular fa-comment" aria-hidden="true"></i><span>Comment</span><span class="react-count">${commentCount}</span></button>
      <button class="react-btn ${isBookmarked ? "active" : ""}" data-action="bookmark" type="button"><i class="fa-regular fa-bookmark" aria-hidden="true"></i><span>Bookmark</span><span class="react-count">${bookmarkCount}</span></button>
    </footer>
    <section class="comment-wrap" hidden>
      <div class="comment-list"></div>
      <div class="comment-form-row">
        <input class="comment-input" type="text" placeholder="Write a comment" />
        <button class="comment-submit-btn" type="button">Post</button>
      </div>
    </section>
  `;

  const contentNode = card.querySelector(".feed-post-content");
  if (contentNode instanceof HTMLElement) {
    contentNode.textContent = content;
  }

  const galleryNode = card.querySelector(".feed-post-gallery");
  if (galleryNode instanceof HTMLElement && imageUrls.length) {
    imageUrls.forEach((url) => {
      const image = document.createElement("img");
      image.className = "feed-post-photo";
      image.src = url;
      image.alt = "Post photo";
      image.loading = "lazy";
      galleryNode.appendChild(image);
    });

    if (imageUrls.length === 1) {
      galleryNode.classList.add("single");
    } else if (imageUrls.length > 2) {
      galleryNode.classList.add("compact");
    }
  }

  return card;
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
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

function setFeedStatus(message) {
  const feedList = document.getElementById("feed-list");
  if (!(feedList instanceof HTMLElement)) {
    return;
  }

  const existing = feedList.querySelector(".feed-status");
  if (!message) {
    if (existing instanceof HTMLElement) {
      existing.remove();
    }
    return;
  }

  if (existing instanceof HTMLElement) {
    existing.textContent = message;
    return;
  }

  const statusNode = document.createElement("p");
  statusNode.className = "feed-status";
  statusNode.textContent = message;
  feedList.appendChild(statusNode);
}

async function loadFeedPosts() {
  const feedList = document.getElementById("feed-list");
  if (!(feedList instanceof HTMLElement)) {
    return;
  }

  const viewerUserId = getViewerUserId();
  const isProfilePage = document.body.classList.contains("profile-body");
  const profileUsername = String(new URLSearchParams(window.location.search).get("username") || "")
    .trim()
    .toLowerCase();

  setFeedStatus("Loading posts...");

  try {
    const endpoint = isProfilePage ? "list-user-posts.php" : "list-posts.php";
    const payload = {
      limit: 40,
      userId: viewerUserId,
    };

    if (isProfilePage) {
      if (!profileUsername) {
        setFeedStatus("Invalid profile.");
        return;
      }

      payload.profileUsername = profileUsername;
    }

    const response = await postJson(endpoint, payload);
    const posts = Array.isArray(response?.data?.posts) ? response.data.posts : [];

    if (isProfilePage) {
      const profile = response?.data?.profile || null;
      const profileNameNode = document.getElementById("profile-name");
      const profileSubtitleNode = document.getElementById("profile-subtitle");
      const profileAvatarNode = document.getElementById("profile-hero-avatar");

      if (profileNameNode instanceof HTMLElement && profile) {
        const profileName = `${profile.firstName || "User"} ${profile.lastName || ""}`.trim();
        profileNameNode.textContent = profileName || "User";
      }

      if (profileSubtitleNode instanceof HTMLElement) {
        profileSubtitleNode.textContent = `@${String(profile?.username || profileUsername)}`;
      }

      if (profileAvatarNode instanceof HTMLElement && profile) {
        const profileName = `${profile.firstName || "User"} ${profile.lastName || ""}`.trim();
        const initial = (profile.firstName || profileName || "U").charAt(0).toUpperCase();
        const profileAvatarUrl = resolveProfileImageUrl(
          profile.profileImageUrl || "",
          profile.profileImageFilename || ""
        );

        if (profileAvatarUrl) {
          profileAvatarNode.textContent = "";
          profileAvatarNode.style.backgroundImage = `url(${profileAvatarUrl})`;
          profileAvatarNode.style.backgroundSize = "cover";
          profileAvatarNode.style.backgroundPosition = "center";
        } else {
          profileAvatarNode.style.backgroundImage = "";
          profileAvatarNode.textContent = initial;
        }
      }
    }

    feedList.innerHTML = "";

    if (!posts.length) {
      setFeedStatus(isProfilePage ? "This user has no posts yet." : "No posts yet. Be the first to post.");
      return;
    }

    const fragment = document.createDocumentFragment();
    posts.forEach((post) => {
      fragment.appendChild(buildPostCard(post));
    });

    feedList.appendChild(fragment);
    updateBookmarkCount();
  } catch (error) {
    setFeedStatus(`Cannot load posts: ${error.message}`);
  }
}

function setReactButtonCount(button, count) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const countNode = button.querySelector(".react-count");
  if (!(countNode instanceof HTMLElement)) {
    return;
  }

  const numericValue = Number(count);
  countNode.textContent = String(Number.isNaN(numericValue) ? 0 : Math.max(0, numericValue));
}

function canDeleteComment(comment, postOwnerId) {
  const viewerUserId = getViewerUserId();
  const commentOwnerId = Number(comment?.author?.id || 0);

  if (viewerUserId <= 0 || commentOwnerId <= 0) {
    return false;
  }

  return viewerUserId === commentOwnerId || viewerUserId === postOwnerId;
}

function createCommentNode(comment, postOwnerId) {
  const commentId = Number(comment?.id || 0);
  const authorFirstName = comment?.author?.firstName || "User";
  const authorLastName = comment?.author?.lastName || "";
  const authorName = `${authorFirstName} ${authorLastName}`.trim();
  const content = typeof comment?.content === "string" ? comment.content : "";
  const isDeletable = canDeleteComment(comment, postOwnerId);

  const item = document.createElement("div");
  item.className = "comment-item";
  if (commentId > 0) {
    item.dataset.commentId = String(commentId);
  }

  const contentNode = document.createElement("div");
  contentNode.className = "comment-content";

  const authorNode = document.createElement("a");
  authorNode.className = "comment-author";
  authorNode.href = profilePageUrl(comment?.author?.username || "", comment?.author?.id || 0);
  authorNode.textContent = authorName;

  const textNode = document.createElement("span");
  textNode.className = "comment-text";
  textNode.textContent = `: ${content}`;

  contentNode.append(authorNode, textNode);
  item.appendChild(contentNode);

  if (isDeletable) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "comment-delete-btn";
    deleteBtn.setAttribute("aria-label", "Delete comment");
    deleteBtn.textContent = "X";
    item.appendChild(deleteBtn);
  }

  return item;
}

function renderCommentList(commentWrap, comments) {
  const list = commentWrap.querySelector(".comment-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = "";

  if (!comments.length) {
    return;
  }

  const card = commentWrap.closest(".feed-card");
  const postOwnerId = Number(card?.dataset.authorId || 0);

  const fragment = document.createDocumentFragment();
  comments.forEach((comment) => {
    fragment.appendChild(createCommentNode(comment, postOwnerId));
  });

  list.appendChild(fragment);
}

async function loadCommentsForCard(card) {
  if (!(card instanceof HTMLElement)) {
    return;
  }

  const postId = Number(card.dataset.postId || 0);
  const commentWrap = card.querySelector(".comment-wrap");
  const commentList = card.querySelector(".comment-list");
  const commentBtn = card.querySelector('.react-btn[data-action="comment"]');

  if (!(commentWrap instanceof HTMLElement) || !(commentList instanceof HTMLElement) || postId <= 0) {
    return;
  }

  commentList.innerHTML = '<div class="comment-item">Loading comments...</div>';

  try {
    const response = await postJson("list-comments.php", {
      postId,
      limit: 80,
    });

    const comments = Array.isArray(response?.data?.comments) ? response.data.comments : [];
    renderCommentList(commentWrap, comments);
    setReactButtonCount(commentBtn, response?.data?.commentCount || comments.length);
  } catch (error) {
    commentList.innerHTML = `<div class="comment-item">Cannot load comments: ${error.message}</div>`;
  }
}

async function submitCommentFromWrap(commentWrap, inputNode) {
  if (!(commentWrap instanceof HTMLElement) || !(inputNode instanceof HTMLInputElement)) {
    return;
  }

  const card = commentWrap.closest(".feed-card");
  if (!(card instanceof HTMLElement)) {
    return;
  }

  const postId = Number(card.dataset.postId || 0);
  const userId = getViewerUserId();
  const value = inputNode.value.trim();

  if (!value) {
    inputNode.focus();
    return;
  }

  if (!userId || !postId) {
    window.alert("Please login again before commenting.");
    return;
  }

  inputNode.disabled = true;

  try {
    const response = await postJson("add-comment.php", {
      userId,
      postId,
      content: value,
    });

    const comment = response?.data?.comment;
    const commentCount = response?.data?.commentCount;

    if (comment) {
      const list = commentWrap.querySelector(".comment-list");
      if (list instanceof HTMLElement) {
        const loadingItem = list.querySelector(".comment-item");
        if (loadingItem && loadingItem.textContent?.startsWith("Cannot load comments")) {
          list.innerHTML = "";
        }

        const postOwnerId = Number(card.dataset.authorId || 0);
        list.appendChild(createCommentNode(comment, postOwnerId));
      }
    }

    const commentBtn = card.querySelector('.react-btn[data-action="comment"]');
    setReactButtonCount(commentBtn, commentCount);

    inputNode.value = "";
  } catch (error) {
    window.alert(`Cannot add comment: ${error.message}`);
  } finally {
    inputNode.disabled = false;
    inputNode.focus();
  }
}

function setupPostMenuActions() {
  const closeAllMenus = () => {
    document.querySelectorAll(".post-menu").forEach((menuNode) => {
      if (!(menuNode instanceof HTMLElement)) {
        return;
      }

      menuNode.setAttribute("hidden", "");
      const wrap = menuNode.closest(".post-menu-wrap");
      const toggle = wrap ? wrap.querySelector(".post-menu-toggle") : null;
      if (toggle instanceof HTMLButtonElement) {
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  };

  document.addEventListener("click", async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) {
      return;
    }

    const menuToggle = rawTarget.closest(".post-menu-toggle");
    if (menuToggle instanceof HTMLButtonElement) {
      const wrap = menuToggle.closest(".post-menu-wrap");
      const menu = wrap ? wrap.querySelector(".post-menu") : null;
      if (!(menu instanceof HTMLElement)) {
        return;
      }

      const shouldOpen = menu.hasAttribute("hidden");
      closeAllMenus();

      if (shouldOpen) {
        menu.removeAttribute("hidden");
        menuToggle.setAttribute("aria-expanded", "true");
      }

      return;
    }

    const deleteBtn = rawTarget.closest('.post-menu-item[data-action="delete-post"]');
    if (deleteBtn instanceof HTMLButtonElement) {
      if (deleteBtn.disabled) {
        closeAllMenus();
        return;
      }

      const card = deleteBtn.closest(".feed-card");
      const postId = Number(card?.dataset.postId || 0);
      const userId = getViewerUserId();

      if (!card || postId <= 0 || userId <= 0) {
        closeAllMenus();
        window.alert("Cannot delete this post. Please login again.");
        return;
      }

      const confirmed = window.confirm("Delete this post?");
      if (!confirmed) {
        closeAllMenus();
        return;
      }

      deleteBtn.disabled = true;

      try {
        await postJson("delete-post.php", {
          postId,
          userId,
        });

        card.remove();
        updateBookmarkCount();

        const hasCard = document.querySelector("#feed-list .feed-card");
        if (!hasCard) {
          setFeedStatus("No posts yet. Be the first to post.");
        }
      } catch (error) {
        window.alert(`Cannot delete post: ${error.message}`);
        deleteBtn.disabled = false;
      }

      closeAllMenus();
      return;
    }

    if (!rawTarget.closest(".post-menu-wrap")) {
      closeAllMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllMenus();
    }
  });
}

function setupViewer() {
  const viewer = loadViewer() || {};
  const welcomeName = document.getElementById("welcome-name");
  const welcomeUsername = document.getElementById("welcome-username");
  const avatarNodes = document.querySelectorAll(".avatar");
  const userMenuToggle = document.getElementById("user-menu-toggle");
  const userMenuIcon = userMenuToggle ? userMenuToggle.querySelector("i") : null;

  const firstName = viewer.firstName || "User";
  const lastName = viewer.lastName || "";
  const username = String(viewer.username || "").trim().toLowerCase();
  const profileImage =
    resolveProfileImageUrl(viewer.profileImageUrl || "", viewer.profileImageFilename || "") ||
    viewer.profileImage ||
    window.localStorage.getItem("socialAppProfileImage") ||
    "";

  if (welcomeName instanceof HTMLElement) {
    welcomeName.textContent = `${firstName} ${lastName}`.trim();
  }

  if (welcomeUsername instanceof HTMLElement) {
    welcomeUsername.textContent = username ? `@${username}` : "@user";
  }

  avatarNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (profileImage) {
      node.textContent = "";
      node.style.backgroundImage = `url(${profileImage})`;
      node.style.backgroundSize = "cover";
      node.style.backgroundPosition = "center";
      return;
    }

    node.textContent = "";
    node.style.backgroundImage = "";
  });

  if (userMenuToggle instanceof HTMLButtonElement) {
    if (profileImage) {
      userMenuToggle.style.backgroundImage = `url(${profileImage})`;
      userMenuToggle.classList.add("has-photo");

      if (userMenuIcon instanceof HTMLElement) {
        userMenuIcon.setAttribute("hidden", "");
      }

      return;
    }

    userMenuToggle.style.backgroundImage = "";
    userMenuToggle.classList.remove("has-photo");

    if (userMenuIcon instanceof HTMLElement) {
      userMenuIcon.removeAttribute("hidden");
    }
  }
}

function setupComposer() {
  const postBtn = document.getElementById("post-btn");
  const composerInput = document.getElementById("composer-input");
  const feedList = document.getElementById("feed-list");
  const photoInput = document.getElementById("composer-photo-input");
  const previewWrap = document.getElementById("composer-photo-preview-wrap");
  const previewList = document.getElementById("composer-photo-preview-list");
  const removePhotoBtn = document.getElementById("remove-photo-btn");

  if (!postBtn || !composerInput || !feedList) {
    return;
  }

  const viewer = loadViewer() || {};
  const userId = Number(viewer.id || 0);
  const selectedPhotos = [];

  const addSelectedPhoto = (file) => {
    selectedPhotos.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  };

  const renderComposerPhotoPreview = () => {
    if (!(previewList instanceof HTMLElement) || !(previewWrap instanceof HTMLElement)) {
      return;
    }

    previewList.innerHTML = "";

    if (selectedPhotos.length === 0) {
      previewWrap.setAttribute("hidden", "");
      return;
    }

    selectedPhotos.forEach((photo) => {
      const item = document.createElement("div");
      item.className = "composer-photo-thumb";
      item.innerHTML = `
        <img src="${photo.previewUrl}" alt="Selected photo" />
        <button class="remove-photo-item-btn" type="button" data-photo-id="${photo.id}" aria-label="Remove photo">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      `;
      previewList.appendChild(item);
    });

    previewWrap.removeAttribute("hidden");
  };

  const clearSelectedPhoto = () => {
    selectedPhotos.forEach((photo) => {
      URL.revokeObjectURL(photo.previewUrl);
    });
    selectedPhotos.length = 0;

    if (photoInput instanceof HTMLInputElement) {
      photoInput.value = "";
    }

    renderComposerPhotoPreview();
  };

  if (photoInput instanceof HTMLInputElement) {
    photoInput.addEventListener("change", () => {
      const files = photoInput.files ? Array.from(photoInput.files) : [];

      files.forEach((file) => {
        if (!file.type.startsWith("image/")) {
          return;
        }

        addSelectedPhoto(file);
      });

      photoInput.value = "";
      renderComposerPhotoPreview();
    });
  }

  if (removePhotoBtn instanceof HTMLButtonElement) {
    removePhotoBtn.addEventListener("click", clearSelectedPhoto);
  }

  if (previewList instanceof HTMLElement) {
    previewList.addEventListener("click", (event) => {
      const rawTarget = event.target;
      if (!(rawTarget instanceof HTMLElement)) {
        return;
      }

      const removeBtn = rawTarget.closest(".remove-photo-item-btn");
      if (!(removeBtn instanceof HTMLButtonElement)) {
        return;
      }

      const photoId = removeBtn.dataset.photoId;
      const index = selectedPhotos.findIndex((photo) => photo.id === photoId);
      if (index === -1) {
        return;
      }

      URL.revokeObjectURL(selectedPhotos[index].previewUrl);
      selectedPhotos.splice(index, 1);
      renderComposerPhotoPreview();
    });
  }

  postBtn.addEventListener("click", async () => {
    const value = composerInput.value.trim();
    const hasPhoto = selectedPhotos.length > 0;

    if (!value && !hasPhoto) {
      composerInput.focus();
      return;
    }

    if (!userId) {
      window.alert("Please login again before posting.");
      return;
    }

    postBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append("userId", String(userId));
      formData.append("content", value);

      selectedPhotos.forEach((photo) => {
        formData.append("photos[]", photo.file);
      });

      const response = await postFormData("create-post.php", formData);
      const post = response?.data?.post;

      if (post) {
        const statusNode = feedList.querySelector(".feed-status");
        if (statusNode instanceof HTMLElement) {
          statusNode.remove();
        }

        feedList.prepend(buildPostCard(post));
        updateBookmarkCount();
      }

      composerInput.value = "";
      clearSelectedPhoto();
    } catch (error) {
      window.alert(`Cannot create post: ${error.message}`);
    } finally {
      postBtn.disabled = false;
    }
  });
}

function setupReactions() {
  document.addEventListener("click", async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) {
      return;
    }

    const target = rawTarget.closest(".react-btn");
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.dataset.action;
    const card = target.closest(".feed-card");
    const postId = Number(card?.dataset.postId || 0);

    if (!card || postId <= 0) {
      return;
    }

    if (action === "like") {
      const userId = getViewerUserId();
      if (!userId) {
        window.alert("Please login again before liking posts.");
        return;
      }

      target.disabled = true;

      try {
        const response = await postJson("toggle-like.php", { userId, postId });
        const liked = Boolean(response?.data?.liked);
        target.classList.toggle("active", liked);
        setReactButtonCount(target, response?.data?.likeCount || 0);
      } catch (error) {
        window.alert(`Cannot update like: ${error.message}`);
      } finally {
        target.disabled = false;
      }

      return;
    }

    if (action === "bookmark") {
      const userId = getViewerUserId();
      if (!userId) {
        window.alert("Please login again before bookmarking posts.");
        return;
      }

      target.disabled = true;

      try {
        const response = await postJson("toggle-bookmark.php", { userId, postId });
        const bookmarked = Boolean(response?.data?.bookmarked);
        target.classList.toggle("active", bookmarked);
        setReactButtonCount(target, response?.data?.bookmarkCount || 0);
        updateBookmarkCount();
      } catch (error) {
        window.alert(`Cannot update bookmark: ${error.message}`);
      } finally {
        target.disabled = false;
      }

      return;
    }

    if (action === "comment") {
      const wrap = card.querySelector(".comment-wrap");
      if (!wrap) {
        return;
      }

      if (wrap.hasAttribute("hidden")) {
        wrap.removeAttribute("hidden");
        await loadCommentsForCard(card);
        const input = wrap.querySelector(".comment-input");
        if (input instanceof HTMLElement) {
          input.focus();
        }
      } else {
        wrap.setAttribute("hidden", "");
      }
    }
  });
}

function setupComments() {
  document.addEventListener("click", async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) {
      return;
    }

    const deleteBtn = rawTarget.closest(".comment-delete-btn");
    if (deleteBtn instanceof HTMLButtonElement) {
      const commentNode = deleteBtn.closest(".comment-item");
      const card = deleteBtn.closest(".feed-card");
      const commentId = Number(commentNode?.dataset.commentId || 0);
      const userId = getViewerUserId();

      if (!card || !commentNode || commentId <= 0 || userId <= 0) {
        window.alert("Cannot delete this comment.");
        return;
      }

      const confirmed = window.confirm("Delete this comment?");
      if (!confirmed) {
        return;
      }

      deleteBtn.disabled = true;

      try {
        const response = await postJson("delete-comment.php", {
          userId,
          commentId,
        });

        commentNode.remove();

        const commentBtn = card.querySelector('.react-btn[data-action="comment"]');
        setReactButtonCount(commentBtn, response?.data?.commentCount || 0);
      } catch (error) {
        window.alert(`Cannot delete comment: ${error.message}`);
        deleteBtn.disabled = false;
      }

      return;
    }

    const target = rawTarget.closest(".comment-submit-btn");
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const wrap = target.closest(".comment-wrap");
    if (!wrap) {
      return;
    }

    const input = wrap.querySelector(".comment-input");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const value = input.value.trim();
    if (!value) {
      input.focus();
      return;
    }

    await submitCommentFromWrap(wrap, input);
  });

  document.addEventListener("keydown", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (!target.classList.contains("comment-input") || event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const value = target.value.trim();
    if (!value) {
      return;
    }

    const wrap = target.closest(".comment-wrap");
    if (!wrap) {
      return;
    }

    await submitCommentFromWrap(wrap, target);
  });
}

function updateBookmarkCount() {
  const countNode = document.getElementById("bookmark-count");
  if (!countNode) {
    return;
  }

  const count = document.querySelectorAll('.react-btn[data-action="bookmark"].active').length;
  countNode.textContent = String(count);
}

function setupFollowButtons() {
  document.addEventListener("click", async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) {
      return;
    }

    const target = rawTarget.closest(".follow-btn");
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const suggestItem = target.closest("li[data-user-id]");
    const targetUserId = Number(suggestItem?.dataset.userId || 0);
    const userId = getViewerUserId();

    if (!userId || targetUserId <= 0) {
      window.alert("Please login again before following users.");
      return;
    }

    target.disabled = true;

    try {
      const response = await postJson("toggle-follow.php", {
        userId,
        targetUserId,
      });

      const following = Boolean(response?.data?.isFollowing);
      target.classList.toggle("following", following);
      target.innerHTML = following
        ? '<i class="fa-solid fa-user-check" aria-hidden="true"></i><span>Following</span>'
        : '<i class="fa-solid fa-user-plus" aria-hidden="true"></i><span>Follow</span>';
    } catch (error) {
      window.alert(`Cannot update follow: ${error.message}`);
    } finally {
      target.disabled = false;
    }
  });
}

function createSuggestedUserItem(user) {
  const item = document.createElement("li");
  item.dataset.userId = String(Number(user?.id || 0));

  const firstName = user?.firstName || "User";
  const lastName = user?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const avatarText = (firstName || fullName || "U").charAt(0).toUpperCase();
  const avatarUrl = resolveProfileImageUrl(user?.profileImageUrl || "", user?.profileImageFilename || "");
  const following = Boolean(user?.isFollowing);

  item.innerHTML = `
    <a class="suggest-user-link" href="${profilePageUrl(user?.username || "", user?.id || 0)}" title="${escapeHtml(fullName || "User")}">
      <span class="suggest-user-avatar" ${avatarUrl ? `style="background-image:url('${escapeHtml(avatarUrl)}')"` : ""}>${avatarUrl ? "" : escapeHtml(avatarText)}</span>
      <span class="suggest-user-name">${escapeHtml(fullName || "User")}</span>
    </a>
    <button class="follow-btn ${following ? "following" : ""}" type="button">
      <i class="fa-solid ${following ? "fa-user-check" : "fa-user-plus"}" aria-hidden="true"></i>
      <span>${following ? "Following" : "Follow"}</span>
    </button>
  `;

  return item;
}

async function loadSuggestedUsers() {
  const suggestList = document.getElementById("friend-suggest-list");
  if (!(suggestList instanceof HTMLElement)) {
    return;
  }

  suggestList.innerHTML = '<li>Loading suggestions...</li>';

  try {
    const response = await postJson("list-suggested-users.php", {
      userId: getViewerUserId(),
      limit: 6,
    });

    const users = Array.isArray(response?.data?.users) ? response.data.users : [];
    suggestList.innerHTML = "";

    if (!users.length) {
      suggestList.innerHTML = '<li>No suggestions right now.</li>';
      return;
    }

    const fragment = document.createDocumentFragment();
    users.forEach((user) => {
      fragment.appendChild(createSuggestedUserItem(user));
    });

    suggestList.appendChild(fragment);
  } catch (error) {
    suggestList.innerHTML = `<li>Cannot load suggestions: ${escapeHtml(error.message)}</li>`;
  }
}

function setupTopbarMenu() {
  const menuToggle = document.getElementById("user-menu-toggle");
  const menu = document.getElementById("user-menu");
  const settingBtn = document.getElementById("user-setting-btn");
  const mobileMenuLinks = Array.from(document.querySelectorAll(".user-menu-mobile-link"));

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

    if (target.closest(".user-menu-wrap")) {
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

  mobileMenuLinks.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    link.addEventListener("click", () => {
      closeMenu();
    });
  });
}

function setupMobileNavAndSearch() {
  const navToggle = document.getElementById("mobile-nav-toggle");
  const navPanel = document.getElementById("mobile-nav-panel");
  const navBackdrop = document.getElementById("mobile-nav-backdrop");
  const mobileSearchToggle = document.getElementById("mobile-search-toggle");
  const mobileSearchPanel = document.getElementById("mobile-search-panel");
  const mobileSearchInput = document.getElementById("mobile-search-input");

  const closeMobileNav = () => {
    document.body.classList.remove("mobile-nav-open");
    if (navBackdrop instanceof HTMLElement) {
      navBackdrop.setAttribute("hidden", "");
    }

    if (navToggle instanceof HTMLButtonElement) {
      navToggle.setAttribute("aria-expanded", "false");
    }
  };

  const openMobileNav = () => {
    document.body.classList.add("mobile-nav-open");
    if (navBackdrop instanceof HTMLElement) {
      navBackdrop.removeAttribute("hidden");
    }

    if (navToggle instanceof HTMLButtonElement) {
      navToggle.setAttribute("aria-expanded", "true");
    }
  };

  if (navToggle instanceof HTMLButtonElement && navPanel instanceof HTMLElement) {
    navToggle.addEventListener("click", () => {
      if (document.body.classList.contains("mobile-nav-open")) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });

    navPanel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeMobileNav();
      });
    });
  }

  if (navBackdrop instanceof HTMLElement) {
    navBackdrop.addEventListener("click", closeMobileNav);
  }

  if (mobileSearchToggle instanceof HTMLButtonElement && mobileSearchPanel instanceof HTMLElement) {
    mobileSearchToggle.addEventListener("click", () => {
      const isHidden = mobileSearchPanel.hasAttribute("hidden");
      if (isHidden) {
        mobileSearchPanel.removeAttribute("hidden");
        mobileSearchToggle.setAttribute("aria-expanded", "true");
        if (mobileSearchInput instanceof HTMLInputElement) {
          mobileSearchInput.focus();
        }
      } else {
        mobileSearchPanel.setAttribute("hidden", "");
        mobileSearchToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      closeMobileNav();

      if (mobileSearchPanel instanceof HTMLElement) {
        mobileSearchPanel.setAttribute("hidden", "");
      }

      if (mobileSearchToggle instanceof HTMLButtonElement) {
        mobileSearchToggle.setAttribute("aria-expanded", "false");
      }
    }
  });
}

function goToSearchPage(rawQuery) {
  const query = String(rawQuery || "").trim();
  if (!query) {
    window.location.href = "search.html";
    return;
  }

  const encodedQuery = encodeURIComponent(query);
  window.location.href = `search.html?q=${encodedQuery}`;
}

function setupSearchNavigation() {
  const desktopSearchInput = document.getElementById("search-input");
  const mobileSearchInput = document.getElementById("mobile-search-input");

  if (desktopSearchInput instanceof HTMLInputElement) {
    desktopSearchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      goToSearchPage(desktopSearchInput.value);
    });
  }

  if (mobileSearchInput instanceof HTMLInputElement) {
    mobileSearchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      goToSearchPage(mobileSearchInput.value);
    });
  }
}

function setupPhotoLightbox() {
  const lightbox = document.getElementById("photo-lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const closeBtn = document.getElementById("lightbox-close");
  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");
  const counter = document.getElementById("lightbox-counter");

  if (
    !(lightbox instanceof HTMLElement) ||
    !(lightboxImage instanceof HTMLImageElement) ||
    !(closeBtn instanceof HTMLButtonElement) ||
    !(prevBtn instanceof HTMLButtonElement) ||
    !(nextBtn instanceof HTMLButtonElement) ||
    !(counter instanceof HTMLElement)
  ) {
    return;
  }

  let photos = [];
  let index = 0;

  const render = () => {
    if (!photos.length) {
      return;
    }

    lightboxImage.src = photos[index];
    counter.textContent = `${index + 1} / ${photos.length}`;
  };

  const closeLightbox = () => {
    lightbox.setAttribute("hidden", "");
    document.body.style.overflow = "";
    photos = [];
    index = 0;
  };

  const openLightbox = (photoList, startIndex) => {
    photos = photoList;
    index = startIndex;
    render();
    lightbox.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  };

  const showNext = () => {
    if (!photos.length) {
      return;
    }

    index = (index + 1) % photos.length;
    render();
  };

  const showPrev = () => {
    if (!photos.length) {
      return;
    }

    index = (index - 1 + photos.length) % photos.length;
    render();
  };

  document.addEventListener("click", (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) {
      return;
    }

    const image = rawTarget.closest(".feed-post-photo");
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    const gallery = image.closest(".feed-post-gallery");
    if (!(gallery instanceof HTMLElement)) {
      return;
    }

    const nodes = Array.from(gallery.querySelectorAll(".feed-post-photo"));
    const photoList = nodes.map((node) => node.src).filter(Boolean);
    const startIndex = nodes.indexOf(image);

    if (!photoList.length || startIndex < 0) {
      return;
    }

    openLightbox(photoList, startIndex);
  });

  closeBtn.addEventListener("click", closeLightbox);
  nextBtn.addEventListener("click", showNext);
  prevBtn.addEventListener("click", showPrev);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hasAttribute("hidden")) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "ArrowRight") {
      showNext();
    }

    if (event.key === "ArrowLeft") {
      showPrev();
    }
  });
}

function setupLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) {
    return;
  }

  logoutBtn.addEventListener("click", () => {
    window.localStorage.removeItem("socialAppCurrentUser");
    window.location.href = "index.html";
  });
}

setupViewer();
setupComposer();
setupReactions();
setupComments();
setupFollowButtons();
setupTopbarMenu();
setupPostMenuActions();
setupMobileNavAndSearch();
setupSearchNavigation();
setupPhotoLightbox();
updateBookmarkCount();
setupLogout();
loadSuggestedUsers();
loadFeedPosts();
