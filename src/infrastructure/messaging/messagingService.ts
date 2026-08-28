import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../../firebase-applet-config.json';
import { logger } from '../logging/logger';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export class MessagingService {
  private static messaging: ReturnType<typeof getMessaging> | null = null;

  static initialize(): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        this.messaging = getMessaging(app);
        logger.info('Firebase Cloud Messaging initialized', 'MessagingService');
      } catch (err) {
        logger.warn('FCM non-supported in this browser environment', 'MessagingService', err);
      }
    }
  }

  static async requestNotificationPermission(): Promise<string | null> {
    if (!this.messaging) this.initialize();
    if (!this.messaging) return null;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;
        const token = await getToken(this.messaging, { vapidKey });
        logger.info('FCM Token generated successfully', 'MessagingService', { token });
        return token;
      }
    } catch (err) {
      logger.error('Failed to request notification permission / token', 'MessagingService', err);
    }
    return null;
  }

  static onForegroundMessage(callback: (payload: any) => void): void {
    if (!this.messaging) this.initialize();
    if (this.messaging) {
      onMessage(this.messaging, (payload) => {
        logger.info('Foreground FCM message received', 'MessagingService', payload);
        callback(payload);
      });
    }
  }
}
