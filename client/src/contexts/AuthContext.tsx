import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { User } from '@shared/schema';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, stayLoggedIn?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Initialize from localStorage to maintain state across reloads
    const storedUser = localStorage.getItem('auth_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  
  // Check session status on app load (persistent login)
  const { data: sessionData, isLoading } = useQuery({
    queryKey: ['/api/auth/session'],
    retry: (failureCount, error: any) => {
      // Only retry if it's a network error, not auth failure
      return failureCount < 2 && error?.status !== 401;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    initialData: user ? { authenticated: true, user } : undefined,
  });

  // Update user state when session data changes
  useEffect(() => {
    if (sessionData) {
      if (sessionData.authenticated && sessionData.user) {
        console.log('Auth state: Authenticated via session, user:', sessionData.user.email);
        setUser(sessionData.user);
        // Persist to localStorage for permanent login
        localStorage.setItem('auth_user', JSON.stringify(sessionData.user));
      } else {
        console.log('Auth state: Not authenticated, clearing stored data');
        setUser(null);
        localStorage.removeItem('auth_user');
      }
    }
  }, [sessionData]);

  const login = async (email: string, password: string, stayLoggedIn = false) => {
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, stayLoggedIn }),
      });

      // Immediately set the user data from the response
      if (data.user) {
        setUser(data.user);
        // Persist to localStorage for permanent login
        localStorage.setItem('auth_user', JSON.stringify(data.user));
      }
      
      // Refresh both session and user data in the background
      queryClient.invalidateQueries({ queryKey: ['/api/auth/session'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
      
      setUser(null);
      // Clear localStorage on logout
      localStorage.removeItem('auth_user');
      
      // Clear all query cache upon logout
      queryClient.clear();
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};