import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@lib/queryClient';
import { User } from '@shared/schema';

export interface AuthUser extends Omit<User, 'password'> {}

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
  message: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  // Get current user
  const { data: user, isLoading, error } = useQuery<AuthUser>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      // Check if token exists in localStorage
      const token = localStorage.getItem('auth_token');
      if (!token) return null;
      
      try {
        const data = await apiRequest<AuthUser>('/api/auth/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        return data;
      } catch (error) {
        // If token is invalid, clear it
        localStorage.removeItem('auth_token');
        return null;
      }
    },
    retry: false
  });
  
  // Login mutation
  const login = useMutation<AuthResponse, Error, LoginData>({
    mutationFn: async (credentials) => {
      const data = await apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      
      // Save token to localStorage
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      return data;
    },
    onSuccess: () => {
      // Refetch the current user
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    }
  });
  
  // Register mutation
  const register = useMutation<AuthResponse, Error, RegisterData>({
    mutationFn: async (userData) => {
      const data = await apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      
      // Save token to localStorage
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      return data;
    },
    onSuccess: () => {
      // Refetch the current user
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    }
  });
  
  // Logout function
  const logout = () => {
    localStorage.removeItem('auth_token');
    queryClient.setQueryData(['currentUser'], null);
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
  };
  
  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout
  };
}