/**
 * Firebase Messaging Service Worker
 * Qatar Oasis - Admin Notifications
 * 
 * Features:
 * - Background push notifications (even when browser closed)
 * - System default notification sound (no custom audio needed)
 * - Vibration pattern support
 * - High priority for instant delivery
 */

// Import Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyA9sRFkHrqOlRkyMfzl4AyK618J12D_uk8",
  authDomain: "adminqatar-d4192.firebaseapp.com",
  projectId: "adminqatar-d4192",
  storageBucket: "adminqatar-d4192.firebasestorage.app",
  messagingSenderId: "927564639029",
  appId: "1:927564639029:web:025a0c2e77ce6bba367a7c"
});

// Set VAPID key for push notifications
const messaging = firebase.messaging();

// ==========================================
// BACKGROUND MESSAGE HANDLER - CRITICAL FOR WIX-LIKE NOTIFICATIONS
// ==========================================
messaging.onBackgroundMessage((payload) => {
  console.log('Background push message received:', payload);

  // Get notification data from payload
  const notificationType = payload.data?.type || 'general';
  const notificationTitle = payload.notification?.title || 'إشعار جديد';
  const notificationBody = payload.notification?.body || 'لديك إشعار من الموقع';

  // Determine urgency and vibration pattern
  const urgentTypes = ['payment', 'verification', 'emergency'];
  const isUrgent = urgentTypes.includes(notificationType);

  // Vibration pattern for Android devices
  const androidVibration = isUrgent 
    ? [0, 500, 200, 500, 200, 500]
    : [0, 250, 100, 250];

  // ==========================================
  // CRITICAL: Use system default sound for background notifications
  // This ensures sound plays even when browser is closed!
  // ==========================================
  const notificationOptions = {
    body: notificationBody,
    icon: '/admin/icon.png',
    badge: '/admin/badge.png',
    tag: notificationType,
    data: payload.data,
    requireInteraction: true,
    
    // CRITICAL: Use system default sound - plays even when browser closed!
    sound: 'default',
    silent: false,
    
    // Vibration patterns
    vibrate: androidVibration,
    
    // For Windows: use native notification
    dir: 'rtl',
    lang: 'ar',
    
    // Renotify for new notifications of same type
    renotify: true,
    
    // Actions
    actions: [
      { action: 'open', title: 'فتح لوحة التحكم' },
      { action: 'dismiss', title: 'تجاهل' }
    ]
  };

  console.log('Showing notification with system default sound...');
  
  // Show notification - system will play default sound automatically
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==========================================
// NOTIFICATION CLICK HANDLER
// ==========================================
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin/') && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: event.notification.data,
            action: event.action
          });
          return;
        }
      }
      if (clients.openWindow) {
        const urlToOpen = event.notification.data?.clickAction || '/admin/';
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('Firebase Messaging Service Worker loaded - Wix-like notifications ready');
