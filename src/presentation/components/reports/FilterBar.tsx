import { translateRawUi } from '../../../i18n';
import { useAuth } from '../../context/AuthContext';
import React from 'react';
import { Calendar, Filter, RotateCcw, Building2, User, ShoppingBag, Users } from 'lucide-react';
import { getMogadishuDateString } from '../../../lib/dateUtils';

export interface ReportFilters {
  datePreset: 'today' | 'week' | 'month' | 'last30' | 'year' | 'all' | 'custom';
  startDate: string;
  endDate: string;
  branch: string;
  employee: string;
  category: string;
  customer: string;
}

interface FilterBarProps {
  filters: ReportFilters;
  onChangeFilters: (updated: ReportFilters) => void;
  branches: string[];
  employees: { id: string; name: string }[];
  categories: string[];
  customers: { id: string; name: string }[];
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChangeFilters,
  branches,
  employees,
  categories,
  customers,
  onReset,
}) => {
  const { t } = useAuth();
  const handlePresetChange = (preset: ReportFilters['datePreset']) => {
    const today = new Date();
    let start = '';
    let end = getMogadishuDateString(today);

    if (preset === 'today') {
      start = end;
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = getMogadishuDateString(d);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(1);
      start = getMogadishuDateString(d);
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = getMogadishuDateString(d);
    } else if (preset === 'year') {
      const d = new Date(today.getFullYear(), 0, 1);
      start = getMogadishuDateString(d);
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    onChangeFilters({
      ...filters,
      datePreset: preset,
      startDate: start,
      endDate: end,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <Filter className="w-4 h-4" />
          <span>{t.legacyUi.analyticsReportFilters}</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> {translateRawUi('Reset Filters')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        {/* Date Presets */}
        <div>
          <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" /> {translateRawUi('Date Preset')}
          </label>
          <select
            value={filters.datePreset}
            onChange={(e) => handlePresetChange(e.target.value as any)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{t.legacyUi.allTime}</option>
            <option value="today">{translateRawUi('Today')}</option>
            <option value="week">{t.legacyUi.thisWeek}</option>
            <option value="month">{t.legacyUi.thisMonth}</option>
            <option value="last30">{t.legacyUi.last30Days}</option>
            <option value="year">{t.legacyUi.thisYear}</option>
            <option value="custom">{t.legacyUi.customDateRange}</option>
          </select>
        </div>

        {/* Branch Filter */}
        <div>
          <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-blue-400" /> {translateRawUi('Branch')}
          </label>
          <select
            value={filters.branch}
            onChange={(e) => onChangeFilters({ ...filters, branch: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{t.legacyUi.allBranches}</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Employee Filter */}
        <div>
          <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-indigo-400" /> {translateRawUi('Staff / Employee')}
          </label>
          <select
            value={filters.employee}
            onChange={(e) => onChangeFilters({ ...filters, employee: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{t.legacyUi.allStaffCashiers}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        {/* Product / Category Filter */}
        <div>
          <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" /> {translateRawUi('Category / Product')}
          </label>
          <select
            value={filters.category}
            onChange={(e) => onChangeFilters({ ...filters, category: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{t.legacyUi.allCategories}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Customer Filter */}
        <div>
          <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-purple-400" /> {translateRawUi('Customer')}
          </label>
          <select
            value={filters.customer}
            onChange={(e) => onChangeFilters({ ...filters, customer: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{t.legacyUi.allCustomers}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Inputs if custom is selected */}
      {filters.datePreset === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">{t.legacyUi.startDate}</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChangeFilters({ ...filters, startDate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">{t.legacyUi.endDate}</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onChangeFilters({ ...filters, endDate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
