import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Permission, LoginRequest } from '../types/index';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshUser: (updatedUser: User) => void;
  isLoading: boolean;
  hasPermission: (permission: Permission) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Helper function to decode JWT and check if it has permissions field
    const hasPermissionsInToken = (token: string): boolean => {
      try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return 'permissions' in decoded;
      } catch {
        return false;
      }
    };

    // Check if user is already logged in and fetch fresh data from backend
    const loadUser = async () => {
      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        // Check if token has permissions field
        if (!hasPermissionsInToken(storedToken)) {
          // Old token without permissions - clear and force re-login
          console.log('Detected old token without permissions, clearing localStorage...');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsLoading(false);
          return;
        }

        setToken(storedToken);
        try {
          // Fetch fresh user data from backend (including latest permissions)
          const freshUser = await authService.me();
          setUser(freshUser);
          // Update localStorage with fresh data
          localStorage.setItem('user', JSON.stringify(freshUser));
        } catch {
          // If token is invalid, clear everything
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = async (data: LoginRequest) => {
    const response = await authService.login(data);
    setUser(response.user);
    setToken(response.token);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const refreshUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    // ADMIN has all permissions
    if (user.role === 'ADMIN') return true;

    // Check user-specific permissions (array format)
    const permissions = user.permissions || [];

    // Check if user has the exact permission
    if (permissions.includes(permission)) return true;

    // Check permission hierarchy - higher-level permissions include lower-level ones
    const [resource, action] = permission.split(':');

    // Permission hierarchy
    const PERMISSION_HIERARCHY: Record<string, string[]> = {
      'manage': ['view', 'create', 'update', 'delete'],
      'create': ['view'],
      'update': ['view'],
      'delete': ['view'],
    };

    // Check if user has a higher-level permission
    for (const userPermission of permissions) {
      const [userResource, userAction] = userPermission.split(':');

      // Same resource?
      if (userResource === resource) {
        const impliedActions = PERMISSION_HIERARCHY[userAction] || [];
        if (impliedActions.includes(action)) {
          return true;
        }
      }
    }

    return false;
  };

  const isAdmin = (): boolean => {
    return user?.role === 'ADMIN';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
