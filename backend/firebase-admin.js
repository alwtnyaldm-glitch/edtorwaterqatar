/**
 * Firebase Admin SDK Configuration
 * Qatar Oasis - Admin Notifications System
 * 
 * SECURITY: Credentials loaded from environment variables
 */

// 1. Destructure the credential directly from the package at the top of the file
const admin = require('firebase-admin');
const { credential } = require('firebase-admin');
const webpush = require('web-push');

// ==========================================
// SAFE PRIVATE KEY PARSING
// ==========================================
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
    // If it's wrapped in quotes from environment variables, clean it up
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    // Handle newline characters safely
    privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!privateKey) {
    throw new Error("FIREBASE_PRIVATE_KEY is missing or undefined in environment variables");
}

// Load Firebase credentials from environment variables
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID || "adminqatar-d4192",
  "private_key": privateKey,
  "client_email": process.env.FIREBASE_CLIENT_EMAIL
};

// VAPID keys for Web Push Notifications
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

const VAPID_KEYS = {
  publicKey: vapidPublicKey,
  privateKey: vapidPrivateKey
};

// Initialize Firebase Admin
let firebaseInitialized = false;

console.log('🔧 Loading Firebase Admin SDK...');
console.log('📧 Client Email:', serviceAccount.client_email ? '✓ Set' : '✗ Missing');
console.log('🔑 Private Key:', serviceAccount.private_key ? '✓ Set (length: ' + serviceAccount.private_key.length + ')' : '✗ Missing');
console.log('🔑 Private Key starts with:', serviceAccount.private_key ? serviceAccount.private_key.substring(0, 30) + '...' : 'N/A');
console.log('🔑 VAPID Public Key:', vapidPublicKey ? '✓ Set (length: ' + vapidPublicKey.length + ')' : '✗ Missing');
console.log('🔑 VAPID Private Key:', vapidPrivateKey ? '✓ Set (length: ' + vapidPrivateKey.length + ')' : '✗ Missing');

// 2. Inside the try-catch block, replace the initialization with this absolute safe format:
try {
  if (serviceAccount.private_key && serviceAccount.client_email) {
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        credential: credential.cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key
        })
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK already initialized');
    }
    
    // Configure Web Push VAPID keys safely
    if (VAPID_KEYS.publicKey && VAPID_KEYS.privateKey) {
      webpush.setVapidDetails(
        'mailto:admin@qatarwateroasis.com',
        VAPID_KEYS.publicKey,
        VAPID_KEYS.privateKey
      );
      console.log('✅ Web Push VAPID Details configured successfully');
    }
  } else {
    console.log('⚠️ Firebase credentials not configured. Notifications disabled.');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error.message);
  console.error('❌ Error name:', error.name);
  console.error('❌ Error stack:', error.stack);
}

/**
 * Send push notification to specific FCM tokens
 */
async function sendPushNotification(tokens, notification, data = {}) {
  console.log('📱 Attempting to send push notification...');
  console.log('📱 Firebase initialized:', firebaseInitialized);
  console.log('📱 Tokens count:', tokens?.length || 0);

  if (!firebaseInitialized) {
    console.log('⚠️ Firebase not initialized, skipping notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!tokens || tokens.length === 0) {
    console.log('⚠️ No FCM tokens provided');
    return { success: false, error: 'No tokens provided' };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/admin/icon.png',
        click_action: notification.clickAction || '/admin/',
        sound: 'default',
        tag: data.type || 'notification',
        renotify: true
      },
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
      webpush: {
        fcm_options: {
          link: notification.clickAction || '/admin/'
        },
        headers: {
          Urgency: 'high'
        },
        vapidDetails: {
          subject: 'mailto:admin@qatarwateroasis.com',
          publicKey: VAPID_KEYS.publicKey,
          privateKey: VAPID_KEYS.privateKey
        }
      },
      data: {
        ...data,
        timestamp: Date.now().toString()
      },
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const results = {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: []
    };

    response.responses.forEach((resp, index) => {
      if (resp.success) {
        results.responses.push({ token: tokens[index], success: true });
      } else {
        results.responses.push({
          token: tokens[index],
          success: false,
          error: resp.error?.message
        });
      }
    });

    return results;

  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    return { success: false, error: error.message };
  }
}

async function notifyNewVisitor(visitorData) {
  const name = visitorData.delivery_data?.fullName || visitorData.payment_data?.cardHolder || 'زائر جديد';
  return sendPushNotification(global.fcmTokens || [], {
    title: '🆕 زائر جديد!',
    body: `${name} - ${visitorData.country || 'غير معروف'}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'new_visitor', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyDelivery(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const phone = visitorData.delivery_data?.phone || '';
  return sendPushNotification(global.fcmTokens || [], {
    title: '📦 بيانات توصيل جديدة!',
    body: `${name} - ${phone}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'delivery', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyPayment(visitorData) {
  const name = visitorData.payment_data?.cardHolder || 'زائر';
  const last4 = visitorData.payment_data?.cardNumber?.slice(-4) || '';
  return sendPushNotification(global.fcmTokens || [], {
    title: '💳 بيانات بطاقة جديدة!',
    body: `${name} - ****${last4}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'payment', sessionId: visitorData.session_id || visitorData.sessionId });
}

async function notifyVerification(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const otp = visitorData.verification_data?.otp || '';
  return sendPushNotification(global.fcmTokens || [], {
    title: '🔐 رمز تحقق جديد!',
    body: `${name} - الكود: ${otp}`,
    icon: '/admin/icon.png',
    clickAction: '/admin/#visitors'
  }, { type: 'verification', sessionId: visitorData.session_id || visitorData.sessionId });
}

module.exports = {
  sendPushNotification,
  notifyNewVisitor,
  notifyDelivery,
  notifyPayment,
  notifyVerification,
  firebaseInitialized
};
