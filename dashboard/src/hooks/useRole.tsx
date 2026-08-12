import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { UserRole, RoleContextType } from '../types/role';

export type { UserRole, RoleContextType } from '../types/role';

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem('openwa_user_role');
    return (saved as UserRole) || null;
  });

  const [webhooksEnabled, setWebhooksEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('openwa_webhooks_enabled') === 'true';
  });

  const setRole = useCallback((newRole: UserRole | null) => {
    setRoleState(newRole);
    if (newRole) {
      localStorage.setItem('openwa_user_role', newRole);
    } else {
      localStorage.removeItem('openwa_user_role');
    }
  }, []);

  const setWebhooksEnabled = useCallback((enabled: boolean) => {
    setWebhooksEnabledState(enabled);
    localStorage.setItem('openwa_webhooks_enabled', String(enabled));
  }, []);

  const value: RoleContextType = useMemo(
    () => ({
      role,
      setRole,
      isAdmin: role === 'admin',
      isOperator: role === 'operator',
      isViewer: role === 'viewer',
      canWrite: role === 'admin' || role === 'operator',
      webhooksEnabled,
      setWebhooksEnabled,
    }),
    [role, setRole, webhooksEnabled, setWebhooksEnabled],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextType {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
