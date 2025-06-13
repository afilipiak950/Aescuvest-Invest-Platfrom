import { useAuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  const auth = useAuthContext();
  return auth;
}