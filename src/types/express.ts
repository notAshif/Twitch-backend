export interface AuthUser {
  id: string;
  twitchId: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
  email: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}
