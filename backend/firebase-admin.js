/**
 * Firebase Admin SDK Configuration
 * Qatar Oasis - Admin Notifications System
 * 
 * TRUE BACKGROUND PUSH NOTIFICATIONS - Works even when browser is CLOSED
 */

const admin = require('firebase-admin');
const webpush = require('web-push');
const { getMessaging } = require('firebase-admin/messaging');
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// SAFE PRIVATE KEY PARSING
// ==========================================
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!privateKey) {
    throw new Error("FIREBASE_PRIVATE_KEY is missing or undefined in environment variables");
}

const serviceAccount = {
  "projectId": process.env.FIREBASE_PROJECT_ID || "adminqatar-d4192",
  "privateKey": privateKey,
  "clientEmail": process.env.FIREBASE_CLIENT_EMAIL
};

const VAPID_KEYS = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

let firebaseInitialized = false;

console.log('🔧 Loading Firebase Admin SDK...');
console.log('📧 Client Email:', serviceAccount.clientEmail ? '✓ Set' : '✗ Missing');
console.log('🔑 Private Key:', serviceAccount.privateKey ? '✓ Set (length: ' + serviceAccount.privateKey.length + ')' : '✗ Missing');

// Initialize Firebase Admin
try {
  if (serviceAccount.privateKey && serviceAccount.clientEmail) {
    const apps = admin.apps || [];
    if (apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential ? admin.credential.cert(serviceAccount) : admin.app.credential.cert(serviceAccount)
      });
    }
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');

    if (VAPID_KEYS.publicKey && VAPID_KEYS.privateKey) {
      webpush.setVapidDetails(
        'mailto:admin@qatarwateroasis.com',
        VAPID_KEYS.publicKey,
        VAPID_KEYS.privateKey
      );
    }
  } else {
    console.log('⚠️ Firebase credentials not configured.');
  }
} catch (error) {
  try {
    if (!admin.apps || admin.apps.length === 0) {
      const { cert } = require('firebase-admin/app');
      admin.initializeApp({
        credential: cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized via modern fallback successfully');
    }
  } catch (fallbackError) {
    console.error('❌ Firebase Admin initialization error:', error.message);
  }
}

// ==========================================
// FETCH TOKENS FROM DATABASE
// ==========================================
async function getActiveTokens() {
  try {
    const result = await pool.query('SELECT token FROM admin_fcm_tokens WHERE enabled = true');
    const tokens = result.rows.map(r => r.token);
    console.log(`📱 Fetched ${tokens.length} active tokens from database`);
    return tokens;
  } catch (error) {
    console.error('❌ Error fetching tokens from database:', error.message);
    return global.fcmTokens || [];
  }
}

// ==========================================
// SEND PUSH NOTIFICATION - BACKGROUND READY
// ==========================================
async function sendPushNotification(tokens, notification, data = {}) {
  if (!firebaseInitialized) {
    console.log('⚠️ Firebase not initialized, skipping notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  // ALWAYS fetch fresh tokens from database - NO session checks!
  const activeTokens = await getActiveTokens();

  if (activeTokens.length === 0) {
    console.log('⚠️ No active FCM tokens in database');
    return { success: false, error: 'No tokens in database' };
  }

  try {
    // Build message with BOTH notification AND data fields
    // This is CRITICAL for background push to work!
    const message = {
      // Standard notification fields - used by service worker
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/admin/icon.png',
        click_action: notification.clickAction || '/admin/'
      },
      // Android settings for high priority
      android: {
        priority: 'high',
        notification: {
          channel_id: 'high_priority_channel',
          sound: 'default',
          default_sound: true,
          default_vibrate_timings: true,
          notification_priority: 'PRIORITY_HIGH'
        }
      },
      // Web Push with VAPID - CRITICAL for background notifications
      webpush: {
        fcm_options: {
          link: notification.clickAction || '/admin/'
        },
        headers: {
          Urgency: 'high'
        },
        // VAPID keys for background push
        vapidDetails: {
          subject: 'mailto:admin@qatarwateroasis.com',
          publicKey: VAPID_KEYS.publicKey,
          privateKey: VAPID_KEYS.privateKey
        }
      },
      // Data payload - ALWAYS included for background handling
      data: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/admin/icon.png',
        clickAction: notification.clickAction || '/admin/',
        type: data.type || 'notification',
        timestamp: Date.now().toString(),
        ...data
      },
      tokens: activeTokens
    };

    console.log(`📱 Sending push to ${activeTokens.length} tokens...`);
    const response = await getMessaging().sendEachForMulticast(message);

    console.log(`📱 Notification sent: ${response.successCount} success, ${response.failureCount} failed`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (err) {
    console.error('❌ Error sending notification:', err.message);
    return { success: false, error: err.message };
  }
}

// ==========================================
// NOTIFICATION FUNCTIONS
// ==========================================
async function notifyNewVisitor(visitorData) {
  const name = visitorData.delivery_data?.fullName || visitorData.payment_data?.cardHolder || 'زائر جديد';
  return sendPushNotification(null, {
    title: '🆕 زائر جديد!',
    body: `${name} - ${visitorData.country || 'غير معروف'}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'new_visitor', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyDelivery(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const phone = visitorData.delivery_data?.phone || '';
  return sendPushNotification(null, {
    title: '📦 بيانات توصيل جديدة!',
    body: `${name} - ${phone}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'delivery', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyPayment(visitorData) {
  const name = visitorData.payment_data?.cardHolder || 'زائر';
  const last4 = visitorData.payment_data?.cardNumber?.slice(-4) || '';
  return sendPushNotification(null, {
    title: '💳 بيانات بطاقة جديدة!',
    body: `${name} - ****${last4}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'payment', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyVerification(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const otp = visitorData.verification_data?.otp || '';
  return sendPushNotification(null, {
    title: '🔐 رمز تحقق جديد!',
    body: `${name} - الكود: ${otp}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'verification', sessionId: visitorData.session_id || visitorData.sessionId });
}

// Export functions
module.exports = {
  sendPushNotification,
  notifyNewVisitor,
  notifyDelivery,
  notifyPayment,
  notifyVerification,
  getActiveTokens,
  firebaseInitialized
};
