/* ============================================================
   زاد القلوب — Service Worker
   ============================================================ */
const CACHE_VERSION = 'zad-alqolob-v1.0.1';
const CACHE_STATIC = CACHE_VERSION + '-static';
const CACHE_DYNAMIC = CACHE_VERSION + '-dynamic';

/* الملفات الأساسية اللي بتتخزن أول مرة */
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js',
  'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&family=Reem+Kufi:wght@400;500;600;700&display=swap'
];

/* التثبيت */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return Promise.allSettled(
        STATIC_FILES.map(url => cache.add(url).catch(err => console.warn('Cache skip:', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

/* التنشيط — حذف الكاش القديم */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
            .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

/* الجلب — استراتيجية ذكية */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  /* تجاهل الطلبات غير GET */
  if(req.method !== 'GET') return;

  /* Firebase — شبكة أولاً (عشان البيانات محدثة) */
  if(url.hostname.includes('firebase') || url.hostname.includes('firebaseio')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  /* Quran API — شبكة أولاً مع تخزين مؤقت */
  if(url.hostname.includes('alquran.cloud') || url.hostname.includes('islamic.network')) {
    event.respondWith(
      caches.open(CACHE_DYNAMIC).then(cache => {
        return fetch(req).then(res => {
          if(res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => cache.match(req));
      })
    );
    return;
  }

  /* Prayer API — شبكة أولاً */
  if(url.hostname.includes('aladhan.com')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  /* HTML — Network First (عشان التحديثات) */
  if(req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')){
    event.respondWith(
      fetch(req).then(res => {
        if(res && res.status === 200){
          const clone = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        return caches.match(req).then(cached => cached || caches.match('./index.html'));
      })
    );
    return;
  }

  /* باقي الملفات — كاش أولاً */
  event.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        if(res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});

/* رسالة من الصفحة — تحديث الكاش */
self.addEventListener('message', event => {
  if(event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
