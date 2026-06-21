/**
 * Firebase Messaging Service Worker
 * Qatar Oasis - Admin Notifications
 * 
 * Features:
 * - Raw push event listener (works even when browser is closed)
 * - System default notification sound
 * - Vibration pattern support
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

const messaging = firebase.messaging();

// ==========================================
// CRITICAL: Raw PUSH EVENT LISTENER
// This is what wakes up the Service Worker when OS sends push!
// Must return a Promise to keep SW alive until notification shows
// ==========================================
self.addEventListener('push', (event) => {
  console.log('Push event received (raw):', event);
  
  // Parse the push data
  let payload = null;
  try {
    if (event.data) {
      payload = event.data.json();
      console.log('Push payload parsed:', payload);
    }
  } catch (e) {
    console.error('Error parsing push data:', e);
  }
  
  // If Firebase Messaging parsed it, use onBackgroundMessage logic
  if (payload && payload.notification) {
    event.waitUntil(showNotificationFromPayload(payload));
  } else {
    // Fallback: show generic notification
    event.waitUntil(showGenericNotification());
  }
});

// Helper function to show notification from Firebase payload
async function showNotificationFromPayload(payload) {
  const notificationTitle = payload.notification?.title || 'إشعار جديد';
  const notificationBody = payload.notification?.body || 'لديك إشعار من الموقع';
  const notificationType = payload.data?.type || payload.notification?.tag || 'general';
  
  // Determine urgency
  const urgentTypes = ['payment', 'verification', 'emergency'];
  const isUrgent = urgentTypes.includes(notificationType);
  const androidVibration = isUrgent 
    ? [0, 500, 200, 500, 200, 500]
    : [0, 250, 100, 250];

  const options = {
    body: notificationBody,
    icon: '/admin/icon.png',
    badge: '/admin/badge.png',
    tag: notificationType,
    data: payload.data,
    requireInteraction: true,
    sound: 'default',
    silent: false,
    vibrate: androidVibration,
    dir: 'rtl',
    lang: 'ar',
    renotify: true,
    actions: [
      { action: 'open', title: 'فتح لوحة التحكم' },
      { action: 'dismiss', title: 'تجاهل' }
    ]
  };

  console.log('Showing notification from push:', notificationTitle);
  
  // CRITICAL: Return the promise from showNotification!
  return self.registration.showNotification(notificationTitle, options);
}

// Fallback generic notification
async function showGenericNotification() {
  const options = {
    body: 'لديك إشعار جديد من الموقع',
    icon: '/admin/icon.png',
    badge: '/admin/badge.png',
    tag: 'general',
    requireInteraction: true,
    sound: 'default',
    silent: false,
    vibrate: [0, 250, 100, 250],
    dir: 'rtl',
    lang: 'ar'
  };
  
  return self.registration.showNotification('إشعار جديد', options);
}

// ==========================================
// FIREBASE MESSAGING BACKGROUND HANDLER
// Additional handler for when Firebase SDK parses the push
// ==========================================
messaging.onBackgroundMessage((payload) => {
  console.log('Firebase onBackgroundMessage:', payload);
  
  const notificationType = payload.data?.type || 'general';
  const notificationTitle = payload.notification?.title || 'إشعار جديد';
  const notificationBody = payload.notification?.body || 'لديك إشعار من الموقع';
  
  const urgentTypes = ['payment', 'verification', 'emergency'];
  const isUrgent = urgentTypes.includes(notificationType);
  const androidVibration = isUrgent 
    ? [0, 500, 200, 500, 200, 500]
    : [0, 250, 100, 250];

  const options = {
    body: notificationBody,
    icon: '/admin/icon.png',
    badge: '/admin/badge.png',
    tag: notificationType,
    data: payload.data,
    requireInteraction: true,
    sound: 'default',
    silent: false,
    vibrate: androidVibration,
    dir: 'rtl',
    lang: 'ar',
    renotify: true,
    actions: [
      { action: 'open', title: 'فتح لوحة التحكم' },
      { action: 'dismiss', title: 'تجاهل' }
    ]
  };

  // CRITICAL: Return the promise!
  return self.registration.showNotification(notificationTitle, options);
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

// ==========================================
// SERVICE WORKER LIFECYCLE
// Keep SW alive for background sync
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

console.log('Firebase Messaging Service Worker loaded - Deep background notifications ready');
