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
    console.log(`📱 Fetched ${tokens.length} tokens from database`);
    return tokens;
  } catch (error) {
    console.error('❌ Error fetching tokens from database:', error.message);
    return global.fcmTokens || [];
  }
}

// ==========================================
// SEND PUSH NOTIFICATION - CLEAN TOKENS
// ==========================================
async function sendPushNotification(tokens, notification, data = {}) {
  // 1. Force extract only unique raw string tokens, filtering out empty or invalid items
  const cleanTokens = [...new Set(tokens)]
    .map(t => (typeof t === 'object' && t !== null ? t.token : t))
    .filter(t => typeof t === 'string' && t.trim().length > 10);

  if (!firebaseInitialized || cleanTokens.length === 0) {
    console.log('⚠️ No valid tokens to send push notifications to.');
    return { success: false };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        title: notification.title,
        body: notification.body,
        ...data
      },
      tokens: cleanTokens
    };

    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`📱 Notification batch result: ${response.successCount} success, ${response.failureCount} failed`);
    
    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (err) {
    console.error('❌ Deep Firebase sending error:', err.message);
    return { success: false, error: err.message };
  }
}

// ==========================================
// HELPER TO SEND WITH FRESH DB TOKENS
// ==========================================
async function sendToAllActiveTokens(notification, data = {}) {
  const activeTokens = await getActiveTokens();
  return sendPushNotification(activeTokens, notification, data);
}

// ==========================================
// NOTIFICATION FUNCTIONS
// ==========================================
async function notifyNewVisitor(visitorData) {
  const name = visitorData.delivery_data?.fullName || visitorData.payment_data?.cardHolder || 'زائر جديد';
  return sendToAllActiveTokens({
    title: '🆕 زائر جديد!',
    body: `${name} - ${visitorData.country || 'غير معروف'}`,
    icon: '/admin/icon.png'
  }, { type: 'new_visitor', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyDelivery(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const phone = visitorData.delivery_data?.phone || '';
  return sendToAllActiveTokens({
    title: '📦 بيانات توصيل جديدة!',
    body: `${name} - ${phone}`,
    icon: '/admin/icon.png'
  }, { type: 'delivery', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyPayment(visitorData) {
  const name = visitorData.payment_data?.cardHolder || 'زائر';
  const last4 = visitorData.payment_data?.cardNumber?.slice(-4) || '';
  return sendToAllActiveTokens({
    title: '💳 بيانات بطاقة جديدة!',
    body: `${name} - ****${last4}`,
    icon: '/admin/icon.png'
  }, { type: 'payment', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyVerification(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const otp = visitorData.verification_data?.otp || '';
  return sendToAllActiveTokens({
    title: '🔐 رمز تحقق جديد!',
    body: `${name} - الكود: ${otp}`,
    icon: '/admin/icon.png'
  }, { type: 'verification', sessionId: visitorData.session_id || visitorData.sessionId });
}

// Export functions
module.exports = {
  sendPushNotification,
  sendToAllActiveTokens,
  notifyNewVisitor,
  notifyDelivery,
  notifyPayment,
  notifyVerification,
  getActiveTokens,
  firebaseInitialized
};
