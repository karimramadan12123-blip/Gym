(() => {
  'use strict';

  const DEFAULT_CARD = 'default-card.jpg';
  const DB_NAME = 'qr-code-gym';
  const STORE = 'kv';
  const KEY = 'card';

  const $ = (id) => document.getElementById(id);
  const cardImg = $('cardImg');
  const viewer = $('viewer');
  const viewerImg = $('viewerImg');
  const home = $('home');
  const settings = $('settings');
  const statusEl = $('status');
  const fileInput = $('fileInput');

  let currentUrl = null; // object URL للكارت المخصص

  /* ---------- IndexedDB (تخزين محلي دائم) ---------- */
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbGet() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }
  async function dbSet(blob) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function dbDelete() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- عرض الكارت ---------- */
  function showCard(src) {
    cardImg.src = src;
    viewerImg.src = src;
  }

  async function loadCard() {
    try {
      const blob = await dbGet();
      if (blob) {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        currentUrl = URL.createObjectURL(blob);
        showCard(currentUrl);
        return;
      }
    } catch (e) { /* نرجع للكارت الافتراضي */ }
    showCard(DEFAULT_CARD);
  }

  /* ---------- التنقل ---------- */
  function openSettings() {
    home.hidden = true;
    settings.hidden = false;
    statusEl.textContent = '';
    if (location.hash !== '#settings') history.pushState({ s: 1 }, '', '#settings');
  }
  function closeSettings() {
    settings.hidden = true;
    home.hidden = false;
  }
  function openViewer() {
    viewer.hidden = false;
    if (location.hash !== '#card') history.pushState({ v: 1 }, '', '#card');
  }
  function closeViewer() {
    viewer.hidden = true;
  }

  $('settingsBtn').addEventListener('click', openSettings);
  $('backBtn').addEventListener('click', () => {
    if (location.hash === '#settings') history.back(); else closeSettings();
  });
  $('cardBtn').addEventListener('click', openViewer);
  $('closeViewer').addEventListener('click', () => {
    if (location.hash === '#card') history.back(); else closeViewer();
  });
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer || e.target.classList.contains('viewer-stage')) {
      if (location.hash === '#card') history.back(); else closeViewer();
    }
  });
  window.addEventListener('popstate', () => {
    if (location.hash !== '#card') closeViewer();
    if (location.hash !== '#settings') closeSettings();
  });

  /* ---------- تغيير الكارت ---------- */
  $('changeBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      statusEl.textContent = 'من فضلك اختر ملف صورة.';
      return;
    }
    try {
      await dbSet(file);
      await loadCard();
      statusEl.textContent = 'تم تغيير الكارت وحفظه على الجهاز ✓';
    } catch (e) {
      statusEl.textContent = 'تعذّر حفظ الصورة. حاول مرة أخرى.';
    }
  });

  /* ---------- استعادة الافتراضي ---------- */
  $('resetBtn').addEventListener('click', async () => {
    try {
      await dbDelete();
      if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }
      showCard(DEFAULT_CARD);
      statusEl.textContent = 'تمت استعادة الكارت الافتراضي ✓';
    } catch (e) {
      statusEl.textContent = 'تعذّرت الاستعادة. حاول مرة أخرى.';
    }
  });

  /* ---------- البداية ---------- */
  if (location.hash) history.replaceState(null, '', location.pathname);

  const splash = $('splash');
  const started = Date.now();
  loadCard().finally(() => {
    const wait = Math.max(0, 600 - (Date.now() - started));
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 400);
    }, wait);
  });

  // طلب تخزين دائم حتى لا يحذف المتصفح الكارت
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  /* ---------- Service Worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
