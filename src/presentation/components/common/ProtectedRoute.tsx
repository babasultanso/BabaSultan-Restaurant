import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoginPage } from '../auth/LoginPage';
import { LoadingSystem } from './LoadingSystem';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, userRecord } = useAuth();

  if (loading) {
    return <LoadingSystem />;
  }

  // Strictly enforce user authentication and user record authorization
  if (!user || !userRecord) {
    return <LoginPage />;
  }

  // Strictly enforce active user account status
  if (userRecord.status && userRecord.status !== 'active') {
    const statusError = userRecord.status === 'suspended'
      ? 'Account suspended. Please contact system management.'
      : userRecord.status === 'pending'
      ? 'Account pending approval. Please contact administrator.'
      : 'Account is inactive. Access denied.';
    return <LoginPage initialError={statusError} />;
  }

  return <>{children}</>;
};
