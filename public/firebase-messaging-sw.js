// Firebase Cloud Messaging Service Worker for ViBa Mart Push Notifications

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase App in Service Worker
const firebaseConfig = {
  apiKey: "AIzaSyDummyApiKeyForViBaMartConfig",
  authDomain: "viba-mart.firebaseapp.com",
  projectId: "viba-mart",
  storageBucket: "viba-mart.appspot.com",
  messagingSenderId: "1083492847291",
  appId: "1:1083492847291:web:viba1234567890"
};

try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[ViBa Mart SW] Received background push message: ', payload);

      const notificationTitle = payload.notification?.title || payload.data?.title || 'ViBa Mart Alert';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.message || 'Check out latest deals on ViBa Mart!',
        icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
        badge: '/favicon.ico',
        image: payload.notification?.image || payload.data?.image || undefined,
        tag: payload.data?.tag || 'viba-push-alert',
        data: {
          url: payload.data?.destinationSlug || payload.data?.url || '/',
          orderId: payload.data?.orderId,
          productId: payload.data?.productId,
          campaignId: payload.data?.campaignId,
        }
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (err) {
  console.warn('[ViBa Mart SW] Firebase SW initialization fallback mode active:', err);
}

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
          if (client.url) {
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
