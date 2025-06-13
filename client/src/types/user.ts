// Temporary user type definition until we can properly import from shared/schema
export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser extends Omit<User, 'password'> {}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  message: string;
}