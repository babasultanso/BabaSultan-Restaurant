import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../../firebase-applet-config.json';
import { logger } from '../logging/logger';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const storage = getStorage(app);

export class StorageService {
  /**
   * Upload file to Firebase Storage under path (e.g., 'dishes/dish1.jpg')
   */
  static async uploadFile(path: string, file: File): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      logger.info(`File uploaded successfully to path: ${path}`, 'StorageService', { url });
      return url;
    } catch (error: any) {
      logger.error(`Storage upload failed for path: ${path}`, 'StorageService', error);
      // Fallback data URL or local object URL if storage fails or quota exceeded
      return URL.createObjectURL(file);
    }
  }

  /**
   * Delete file from storage
   */
  static async deleteFile(path: string): Promise<void> {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      logger.info(`File deleted from path: ${path}`, 'StorageService');
    } catch (error: any) {
      logger.warn(`Could not delete file at path: ${path}`, 'StorageService', error);
    }
  }
}
