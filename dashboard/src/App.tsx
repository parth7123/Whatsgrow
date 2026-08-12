import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { RoleProvider, useRole, type UserRole } from './hooks/useRole';
import { ErrorBoundary } from './components/ErrorBoundary';
import { API_BASE_URL } from './services/api';
import './App.css';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Sessions } from './pages/Sessions';
import { Chats } from './pages/Chats';
import { Webhooks } from './pages/Webhooks';
import { Templates } from './pages/Templates';
import { Logs } from './pages/Logs';
import { ApiKeys } from './pages/ApiKeys';
import { MessageTester } from './pages/MessageTester';
import { Infrastructure } from './pages/Infrastructure';
import Plugins from './pages/Plugins';
import { Contacts } from './pages/Contacts';
import { Campaigns } from './pages/Campaigns';
import { MarketingAnalytics } from './pages/MarketingAnalytics';
import { UsersManagement } from './pages/UsersManagement';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  requiresWebhook?: boolean;
}

function ProtectedRoute({ children, adminOnly, requiresWebhook }: ProtectedRouteProps) {
  const { role, webhooksEnabled } = useRole();
  if (adminOnly && role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  if (requiresWebhook && role !== 'admin' && !webhooksEnabled) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppContent() {
  // Initialize from sessionStorage to avoid setState in effect
  const savedKey = sessionStorage.getItem('openwa_api_key');
  const [isAuthenticated, setIsAuthenticated] = useState(!!savedKey);
  const [, setApiKey] = useState(savedKey || '');
  const { setRole, role, setWebhooksEnabled } = useRole();

  const handleLogin = async (key: string) => {
    setApiKey(key);
    sessionStorage.setItem('openwa_api_key', key);
    const loginToken = sessionStorage.getItem('openwa_login_token') || localStorage.getItem('openwa_login_token') || '';

    // Fetch the role from API
    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'X-API-Key': key, ...(loginToken ? { 'X-Login-Token': loginToken } : {}) },
      });
      if (response.ok) {
        const data = await response.json();
        setRole(data.role as UserRole);
        setWebhooksEnabled(data.webhooksEnabled === true);
      }
    } catch {
      // Default to viewer if we can't fetch role
      setRole('viewer');
      setWebhooksEnabled(false);
    }

    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    const key = sessionStorage.getItem('openwa_api_key') || savedKey;
    const loginToken = sessionStorage.getItem('openwa_login_token') || localStorage.getItem('openwa_login_token') || '';
    if (key) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'X-API-Key': key, ...(loginToken ? { 'X-Login-Token': loginToken } : {}) },
        });
      } catch {
        // Ignore network/auth errors during logout
      }
    }
    setApiKey('');
    setIsAuthenticated(false);
    setRole(null);
    setWebhooksEnabled(false);
    sessionStorage.removeItem('openwa_api_key');
    sessionStorage.removeItem('openwa_login_token');
    localStorage.removeItem('openwa_login_token');
  };

  // Re-validate and get role on mount if already authenticated
  useEffect(() => {
    if (!savedKey) return;
    const loginToken = sessionStorage.getItem('openwa_login_token') || localStorage.getItem('openwa_login_token') || '';

    fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: { 'X-API-Key': savedKey, ...(loginToken ? { 'X-Login-Token': loginToken } : {}) },
    })
      .then(res => {
        if (res.status === 401) {
          handleLogout();
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.valid && data.role) {
          setRole(data.role as UserRole);
          setWebhooksEnabled(data.webhooksEnabled === true);
        }
      })
      .catch(() => {
        // Keep existing role from localStorage if validation fails
      });
  }, [savedKey, setRole, setWebhooksEnabled]);

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
            <Route index element={<Dashboard />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="analytics" element={<MarketingAnalytics />} />
            <Route path="templates" element={<Templates />} />
            <Route path="message-tester" element={<MessageTester />} />
            
            <Route path="webhooks" element={<ProtectedRoute requiresWebhook><Webhooks /></ProtectedRoute>} />
            <Route path="chats" element={<ProtectedRoute adminOnly><Chats /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute adminOnly><UsersManagement /></ProtectedRoute>} />
            <Route path="api-keys" element={<ProtectedRoute adminOnly><ApiKeys /></ProtectedRoute>} />
            <Route path="infrastructure" element={<ProtectedRoute adminOnly><Infrastructure /></ProtectedRoute>} />
            <Route path="plugins" element={<ProtectedRoute adminOnly><Plugins /></ProtectedRoute>} />
            <Route path="logs" element={<ProtectedRoute adminOnly><Logs /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
