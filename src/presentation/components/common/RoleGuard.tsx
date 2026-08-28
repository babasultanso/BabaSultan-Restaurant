import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { RolePermission } from '../../../constants';
import { ErrorPage } from './ErrorPage';

interface RoleGuardProps {
  permissionKey: keyof RolePermission;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ permissionKey, children }) => {
  const { permissions, t } = useAuth();

  if (!permissions[permissionKey]) {
    return (
      <ErrorPage
        title={t.messages.accessDenied}
        description={t.messages.accessDeniedDesc}
      />
    );
  }

  return <>{children}</>;
};
