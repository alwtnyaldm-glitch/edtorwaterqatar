/**
 * Firebase Messaging Service Worker
 * Qatar Oasis - Admin Notifications
 * 
 * Features:
 * - Background push notifications (even when browser closed)
 * - Web Audio API for programmatic sound notification
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

// Set VAPID key for push notifications
const messaging = firebase.messaging();

// ==========================================
// WEB AUDIO API - Generate notification sound programmatically
// ==========================================
async function playNotificationSound() {
  try {
    // Create AudioContext in Service Worker
    const audioCtx = new (self.AudioContext || self.webkitAudioContext)();
    
    // Create notification sound pattern (pleasant bell-like tone)
    const playTone = (freq, startTime, duration, volume = 0.3) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);
      
      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = audioCtx.currentTime;
    
    // Play 3-tone notification sequence (like a doorbell)
    playTone(880, now, 0.15, 0.4);        // A5 note
    playTone(1047, now + 0.18, 0.15, 0.4); // C6 note
    playTone(1319, now + 0.36, 0.25, 0.5); // E6 note
    
    console.log('Notification sound played via Web Audio API');
    
    // Close context after sound completes
    setTimeout(() => audioCtx.close(), 1000);
    
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

// ==========================================
// BACKGROUND MESSAGE HANDLER
// ==========================================
messaging.onBackgroundMessage((payload) => {
  console.log('Background push message received:', payload);

  // Determine notification type for sound/vibration
  const notificationType = payload.data?.type || 'general';
  
  // Set urgency level based on type
  const urgentTypes = ['payment', 'verification', 'emergency'];
  const isUrgent = urgentTypes.includes(notificationType);
  
  // Select appropriate icon based on type
  const getTypeConfig = (type) => {
    switch(type) {
      case 'payment': return { icon: '1f4b3', priority: 'high' };
      case 'delivery': return { icon: '1f4e6', priority: 'default' };
      case 'verification': return { icon: '1f510', priority: 'high' };
      case 'new_visitor': return { icon: '1f193', priority: 'default' };
      case 'new_product': return { icon: '1f4e6', priority: 'default' };
      default: return { icon: '1f514', priority: 'default' };
    }
  };

  const typeConfig = getTypeConfig(notificationType);
  const notificationTitle = payload.notification?.title || 'Notification from Qatar Oasis';
  const notificationBody = payload.notification?.body || 'You have a new notification';

  // Vibration pattern
  const vibration = isUrgent ? [300, 100, 300, 100, 300] : [200, 100, 200];

  const notificationOptions = {
    body: notificationBody,
    icon: '/admin/icon.png',
    badge: '/admin/badge.png',
    tag: notificationType,
    data: payload.data,
    requireInteraction: true,
    vibrate: vibration,
    dir: 'rtl',
    lang: 'ar',
    renotify: true,
    silent: false,
    actions: [
      { action: 'open', title: 'Open Dashboard' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  // Play custom sound AND show notification
  playNotificationSound();
  
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

// ==========================================
// MESSAGE HANDLER
// ==========================================
self.addEventListener('message', (event) => {
  console.log('SW Message received:', event.data);
  
  if (event.data && event.data.type === 'PLAY_SOUND') {
    playNotificationSound();
  }
});

console.log('Firebase Messaging Service Worker loaded');
