import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '../../lib/firebase';
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { UserProfile, UserRole } from '../../domain/entities/user';

export class AuthRepositoryImpl implements IAuthRepository {
  async getCurrentUser(): Promise<UserProfile | null> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return null;
    }

    const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // User profile must be explicitly provisioned in Firestore by administrator
      return null;
    }

    const data = snap.data() as UserProfile;
    if (!data.role) {
      return null;
    }

    if (data.status && data.status !== 'active') {
      return null;
    }

    return data;
  }

  async loginWithGoogle(): Promise<UserProfile> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const u = result.user;

    const userRef = doc(db, COLLECTIONS.USERS, u.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await signOut(auth);
      throw new Error('Access Denied: No provisioned user profile found in Firestore for this account. Contact your administrator to create your profile.');
    }

    const profile = snap.data() as UserProfile;
    if (!profile.role) {
      await signOut(auth);
      throw new Error('Access Denied: User role is missing. Contact your administrator.');
    }

    if (profile.status && profile.status !== 'active') {
      await signOut(auth);
      throw new Error('Access Denied: Account status is suspended or inactive. Contact your administrator.');
    }

    return profile;
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, { role });
  }
}


