const API = "https://gacha.rankongpor.com/api";

function authHeader() {
  return { Authorization: localStorage.token };
}

function rollGacha() {
  fetch(API+'/gacha_roll.php', {
    method:'POST',
    headers: authHeader()
  })
  .then(r=>r.json())
  .then(p=>{
    document.getElementById('result').innerHTML = `
      <img src="${API}/uploads/${p.filename}">
      <div class="rarity ${p.rarity}">${p.rarity}</div>
    `;
    loadGallery();
  });
}

function loadGallery() {
  fetch(API+'/gallery.php', { headers: authHeader() })
  .then(r=>r.json())
  .then(list=>{
    gallery.innerHTML='';
    list.forEach(p=>{
      gallery.innerHTML+=`
        <div class="card ${p.rarity}">
          <img src="${API}/uploads/${p.filename}">
          <span>${p.rarity}</span>
        </div>`;
    });
  });
}

function rollGacha() {
  const overlay = document.getElementById('gachaOverlay');
  const img = document.getElementById('gachaResult');
  const text = document.getElementById('rarityText');
  const circle = document.getElementById('gachaCircle');

  overlay.classList.remove('hidden');
  img.className = '';
  img.style.opacity = 0;
  text.innerHTML = '';

  fetch(API + '/gacha_roll.php', {
    method: 'POST',
    headers: { Authorization: localStorage.token }
  })
  .then(r => r.json())
  .then(p => {
    setTimeout(() => {
      circle.style.display = 'none';
      img.src = API + '/uploads/' + p.filename;
      img.classList.add('show');
      img.classList.add(p.rarity);
      text.innerHTML = p.rarity;
      text.className = p.rarity;
      loadGallery();
    }, 1500);
  });

  overlay.onclick = () => {
    overlay.classList.add('hidden');
    circle.style.display = 'block';
  };
}

function loadMe() {
  fetch(API + '/me.php', { headers: authHeader() })
  .then(r=>r.json())
  .then(d=>{
    credit.innerText = 'Credit: ' + d.credit;
    pity.innerText = 'Pity: ' + d.pity + '/50';
  });
}

function logout() {
  localStorage.clear();
  location.href = 'index.html';
}
