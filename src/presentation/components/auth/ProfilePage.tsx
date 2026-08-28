import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../lib/firebase';
import { ActivityLog } from '../../../types';
import { Shield, UserCheck, Mail, Key, CheckCircle2, AlertTriangle, Send, RefreshCw, Clock, Building, Lock } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const {
    user,
    userRecord,
    role,
    t,
    sendVerificationEmail,
    changePassword,
    updateProfileDetails,
    sessionStartTime,
    lastActivityTime
  } = useAuth();

  const [displayName, setDisplayName] = useState(userRecord?.displayName || user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(userRecord?.photoURL || user?.photoURL || '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [changingPass, setChangingPass] = useState(false);

  const [verificationSent, setVerificationSent] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const [userLogs, setUserLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (userRecord) {
      setDisplayName(userRecord.displayName);
      if (userRecord.photoURL) setPhotoURL(userRecord.photoURL);
    }
  }, [userRecord]);

  // Load activity logs for current user
  useEffect(() => {
    if (!user) return;
    try {
      const q = query(
        collection(db, COLLECTIONS.ACTIVITY_LOGS),
        where('userId', '==', user.uid),
        limit(15)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setUserLogs(logs);
      }, (err) => {
        console.warn('Could not subscribe to activity logs:', err);
      });
      return () => unsub();
    } catch (e) {
      console.warn('Activity log listener error:', e);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);
    setUpdatingProfile(true);
    try {
      await updateProfileDetails(displayName, photoURL || undefined);
      setProfileMsg(t.profile.profileUpdated);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    setPassError(null);
    if (newPassword !== confirmPassword) {
      setPassError(t.profile.passwordMismatch);
      return;
    }
    if (newPassword.length < 6) {
      setPassError('Password must be at least 6 characters long.');
      return;
    }
    setChangingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPassMsg(t.profile.passwordUpdated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setChangingPass(false);
    }
  };

  const handleSendVerification = async () => {
    setVerifyingEmail(true);
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (err: any) {
      alert(err.message || 'Failed to send verification email');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const sessionMinutes = sessionStartTime
    ? Math.floor((Date.now() - sessionStartTime.getTime()) / 60000)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-black shadow-lg shadow-emerald-950/30">
            {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>{displayName || 'Enterprise User'}</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                {t.roles[role as keyof typeof t.roles] || role}
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{user?.email || 'user@restaurant-erp.internal'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 px-4 py-2.5 rounded-2xl">
          <Clock className="w-4 h-4 text-emerald-400" />
          <div className="text-left">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              {t.auth.sessionActive}
            </p>
            <p className="text-xs font-semibold text-white">
              {sessionMinutes} mins logged in
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Profile Details & Password Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Profile Form */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">{t.profile.personalDetails}</h2>
            </div>

            {profileMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
                {profileMsg}
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.profile.displayName}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.profile.email}
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.profile.role}
                  </label>
                  <input
                    type="text"
                    value={role}
                    disabled
                    className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-emerald-400 font-semibold capitalize cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.profile.branch}
                  </label>
                  <input
                    type="text"
                    value={userRecord?.branch || 'Main Flagship Branch'}
                    disabled
                    className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {updatingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : t.profile.updateProfileBtn}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">{t.profile.changePassword}</h2>
            </div>

            {passMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
                {passMsg}
              </div>
            )}
            {passError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
                {passError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.profile.currentPassword}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.profile.newPassword}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.profile.confirmNewPassword}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={changingPass}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {changingPass ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : t.profile.updatePasswordBtn}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column: Email Verification & Activity Logs */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Email Verification Card */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Mail className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">{t.profile.emailVerification}</h2>
            </div>

            {user?.emailVerified ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">{t.profile.emailVerified}</p>
                  <p className="text-[10px] text-slate-400">Your email address is verified and active.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-400">{t.profile.emailNotVerified}</p>
                    <p className="text-[10px] text-slate-400">Please verify your email address to ensure full account protection.</p>
                  </div>
                </div>

                {verificationSent ? (
                  <p className="text-xs text-emerald-400 font-semibold">{t.profile.verificationSent}</p>
                ) : (
                  <button
                    onClick={handleSendVerification}
                    disabled={verifyingEmail}
                    className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {verifyingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{t.profile.sendVerificationLink}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Activity Log Card */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">{t.profile.recentActivity}</h2>
            </div>

            {userLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">{t.activityLogs.noLogs}</p>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {userLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {log.action}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{log.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
