import React, { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAuth } from '../context/AuthContext';
import { getAppTheme } from '../theme';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

interface LayoutProps {
  currentView: string;
  onSelectView: (view: string) => void;
  onOpenSetupWizard?: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onSelectView, onOpenSetupWizard, children }) => {
  const { themeMode, dir } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const muiTheme = getAppTheme(themeMode, dir);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div className={`min-h-screen flex flex-col font-sans transition-colors ${
        themeMode === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        <Header onMobileMenuToggle={() => setMobileOpen(true)} onOpenSetupWizard={onOpenSetupWizard} />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            currentView={currentView}
            onSelectView={onSelectView}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-[calc(100vh-120px)]">
            <div className="max-w-7xl mx-auto space-y-6">{children}</div>
          </main>
        </div>

        <Footer />
      </div>
    </ThemeProvider>
  );
};
