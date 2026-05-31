const serverLocalStorage: Storage = {
  length: 0,
  clear() {
    /* no-op during static prerender */
  },
  getItem() {
    return null;
  },
  key() {
    return null;
  },
  removeItem() {
    /* no-op during static prerender */
  },
  setItem() {
    /* no-op during static prerender */
  },
};

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: serverLocalStorage,
    configurable: true,
  });
}

export {};
