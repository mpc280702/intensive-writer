// Storage Adapter for Intensive Writer
// Uses localStorage with a Promise-based API compatible with window.storage

if (!window.storage) {
  window.storage = {
    async get(key) {
      try {
        const val = localStorage.getItem(key);
        return val !== null ? { value: val } : null;
      } catch (e) {
        console.warn('[storage] get error', e);
        return null;
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        return { key, value };
      } catch (e) {
        console.error('[storage] set error', e);
        throw e;
      }
    },
    async list(prefix = '') {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!prefix || k.startsWith(prefix)) {
            keys.push(k);
          }
        }
        return { keys };
      } catch (e) {
        console.warn('[storage] list error', e);
        return { keys: [] };
      }
    },
    async delete(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        console.warn('[storage] delete error', e);
        return false;
      }
    }
  };
}

function sanitizeForStorage(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof key === 'string' && key.startsWith('_')) return undefined;
    if (value === undefined) return null;
    return value;
  }));
}

let saveToastTimer = null;
function showSaveFallback(msg = 'Unable to save to server. Your selection is kept locally.') {
  let toast = document.getElementById('saveToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'saveToast';
    toast.className = 'save-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  if (saveToastTimer) clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

async function safeSet(key, dataObj, context) {
  let payload;
  try {
    payload = JSON.stringify(sanitizeForStorage(dataObj));
  } catch (serErr) {
    console.error('[storage] serialization failed', { key, context, error: serErr });
    showSaveFallback('Lỗi định dạng dữ liệu lưu trữ.');
    return false;
  }
  try {
    const result = await window.storage.set(key, payload);
    return true;
  } catch (err) {
    console.error('[storage] set error', { key, context, err });
    showSaveFallback('Không thể lưu vào bộ nhớ cục bộ.');
    return false;
  }
}
