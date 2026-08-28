import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Customer } from '../../../domain/entities/customer';
import { CustomerListView } from './CustomerListView';
import { CustomerDetailsView } from './CustomerDetailsView';
import { LoyaltyProgramView } from './LoyaltyProgramView';
import { CouponsView } from './CouponsView';
import { CustomerWalletView } from './CustomerWalletView';
import { CRMAnalyticsView } from './CRMAnalyticsView';
import { CustomerMessagingModal } from './CustomerMessagingModal';
import {
  Users,
  Award,
  Tag,
  Wallet,
  BarChart3,
  HeartHandshake
} from 'lucide-react';

export const CustomerManagementView: React.FC = () => {
  const { t } = useAuth();
  const [activeTab, setActiveTab] = useState<'directory' | 'loyalty' | 'coupons' | 'wallets' | 'analytics'>('directory');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [walletModalCustomerId, setWalletModalCustomerId] = useState<string | null>(null);
  const [messagingCustomer, setMessagingCustomer] = useState<Customer | null>(null);

  // Handle switching to 360 profile
  if (selectedCustomer) {
    return (
      <CustomerDetailsView
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
        onOpenWalletModal={(id) => {
          setSelectedCustomer(null);
          setWalletModalCustomerId(id);
          setActiveTab('wallets');
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs Header */}
      <div className="bg-slate-900 border border-slate-800 p-2 rounded-3xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto p-1">
          {[
            { id: 'directory', label: t.crm?.customersList || 'Customer Directory', icon: Users },
            { id: 'loyalty', label: t.crm?.loyalty || 'Loyalty & Membership', icon: Award },
            { id: 'coupons', label: t.crm?.coupons || 'Promotional Coupons', icon: Tag },
            { id: 'wallets', label: t.crm?.wallet || 'Customer Wallets', icon: Wallet },
            { id: 'analytics', label: t.crm?.analytics || 'CRM Analytics', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Display */}
      <div>
        {activeTab === 'directory' && (
          <CustomerListView
            onSelectCustomer={(c) => setSelectedCustomer(c)}
            onOpenWallet={(id) => {
              setWalletModalCustomerId(id);
              setActiveTab('wallets');
            }}
            onOpenMessage={(c) => setMessagingCustomer(c)}
          />
        )}

        {activeTab === 'loyalty' && <LoyaltyProgramView />}

        {activeTab === 'coupons' && <CouponsView />}

        {activeTab === 'wallets' && (
          <CustomerWalletView initialCustomerId={walletModalCustomerId || undefined} />
        )}

        {activeTab === 'analytics' && <CRMAnalyticsView />}
      </div>

      {/* Global Messaging Modal */}
      {messagingCustomer && (
        <CustomerMessagingModal
          customer={messagingCustomer}
          onClose={() => setMessagingCustomer(null)}
        />
      )}
    </div>
  );
};
