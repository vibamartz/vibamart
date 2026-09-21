// Firebase Cloud Messaging Service Worker for ViBa Mart Push Notifications

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

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
  apiKey: "AIzaSyDummyApiKeyForViBaMartConfig",
  authDomain: "viba-mart-f46a4.firebaseapp.com",
  projectId: "viba-mart-f46a4",
  storageBucket: "viba-mart-f46a4.appspot.com",
  messagingSenderId: "1083492847291",
  appId: "1:1083492847291:web:viba1234567890"
};

const firebaseConfig = getConfigFromUrl() || defaultConfig;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[ViBa Mart SW] Received FCM background push message:', payload);

      const notificationTitle = payload.notification?.title || payload.data?.title || 'ViBa Mart Alert';
      const origin = self.location.origin || '';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.message || payload.data?.body || 'Check out latest deals on ViBa Mart!',
        icon: payload.notification?.icon || payload.data?.icon || (origin ? `${origin}/favicon.ico` : '/favicon.ico'),
        badge: origin ? `${origin}/favicon.ico` : '/favicon.ico',
        image: payload.notification?.image || payload.notification?.imageUrl || payload.data?.image || undefined,
        tag: payload.data?.tag || payload.data?.notificationId || 'viba-push-alert',
        renotify: true,
        requireInteraction: true,
        data: {
          url: payload.data?.destinationSlug || payload.data?.url || '/',
          orderId: payload.data?.orderId,
          productId: payload.data?.productId,
          campaignId: payload.data?.campaignId,
          notificationId: payload.data?.notificationId,
        }
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (err) {
  console.warn('[ViBa Mart SW] Firebase SW initialization fallback mode active:', err);
}

// Direct Service Worker Push Event Listener to guarantee mobile notification tray popups
self.addEventListener('push', (event) => {
  console.log('[ViBa Mart SW] Native Push event received in Service Worker');
  const origin = self.location.origin || '';

  let title = 'ViBa Mart Notification';
  let options = {
    body: 'Check out the latest deals & updates on ViBa Mart!',
    icon: origin ? `${origin}/favicon.ico` : '/favicon.ico',
    badge: origin ? `${origin}/favicon.ico` : '/favicon.ico',
    renotify: true,
    requireInteraction: true,
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[ViBa Mart SW] Push payload json:', payload);

      const notif = payload.notification || payload.data || {};
      if (notif.title || payload.title) title = notif.title || payload.title;
      if (notif.body || notif.message || payload.body) options.body = notif.body || notif.message || payload.body;
      if (notif.image || notif.imageUrl) options.image = notif.image || notif.imageUrl;
      if (notif.tag || notif.notificationId) options.tag = notif.tag || notif.notificationId;

      const destUrl = payload.data?.destinationSlug || payload.data?.url || payload.fcmOptions?.link || '/';
      options.data = { url: destUrl, ...payload.data };
    } catch (e) {
      try {
        const text = event.data.text();
        if (text) options.body = text;
      } catch (err) {}
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click event for deep linking
self.addEventListener('notificationclick', (event) => {
  console.log('[ViBa Mart SW] Notification click received:', event);
  event.notification.close();

  const destinationUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window tab is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (client.url && 'navigate' in client) {
            client.navigate(destinationUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(destinationUrl);
      }
    })
  );
});
