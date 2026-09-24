import { UserProfile } from '../entities/user';

export interface IAuthRepository {
  getCurrentUser(): Promise<UserProfile | null>;
  loginWithGoogle(): Promise<UserProfile>;
  logout(): Promise<void>;
}
