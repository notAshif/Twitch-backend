import 'dotenv/config';

const isVercel = !!process.env.VERCEL_URL;
const vercelBase = isVercel ? `https://${process.env.VERCEL_URL}` : null;

export const config = {
  appUrl: process.env.APP_URL || vercelBase || 'http://localhost:5173',
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    redirectUri: process.env.TWITCH_REDIRECT_URI || 
                 (vercelBase ? `${vercelBase}/auth/twitch/callback` : 'http://localhost:3000/auth/twitch/callback'),
  },
  
  github: {
    token: process.env.GITHUB_TOKEN || '',
    repoOwner: process.env.GITHUB_REPO_OWNER || '',
    repoName: process.env.GITHUB_REPO_NAME || '',
  },
  
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-key-change-in-production!',
  },
};
