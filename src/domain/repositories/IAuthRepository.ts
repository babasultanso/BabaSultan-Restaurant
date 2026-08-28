import { UserProfile, UserRole } from '../entities/user';

export interface IAuthRepository {
  getCurrentUser(): Promise<UserProfile | null>;
  loginWithGoogle(): Promise<UserProfile>;
  logout(): Promise<void>;
  updateUserRole(uid: string, role: UserRole): Promise<void>;
}
