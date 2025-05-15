import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthUser } from '../types/user';

interface AuthContextProps {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  
  // Login handler
  const handleLogin = async (email: string, password: string) => {
    try {
      await auth.login.mutateAsync({ email, password });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  // Register handler
  const handleRegister = async (name: string, email: string, password: string) => {
    try {
      await auth.register.mutateAsync({ name, email, password });
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };
  
  const value: AuthContextProps = {
    user: auth.user ?? null,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    isAdmin: auth.isAdmin,
    login: handleLogin,
    register: handleRegister,
    logout: auth.logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}