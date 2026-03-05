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

function getReactionValue(post, key) {
  const value = post?.reactions?.[key];
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return Math.max(0, numericValue);
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
  const summary = document.getElementById("bookmarks-summary");
  if (summary instanceof HTMLElement) {
    summary.textContent = text;
  }
}

function setEmpty(message) {
  const list = document.getElementById("bookmarks-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = `<p class="bookmarks-empty">${message}</p>`;
}

function createBookmarkCard(post) {
  const card = document.createElement("article");
  card.className = "feed-card card-glass";
  card.dataset.postId = String(post.id || "");
  card.dataset.authorId = String(post?.author?.id || "");

  const firstName = post?.author?.firstName || "User";
  const lastName = post?.author?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const avatarText = (firstName || fullName || "U").charAt(0).toUpperCase();
  const avatarUrl = resolveProfileImageUrl(
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
        <div class="feed-author-avatar" ${avatarUrl ? `style="background-image:url('${avatarUrl}')"` : ""}>${
        avatarUrl ? "" : avatarText
      }</div>
      <div class="feed-author-meta">
        <h3><a class="feed-author-name-link" href="${profilePageUrl(post?.author?.username || "", post?.author?.id || 0)}">${fullName || "User"}</a></h3>
        <p>${createdAtLabel}</p>
      </div>
      </div>
    </header>
    <p class="feed-post-content" ${content ? "" : "hidden"}></p>
    <div class="feed-post-gallery" ${imageUrls.length ? "" : "hidden"}></div>
    <footer>
      <button class="react-btn ${isLiked ? "active" : ""}" type="button" disabled><i class="fa-regular fa-thumbs-up" aria-hidden="true"></i><span>Like</span><span class="react-count">${likeCount}</span></button>
      <button class="react-btn" type="button" disabled><i class="fa-regular fa-comment" aria-hidden="true"></i><span>Comment</span><span class="react-count">${commentCount}</span></button>
      <button class="react-btn ${isBookmarked ? "active" : ""}" type="button" disabled><i class="fa-regular fa-bookmark" aria-hidden="true"></i><span>Bookmark</span><span class="react-count">${bookmarkCount}</span></button>
    </footer>
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
      image.alt = "Bookmarked post photo";
      image.loading = "lazy";
      galleryNode.appendChild(image);
    });

    if (imageUrls.length === 1) {
      galleryNode.classList.add("single");
    }
  }

  return card;
}

function renderBookmarkedPosts(posts) {
  const list = document.getElementById("bookmarks-list");
  if (!(list instanceof HTMLElement)) {
    return;
  }

  list.innerHTML = "";

  if (!posts.length) {
    setSummary("Bookmarked posts: 0");
    setEmpty("No bookmarked posts yet.");
    return;
  }

  const fragment = document.createDocumentFragment();
  posts.forEach((post) => {
    fragment.appendChild(createBookmarkCard(post));
  });

  list.appendChild(fragment);
  setSummary(`Bookmarked posts: ${posts.length}`);
}

async function loadBookmarkedPosts() {
  const userId = getViewerUserId();
  if (!userId) {
    window.location.href = "index.html";
    return;
  }

  try {
    const response = await postJson("list-bookmarked-posts.php", {
      userId,
      limit: 80,
    });

    const posts = Array.isArray(response?.data?.posts) ? response.data.posts : [];
    renderBookmarkedPosts(posts);
  } catch (error) {
    setSummary("Cannot load bookmarks.");
    setEmpty(`Failed to load bookmarked posts: ${error.message}`);
  }
}

loadBookmarkedPosts();
