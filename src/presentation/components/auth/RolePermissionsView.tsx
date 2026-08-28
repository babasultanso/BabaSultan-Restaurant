import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_PERMISSIONS, UserRole } from '../../../constants';
import { ShieldCheck, Check, X, Lock } from 'lucide-react';

export const RolePermissionsView: React.FC = () => {
  const { t } = useAuth();

  const capabilities: { key: keyof typeof ROLE_PERMISSIONS['Owner']; label: string }[] = [
    { key: 'canAccessAdminPanel', label: t.rolePermissions.adminPanel },
    { key: 'canAccessPOS', label: t.rolePermissions.posTerminal },
    { key: 'canAccessKitchen', label: t.rolePermissions.kitchenDisplay },
    { key: 'canAccessInventory', label: t.rolePermissions.rawInventory },
    { key: 'canAccessFinancials', label: t.rolePermissions.financialLedger },
    { key: 'canAccessStaff', label: t.rolePermissions.staffManagement },
    { key: 'canAccessReports', label: t.rolePermissions.auditReports },
    { key: 'canAccessAIAdvisor', label: t.rolePermissions.aiFinancialAdvisor },
    { key: 'canManageBranchSettings', label: t.rolePermissions.manageBranchSettings },
    { key: 'canManageUsers', label: t.rolePermissions.manageUserAccounts }
  ];

  const rolesList: UserRole[] = Object.values(USER_ROLES);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>{t.rolePermissions.title}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">{t.rolePermissions.subtitle}</p>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-4 bg-slate-950 sticky left-0 z-10">{t.rolePermissions.capability}</th>
                {rolesList.map((r) => (
                  <th key={r} className="p-4 text-center min-w-[100px]">
                    <span className="text-emerald-400 font-bold block">
                      {t.roles[r as keyof typeof t.roles] || r}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {capabilities.map((cap) => (
                <tr key={cap.key} className="hover:bg-slate-800/30 transition">
                  <td className="p-4 font-semibold text-white bg-slate-900/90 sticky left-0 z-10 border-r border-slate-800/80">
                    {cap.label}
                  </td>
                  {rolesList.map((r) => {
                    const isAllowed = ROLE_PERMISSIONS[r][cap.key];
                    return (
                      <td key={r} className="p-4 text-center">
                        {isAllowed ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-800/60 border border-slate-800 text-slate-600 flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
