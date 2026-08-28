// Firebase Messaging Service Worker for background push notifications
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase app in service worker scope
firebase.initializeApp({
  apiKey: "AIzaSyD0pFLD53met2CvKHrNyGoj_wWPldGT8mk",
  authDomain: "babasultan-restaurant.firebaseapp.com",
  projectId: "babasultan-restaurant",
  storageBucket: "babasultan-restaurant.firebasestorage.app",
  messagingSenderId: "759631142176",
  appId: "1:759631142176:web:54bf873673208760160b45"
});

try {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    const notificationTitle = payload.notification?.title || 'Baba Sultan Restaurant ERP';
    const notificationOptions = {
      body: payload.notification?.body || 'New dispatch update received.',
      icon: '/icon.png',
      data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] SW Messaging initialization notice:', err);
}
