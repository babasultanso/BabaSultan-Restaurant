import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updatePassword,
  sendEmailVerification,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, COLLECTIONS, logActivityFirestore, upsertUserRecordFirestore } from '../../lib/firebase';
import { UserRole, ROLE_PERMISSIONS, RolePermission, SupportedLanguage, LANGUAGES } from '../../constants';
import { translations, TranslationDictionary } from '../../i18n/translations';
import { UserRecord, ActivityLog } from '../../types';
import { logger } from '../../infrastructure/logging/logger';

interface AuthContextType {
  user: User | null;
  userRecord: UserRecord | null;
  role: UserRole;
  language: SupportedLanguage;
  dir: 'ltr' | 'rtl';
  themeMode: 'dark' | 'light';
  permissions: RolePermission;
  t: TranslationDictionary;
  loading: boolean;
  rememberMe: boolean;
  setRememberMe: (remember: boolean) => void;
  sessionStartTime: Date | null;
  lastActivityTime: Date | null;
  loginWithEmail: (email: string, pass: string, remember?: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  updateProfileDetails: (displayName: string, photoURL?: string) => Promise<void>;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleTheme: () => void;
  refreshUserRecord: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [role, setRole] = useState<UserRole>('Cashier');
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    return (localStorage.getItem('app_language') as SupportedLanguage) || 'ar';
  });
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [loading, setLoading] = useState<boolean>(true);
  const [rememberMe, setRememberMeState] = useState<boolean>(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(null);

  const langObj = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
  const dir = langObj.dir as 'ltr' | 'rtl';

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', language);
  }, [dir, language]);

  // Track activity timestamp for session management
  useEffect(() => {
    const handleActivity = () => {
      setLastActivityTime(new Date());
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  const fetchAndAuthorizeUserRecord = async (firebaseUser: User): Promise<UserRecord> => {
    const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      await signOut(auth);
      setUser(null);
      setUserRecord(null);
      const errMsg = language === 'ar'
        ? `تم رفض الوصول: لا يوجد ملف مستخدم مخصص لهذا الحساب (${firebaseUser.email || firebaseUser.uid}). يرجى مراجعة مسؤول النظام.`
        : `Access Denied: No provisioned user profile found for account (${firebaseUser.email || firebaseUser.uid}). Contact system administrator.`;
      logger.warn(`Unauthorized login attempt without Firestore profile: ${firebaseUser.email}`, 'AuthContext');
      throw new Error(errMsg);
    }

    const data = snap.data() as UserRecord;

    if (!data.role) {
      await signOut(auth);
      setUser(null);
      setUserRecord(null);
      const errMsg = language === 'ar'
        ? 'تم رفض الوصول: لم يتم تعيين دور وظيفي لهذا الحساب.'
        : 'Access Denied: No functional role assigned to this account.';
      throw new Error(errMsg);
    }

    if (data.status && data.status !== 'active') {
      await signOut(auth);
      setUser(null);
      setUserRecord(null);
      const errMsg = language === 'ar'
        ? `تم رفض الوصول: حالة الحساب (${data.status}). الحساب معلق أو معطل.`
        : `Access Denied: Account status is ${data.status}. Access is suspended.`;
      throw new Error(errMsg);
    }

    const isOwnerOrAdmin = data.role === 'Owner' || data.role === 'Admin';
    const resolvedBranchId = data.branchId || (typeof data.branch === 'string' && (data.branch.startsWith('branch_') || data.branch.startsWith('main_branch_')) ? data.branch : (isOwnerOrAdmin ? 'all' : ''));

    if (!isOwnerOrAdmin && !resolvedBranchId) {
      await signOut(auth);
      setUser(null);
      setUserRecord(null);
      const errMsg = language === 'ar'
        ? 'تم رفض الوصول: لا يوجد فرع مخصص لهذا الحساب. يرجى مراجعة مسؤول النظام.'
        : 'Access Denied: No operational branch assigned to this account. Contact system administrator.';
      throw new Error(errMsg);
    }

    const updatedRecord: UserRecord = {
      ...data,
      branchId: resolvedBranchId,
      lastLoginAt: new Date().toISOString(),
      emailVerified: firebaseUser.emailVerified
    };

    await setDoc(userDocRef, {
      branchId: resolvedBranchId,
      lastLoginAt: updatedRecord.lastLoginAt,
      emailVerified: firebaseUser.emailVerified
    }, { merge: true });

    setUserRecord(updatedRecord);
    setRole(updatedRecord.role);
    return updatedRecord;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        if (firebaseUser.isAnonymous) {
          setUserRecord(null);
          setSessionStartTime(null);
          setLoading(false);
          return;
        }
        setSessionStartTime(new Date());
        setLastActivityTime(new Date());
        try {
          await fetchAndAuthorizeUserRecord(firebaseUser);
          logger.info(`User session active: ${firebaseUser.email || firebaseUser.uid}`, 'AuthContext');
        } catch (err: any) {
          logger.error('Authentication verification failed', 'AuthContext', err);
          setUser(null);
          setUserRecord(null);
        }
      } else {
        setUserRecord(null);
        setSessionStartTime(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshUserRecord = async () => {
    if (user) {
      await fetchAndAuthorizeUserRecord(user);
    }
  };

  const setRememberMe = (remember: boolean) => {
    setRememberMeState(remember);
  };

  const loginWithEmail = async (email: string, pass: string, remember: boolean = true) => {
    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const rec = await fetchAndAuthorizeUserRecord(cred.user);
      await logActivityFirestore({
        userId: cred.user.uid,
        userEmail: cred.user.email || email,
        userName: rec.displayName,
        userRole: rec.role,
        action: 'LOGIN',
        details: 'Signed in via Email & Password'
      });
      logger.info(`Email login successful: ${email}`, 'AuthContext');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        logger.warn(`Email login attempt failed (invalid credentials) for ${email}`, 'AuthContext');
      } else {
        logger.error('Email login failed', 'AuthContext', err);
      }
      let userFriendlyMessage = err.message;
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        userFriendlyMessage = language === 'ar' 
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.'
          : language === 'so'
          ? 'Email-ka ama furaha sirta ah waa ma saneeyn. Fadlan hubi oo dib u isku day.'
          : 'Invalid email or password. Please check your credentials and try again.';
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyMessage = language === 'ar'
          ? 'صيغة البريد الإلكتروني غير صحيحة.'
          : 'Invalid email address format.';
      } else if (err.code === 'auth/too-many-requests') {
        userFriendlyMessage = language === 'ar'
          ? 'تم حظر المحاولة مؤقتاً بسبب كثرة المحاولات الفاشلة. يرجى المحاولة لاحقاً.'
          : 'Access temporarily disabled due to many failed login attempts.';
      } else if (err.code === 'auth/network-request-failed') {
        userFriendlyMessage = language === 'ar'
          ? 'تعذر الاتصال بخادم المصادقة. يرجى التحقق من اتصال الإنترنت.'
          : language === 'so'
          ? 'Xiriirinta server-ka ayaa guuldareysatay. Fadlan hubi internet-kaaga.'
          : 'Network connection error while communicating with authentication service. Please check your internet connection.';
      }
      throw new Error(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const rec = await fetchAndAuthorizeUserRecord(cred.user);
      await logActivityFirestore({
        userId: cred.user.uid,
        userEmail: cred.user.email || 'google-user@internal',
        userName: rec.displayName,
        userRole: rec.role,
        action: 'LOGIN',
        details: 'Signed in via Google OAuth'
      });
      logger.info(`Google login successful: ${cred.user.email}`, 'AuthContext');
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        logger.warn('Google login unauthorized domain error', 'AuthContext');
        const userFriendlyMessage = language === 'ar'
          ? 'نطاق هذا الموقع غير مصرح به في حساب Firebase لتسجيل الدخول بـ Google. يرجى استخدام البريد الإلكتروني وكلمة المرور.'
          : language === 'so'
          ? 'Shabadani looma ogola Google Sign-in. Fadlan adeegso Email iyo Password.'
          : 'Domain unauthorized for Google Sign-in in Firebase. Please log in using Email & Password.';
        throw new Error(userFriendlyMessage);
      }
      logger.error('Google login failed', 'AuthContext', err);
      let userFriendlyMessage = err.message || 'Google sign-in failed.';
      if (err.code === 'auth/popup-closed-by-user') {
        userFriendlyMessage = language === 'ar'
          ? 'تم إغلاق نافذة تسجيل الدخول من قبل المستخدم.'
          : 'Login popup was closed before completing authentication.';
      } else if (err.code === 'auth/network-request-failed') {
        userFriendlyMessage = language === 'ar'
          ? 'تعذر الاتصال بخادم المصادقة. يرجى التحقق من اتصال الإنترنت.'
          : 'Network error during Google login. Please check your connection.';
      }
      throw new Error(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user && userRecord) {
        await logActivityFirestore({
          userId: user.uid,
          userEmail: user.email || 'user@internal',
          userName: userRecord.displayName,
          userRole: role,
          action: 'LOGOUT',
          details: 'User logged out'
        });
      }
      await signOut(auth);
      setUser(null);
      setUserRecord(null);
      setSessionStartTime(null);
      logger.info('User logged out', 'AuthContext');
    } catch (err) {
      logger.error('Logout error', 'AuthContext', err);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
    if (user) {
      await logActivityFirestore({
        userId: user.uid,
        userEmail: email,
        userName: userRecord?.displayName || 'User',
        userRole: role,
        action: 'FORGOT_PASSWORD',
        details: `Password reset link sent to ${email}`
      });
    }
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user || !user.email) throw new Error('No authenticated user found');
    const credential = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPass);
    await logActivityFirestore({
      userId: user.uid,
      userEmail: user.email,
      userName: userRecord?.displayName || 'User',
      userRole: role,
      action: 'CHANGE_PASSWORD',
      details: 'Password updated successfully'
    });
  };

  const sendVerificationEmail = async () => {
    if (!user) throw new Error('No user logged in');
    await sendEmailVerification(user);
    await logActivityFirestore({
      userId: user.uid,
      userEmail: user.email || '',
      userName: userRecord?.displayName || 'User',
      userRole: role,
      action: 'SEND_EMAIL_VERIFICATION',
      details: 'Verification email sent'
    });
  };

  const updateProfileDetails = async (displayName: string, photoURL?: string) => {
    if (!user) throw new Error('No user logged in');
    await updateProfile(user, { displayName, photoURL });
    const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(userDocRef, { displayName, photoURL }, { merge: true });
    setUserRecord(prev => prev ? { ...prev, displayName, photoURL } : null);
    await logActivityFirestore({
      userId: user.uid,
      userEmail: user.email || '',
      userName: displayName,
      userRole: role,
      action: 'UPDATE_PROFILE',
      details: 'Profile details updated'
    });
  };

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
    logger.info(`Language updated to: ${lang}`, 'AuthContext');
  };

  const toggleTheme = () => {
    setThemeMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const permissions = ROLE_PERMISSIONS[role];
  const t = translations[language];

  return (
    <AuthContext.Provider
      value={{
        user,
        userRecord,
        role,
        language,
        dir,
        themeMode,
        permissions,
        t,
        loading,
        rememberMe,
        setRememberMe,
        sessionStartTime,
        lastActivityTime,
        loginWithEmail,
        loginWithGoogle,
        logout,
        sendPasswordReset,
        changePassword,
        sendVerificationEmail,
        updateProfileDetails,
        setLanguage,
        toggleTheme,
        refreshUserRecord
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
