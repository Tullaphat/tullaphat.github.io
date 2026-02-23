// API Configuration
// For local development (MAMP on port 80):
// const API_BASE = 'http://localhost/akibar-photoset-tracker/api';

// For production deployment (Backend on hosting, Frontend on GitHub Pages):
const API_BASE = 'https://track.rankongpor.com/api';

// Toggle between localStorage (false) and backend API (true)
const USE_REMOTE_API = true;  // Set to true to use backend API

const STORAGE_KEY = 'photoset_tracker_users';
const SESSION_KEY = 'photoset_tracker_session';
const COLLECTIONS_KEY = 'photoset_tracker_collections';

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

async function remoteRequest(path, options = {}) {
  const headers = { 
    'Content-Type': 'application/json',
    ...options.headers 
  };
  
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

async function checkEmailExists(email) {
  if (USE_REMOTE_API) {
    return remoteRequest(`/auth/check-email?email=${encodeURIComponent(email)}`);
  }

  const users = loadUsers();
  const exists = users.some((user) => user.email.toLowerCase() === email.toLowerCase());
  return { exists };
}

async function registerUser(email, pin, displayName) {
  if (USE_REMOTE_API) {
    return remoteRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, pin, displayName }),
    });
  }

  const users = loadUsers();
  const exists = users.some((user) => user.email.toLowerCase() === email.toLowerCase());

  if (exists) {
    return { success: false, message: 'Email already exists' };
  }

  users.push({
    email,
    pin,
    displayName,
    createdAt: new Date().toISOString(),
  });

  saveUsers(users);
  return { success: true };
}

async function verifyPin(email, pin) {
  if (USE_REMOTE_API) {
    return remoteRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, pin }),
    });
  }

  const users = loadUsers();
  const found = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (!found) {
    return { success: false, message: 'Email not found' };
  }

  if (found.pin !== pin) {
    return { success: false, message: 'Invalid PIN' };
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify({ email: found.email, displayName: found.displayName, loginAt: Date.now() }));
  return { success: true, user: { email: found.email } };
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
}

async function updateDisplayName(email, newDisplayName) {
  if (USE_REMOTE_API) {
    return remoteRequest('/auth/update-display-name', {
      method: 'PUT',
      body: JSON.stringify({ email, displayName: newDisplayName }),
    });
  }

  const users = loadUsers();
  const found = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (!found) {
    return { success: false, message: 'User not found' };
  }

  found.displayName = newDisplayName;
  saveUsers(users);

  const session = getSession();
  if (session) {
    session.displayName = newDisplayName;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return { success: true };
}

async function updatePin(email, oldPin, newPin) {
  if (USE_REMOTE_API) {
    return remoteRequest('/auth/update-pin', {
      method: 'PUT',
      body: JSON.stringify({ email, oldPin, newPin }),
    });
  }

  const users = loadUsers();
  const found = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (!found) {
    return { success: false, message: 'User not found' };
  }

  if (found.pin !== oldPin) {
    return { success: false, message: 'Current PIN is incorrect' };
  }

  found.pin = newPin;
  saveUsers(users);
  return { success: true };
}

function loadCollectionsMap() {
  try {
    return JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

function saveCollectionsMap(collectionsMap) {
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collectionsMap));
    return { success: true };
  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { success: false, message: 'Storage limit exceeded. Delete some collections or reduce photo sizes.' };
    }
    return { success: false, message: 'Failed to save data.' };
  }
}

async function getCollections(email) {
  if (USE_REMOTE_API) {
    return remoteRequest('/collections', {
      headers: { 'X-User-Email': email }
    });
  }

  const collectionsMap = loadCollectionsMap();
  const key = email.toLowerCase();
  return { collections: collectionsMap[key] || [] };
}

async function createCollection(email, collection) {
  if (USE_REMOTE_API) {
    return remoteRequest('/collections', {
      method: 'POST',
      headers: { 'X-User-Email': email },
      body: JSON.stringify(collection),
    });
  }

  const collectionsMap = loadCollectionsMap();
  const key = email.toLowerCase();
  const current = collectionsMap[key] || [];

  current.unshift({
    ...collection,
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  });

  collectionsMap[key] = current;
  const saveResult = saveCollectionsMap(collectionsMap);

  if (!saveResult.success) {
    return { success: false, message: saveResult.message, collections: current };
  }

  return { success: true, collections: current };
}

async function updateCollection(email, collectionId, collection) {
  if (USE_REMOTE_API) {
    return remoteRequest(`/collections/${encodeURIComponent(collectionId)}`, {
      method: 'PUT',
      headers: { 'X-User-Email': email },
      body: JSON.stringify(collection),
    });
  }

  const collectionsMap = loadCollectionsMap();
  const key = email.toLowerCase();
  const current = collectionsMap[key] || [];
  const index = current.findIndex((item) => item.id === collectionId);

  if (index === -1) {
    return { success: false, message: 'Collection not found', collections: current };
  }

  current[index] = {
    ...current[index],
    ...collection,
    id: current[index].id,
    updatedAt: new Date().toISOString(),
  };

  collectionsMap[key] = current;
  const saveResult = saveCollectionsMap(collectionsMap);

  if (!saveResult.success) {
    return { success: false, message: saveResult.message, collections: current };
  }

  return { success: true, collections: current };
}

async function deleteCollection(email, collectionId) {
  if (USE_REMOTE_API) {
    return remoteRequest(`/collections/${encodeURIComponent(collectionId)}`, {
      method: 'DELETE',
      headers: { 'X-User-Email': email },
    });
  }

  const collectionsMap = loadCollectionsMap();
  const key = email.toLowerCase();
  const current = collectionsMap[key] || [];
  const next = current.filter((item) => item.id !== collectionId);

  if (next.length === current.length) {
    return { success: false, message: 'Collection not found', collections: current };
  }

  collectionsMap[key] = next;
  const saveResult = saveCollectionsMap(collectionsMap);

  if (!saveResult.success) {
    return { success: false, message: saveResult.message, collections: next };
  }

  return { success: true, collections: next };
}

window.AuthApi = {
  checkEmailExists,
  registerUser,
  verifyPin,
  getSession,
  logout,
  updateDisplayName,
  updatePin,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
};
