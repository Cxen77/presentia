import React, { useState, useCallback, type CSSProperties } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClassesPage } from './pages/ClassesPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { LiveAttendancePage } from './pages/LiveAttendancePage';
import { ReportsPage } from './pages/ReportsPage';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#061522] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#9AB9EC] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#A8B9D0]">Authenticating faculty session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const AppLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="portal-shell" style={{ '--sidebar-width': sidebarCollapsed ? '72px' : '216px' } as CSSProperties}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} mobileOpen={mobileOpen} onClose={closeMobileMenu} />
      <div className="portal-content" inert={mobileOpen}>
        <Header onMenuToggle={() => setMobileOpen(true)} menuOpen={mobileOpen} />
        <main id="main-content" className="portal-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/create-class" element={<CreateClassPage />} />
              <Route path="/live-attendance" element={<LiveAttendancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
