// Firebase Cloud Messaging Service Worker for ViBa Mart Push Notifications

// Service Worker Lifecycle: Activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Import Firebase compat scripts
try {
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
} catch (e) {
  console.warn('[ViBa Mart SW] Failed loading Firebase scripts from CDN:', e);
}

// Parse firebase config from service worker script URL parameters if provided
function getConfigFromUrl() {
  try {
    const urlParams = new URLSearchParams(self.location.search);
    const apiKey = urlParams.get('apiKey');
    const projectId = urlParams.get('projectId');
    if (apiKey && projectId) {
      return {
        apiKey: apiKey,
        authDomain: urlParams.get('authDomain') || `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: urlParams.get('storageBucket') || `${projectId}.appspot.com`,
        messagingSenderId: urlParams.get('messagingSenderId') || '',
        appId: urlParams.get('appId') || '',
      };
    }
  } catch (e) {}
  return null;
}

const defaultConfig = {
  apiKey: "",
  authDomain: "viba-mart-f46a4.firebaseapp.com",
  projectId: "viba-mart-f46a4",
  storageBucket: "viba-mart-f46a4.appspot.com",
  messagingSenderId: "1083492847291",
  appId: "1:1083492847291:web:viba1234567890"
};

const firebaseConfig = getConfigFromUrl() || defaultConfig;

// Helper to construct rich notification payload
function buildNotificationOptions(payload) {
  const origin = self.location.origin || '';
  const defaultIcon = origin ? `${origin}/icon-192.png` : '/icon-192.png';
  const dataObj = payload.data || {};
  const notifObj = payload.notification || {};

  const title = notifObj.title || dataObj.title || 'ViBa Mart Alert';
  const body = notifObj.body || dataObj.message || dataObj.body || 'Check out latest deals on ViBa Mart!';
  const icon = dataObj.icon || notifObj.icon || defaultIcon;
  const badge = dataObj.badge || defaultIcon;
  const image = notifObj.image || notifObj.imageUrl || dataObj.image || undefined;
  const tag = dataObj.notificationId || dataObj.tag || `viba_push_${Date.now()}`;
  const destinationUrl = dataObj.destinationSlug || dataObj.url || notifObj.click_action || '/';

  return {
    title,
    options: {
      body,
      icon,
      badge,
      image,
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url: destinationUrl,
        destinationSlug: destinationUrl,
        orderId: dataObj.orderId,
        productId: dataObj.productId,
        campaignId: dataObj.campaignId,
        notificationId: dataObj.notificationId || tag,
        category: dataObj.category || 'offers',
      }
    }
  };
}

// In-memory set to prevent duplicate alerts if both Firebase SDK & push event trigger
const shownNotificationTags = new Set();

function displayNotification(title, options) {
  if (options.tag && shownNotificationTags.has(options.tag)) {
    return Promise.resolve();
  }
  if (options.tag) {
    shownNotificationTags.add(options.tag);
    setTimeout(() => shownNotificationTags.delete(options.tag), 10000);
  }
  return self.registration.showNotification(title, options);
}

// Initialize Firebase Messaging Background Handler
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[ViBa Mart SW] Received FCM background push message:', payload);
      const { title, options } = buildNotificationOptions(payload);
      return displayNotification(title, options);
    });
  }
} catch (err) {
  console.warn('[ViBa Mart SW] Firebase SW initialization fallback mode active:', err);
}

// Native Web Push Fallback Listener (Ensures delivery on all Mobile/Desktop browsers even if compat SDK is bypassed)
self.addEventListener('push', (event) => {
  console.log('[ViBa Mart SW] Native Push event received:', event);
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    try {
      payload = { notification: { body: event.data.text() } };
    } catch (textErr) {
      payload = {};
    }
  }

  const { title, options } = buildNotificationOptions(payload);
  event.waitUntil(displayNotification(title, options));
});

// Handle notification click event for seamless deep linking across Mobile and Desktop
self.addEventListener('notificationclick', (event) => {
  console.log('[ViBa Mart SW] Notification click received:', event);
  event.notification.close();

  const rawUrl = event.notification.data?.url || event.notification.data?.destinationSlug || '/';
  let targetUrl;
  try {
    targetUrl = new URL(rawUrl, self.location.origin).href;
  } catch (e) {
    targetUrl = self.location.origin || '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window tab is already open on the app, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (client.url && 'navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
