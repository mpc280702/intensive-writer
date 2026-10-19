// Local-first storage adapter with per-account namespaces and optional PostgreSQL sync.
// Existing guest-mode localStorage data remains readable for backward compatibility.
(function () {
  let activeUserId = 'guest';
  const pendingByKey = new Map();
  const LEGACY_PREFIXES = ['iw:attempt:', 'iw:explore:', 'iw:stats'];

  function scopedPrefix() {
    return 'iw:local:' + encodeURIComponent(activeUserId) + ':';
  }
  function scopedKey(key) {
    return scopedPrefix() + key;
  }
  function canSync() {
    return Boolean(window.IWApi && window.IWApi.isConfigured() && window.IWAuth && window.IWAuth.currentUser && String(window.IWAuth.currentUser.id) === String(activeUserId));
  }
  function readLocal(key) {
    try {
      let value = localStorage.getItem(scopedKey(key));
      if (value !== null) return value;
      if (activeUserId === 'guest' && LEGACY_PREFIXES.some(function (prefix) { return key === prefix || key.startsWith(prefix); })) {
        value = localStorage.getItem(key);
        if (value !== null) {
          localStorage.setItem(scopedKey(key), value);
          return value;
        }
      }
      return null;
    } catch (error) {
      console.warn('[storage] local read failed', error);
      return null;
    }
  }
  function writeLocal(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(scopedKey(key), serialized);
    return serialized;
  }
  function pendingKeys() {
    try {
      const raw = localStorage.getItem(scopedKey('__pending_keys'));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  function savePendingKeys(keys) {
    localStorage.setItem(scopedKey('__pending_keys'), JSON.stringify(Array.from(new Set(keys))));
  }
  function addPending(key) {
    savePendingKeys(pendingKeys().concat([key]));
  }
  function removePending(key) {
    savePendingKeys(pendingKeys().filter(function (item) { return item !== key; }));
  }

  let toastTimer = null;
  function showLocalOnlyNotice(message) {
    let toast = document.getElementById('saveToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'saveToast';
      toast.className = 'save-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message || 'Kept locally — waiting to sync.';
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 5000);
  }

  function syncKey(key) {
    const previous = pendingByKey.get(key) || Promise.resolve();
    const task = previous.catch(function () {}).then(async function () {
      if (!canSync()) throw new Error('NO_AUTHENTICATED_API');
      const value = readLocal(key);
      if (value === null) return;
      await window.IWApi.request('/api/storage/' + encodeURIComponent(key), {
        method: 'PUT',
        body: JSON.stringify({ value: value })
      });
      removePending(key);
    });
    pendingByKey.set(key, task);
    return task.finally(function () {
      if (pendingByKey.get(key) === task) pendingByKey.delete(key);
    });
  }

  async function syncPending() {
    if (!canSync()) return;
    const keys = pendingKeys();
    for (const key of keys) {
      try {
        await syncKey(key);
      } catch (error) {
        showLocalOnlyNotice('Kept locally — waiting to sync.');
        break;
      }
    }
  }

  window.storage = {
    setUser(userId) {
      activeUserId = userId || 'guest';
      if (canSync()) syncPending().catch(function () {});
    },
    async get(key) {
      const localValue = readLocal(key);
      if (canSync() && !pendingKeys().includes(key)) {
        try {
          const result = await window.IWApi.request('/api/storage/' + encodeURIComponent(key));
          if (result && result.found && typeof result.value === 'string') {
            localStorage.setItem(scopedKey(key), result.value);
            return { value: result.value, source: 'server' };
          }
        } catch (error) {
          if (error.status !== 404 && localValue === null) showLocalOnlyNotice('Cloud storage unavailable; working locally.');
        }
      }
      return localValue !== null ? { value: localValue, source: 'local' } : null;
    },
    async set(key, value) {
      let serialized;
      try {
        serialized = writeLocal(key, value);
      } catch (error) {
        console.error('[storage] unable to keep a local copy', error);
        throw error;
      }
      if (!canSync()) return { key: key, value: serialized, localOnly: true };
      addPending(key);
      try {
        await syncKey(key);
        return { key: key, value: serialized, synced: true };
      } catch (error) {
        addPending(key);
        showLocalOnlyNotice('Kept locally — waiting to sync.');
        return { key: key, value: serialized, localOnly: true, syncError: error.message };
      }
    },
    async list(prefix) {
      prefix = prefix || '';
      const keys = new Set();
      try {
        const localPrefix = scopedPrefix();
        for (let i = 0; i < localStorage.length; i++) {
          const storedKey = localStorage.key(i);
          if (!storedKey || !storedKey.startsWith(localPrefix)) continue;
          const key = storedKey.slice(localPrefix.length);
          if (key !== '__pending_keys' && (!prefix || key.startsWith(prefix))) keys.add(key);
        }
        if (activeUserId === 'guest') {
          for (let i = 0; i < localStorage.length; i++) {
            const legacyKey = localStorage.key(i);
            if (legacyKey && LEGACY_PREFIXES.some(function (p) { return legacyKey.startsWith(p); }) && (!prefix || legacyKey.startsWith(prefix))) {
              if (readLocal(legacyKey) !== null) keys.add(legacyKey);
            }
          }
        }
      } catch (error) {
        console.warn('[storage] local list failed', error);
      }

      if (canSync()) {
        try {
          const result = await window.IWApi.request('/api/storage?prefix=' + encodeURIComponent(prefix));
          for (const item of (result.items || [])) {
            if (!item || typeof item.key !== 'string') continue;
            keys.add(item.key);
            if (!pendingKeys().includes(item.key) && typeof item.value === 'string') {
              localStorage.setItem(scopedKey(item.key), item.value);
            }
          }
        } catch (error) {
          if (!keys.size) showLocalOnlyNotice('Kept locally — cloud data could not be loaded.');
        }
      }
      return { keys: Array.from(keys).sort() };
    },
    async delete(key) {
      try { localStorage.removeItem(scopedKey(key)); } catch (error) {}
      removePending(key);
      if (activeUserId === 'guest') {
        try { localStorage.removeItem(key); } catch (error) {}
      }
      if (canSync()) {
        try { await window.IWApi.request('/api/storage/' + encodeURIComponent(key), { method: 'DELETE' }); }
        catch (error) { showLocalOnlyNotice('Could not sync deletion to the cloud.'); return false; }
      }
      return true;
    },
    async syncPending() { return syncPending(); }
  };

  window.addEventListener('online', function () { syncPending().catch(function () {}); });
})();