// Small localStorage wrapper. It exists so every read/write in the app goes
// through one place that never throws — private browsing, blocked storage,
// or a full quota can all make raw localStorage calls throw, and a feature
// like the guest cart shouldn't crash the page just because storage isn't
// available.
export function getStorageItem(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Targeted removal — the deliberate alternative to `localStorage.clear()`,
// which used to wipe the guest cart and any other unrelated key on logout.
export function removeStorageItems(keys) {
  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore — nothing to clean up if storage isn't available
    }
  });
}
