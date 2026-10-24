import React, { useState, useCallback, useEffect, type CSSProperties } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { QuickNavigation } from './components/layout/QuickNavigation';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClassesPage } from './pages/ClassesPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { LiveAttendancePage } from './pages/LiveAttendancePage';
import { ReportsPage } from './pages/ReportsPage';
import {PeoplePage} from './pages/PeoplePage';
import {StaffProfilePage} from './pages/StaffProfilePage';
import {InitialPasswordPage} from './pages/InitialPasswordPage';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

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
  if(user?.requiresPasswordChange)return <InitialPasswordPage/>;

  return <Outlet />;
};

function AdminRoute(){const {user}=useAuth();return user?.role==='admin'?<PeoplePage admin/>:<Navigate to="/" replace/>;}
function HomeRoute(){const {user}=useAuth();return user?.role==='admin'?<Navigate to="/admin" replace/>:<DashboardPage/>;}

const AppLayout: React.FC = () => {
  const {pathname}=useLocation();
  const [quickOpen,setQuickOpen]=useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setQuickOpen(open=>!open);}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[]);

  return (
    <div className="portal-shell" style={{ '--sidebar-width': sidebarCollapsed ? '72px' : '216px' } as CSSProperties}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} mobileOpen={mobileOpen} onClose={closeMobileMenu} />
      <div className="portal-content" inert={mobileOpen}>
        <Header onMenuToggle={() => setMobileOpen(true)} menuOpen={mobileOpen} onQuickNavigation={()=>setQuickOpen(true)} />
        <main id="main-content" className="portal-main" tabIndex={-1}>
          <div className="page-transition" key={pathname}><Outlet /></div>
        </main>
      </div>
      {quickOpen&&<QuickNavigation onClose={()=>setQuickOpen(false)}/>}
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
              <Route path="/" element={<HomeRoute />} />
              <Route path="/admin" element={<AdminRoute/>}/>
              <Route path="/students" element={<PeoplePage/>}/>
              <Route path="/profile" element={<StaffProfilePage/>}/>
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
