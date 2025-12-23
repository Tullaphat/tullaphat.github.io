const API_BASE = "https://gacha.rankongpor.com/api";

/* ---------- AUTH ---------- */
function login() {
  fetch(API_BASE + "/login.php", {
    method: "POST",
    body: new URLSearchParams({
      username: document.getElementById("username").value
    })
  })
  .then(r => r.json())
  .then(d => {
    localStorage.token = d.token;
    location.href = d.role === 'admin' ? 'admin.html' : 'user.html';
  })
  .catch(() => {
    document.getElementById("error").innerText = "Login failed";
  });
}

function logout() {
  localStorage.clear();
  location.href = "index.html";
}

function auth() {
  return { Authorization: localStorage.token };
}

/* ---------- USER ---------- */
function initUserPage() {
  loadMe();
  loadGallery();
}

function loadMe() {
  fetch(API_BASE + "/me.php", { headers: auth() })
    .then(r => r.json())
    .then(d => {
      credit.innerText = d.credit;
      pity.innerText = d.pity;
    });
}

function rollGacha() {
  fetch(API_BASE + "/gacha_roll.php", {
    method: "POST",
    headers: auth()
  })
  .then(r => r.json())
  .then(p => {
    resultBox.classList.remove("d-none");
    resultImg.src = API_BASE + "/uploads/" + p.filename;
    resultRarity.innerText = p.rarity;
    resultRarity.className = p.rarity;
    loadMe();
    loadGallery();
  });
}

function loadGallery() {
  fetch(API_BASE + "/gallery.php", { headers: auth() })
    .then(r => r.json())
    .then(list => {
      gallery.innerHTML = "";
      list.forEach(p => {
        gallery.innerHTML += `
          <div class="col-4 col-md-2 gallery-item">
            <img src="${API_BASE}/uploads/${p.filename}">
          </div>`;
      });
    });
}

/* ---------- ADMIN ---------- */
function addCredit() {
  fetch(API_BASE + "/admin/add_credit.php", {
    method: "POST",
    headers: auth(),
    body: new URLSearchParams({
      user_id: adminUserId.value,
      amount: adminAmount.value
    })
  }).then(() => alert("Credit added"));
}

document.getElementById("uploadForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const form = new FormData(uploadForm);
  fetch(API_BASE + "/admin/upload_photo.php", {
    method: "POST",
    headers: auth(),
    body: form
  }).then(() => alert("Uploaded"));
});
