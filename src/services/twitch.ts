import { config } from '../config/env.ts';
import type {
  TwitchTokenResponse,
  TwitchUser,
  TwitchFollow,
  TwitchStream,
  TwitchCategory,
  TwitchSearchChannel,
} from '../types/twitch.js';

const TWITCH_API_BASE = 'https://api.twitch.tv/helix';

export class TwitchService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = config.twitch.clientId;
    this.clientSecret = config.twitch.clientSecret;
    this.redirectUri = config.twitch.redirectUri;
  }

  getAuthUrl(state: string): string {
    const scopes = [
      'user:read:email',
      'user:read:follows',
      'channel:read:subscriptions',
      'chat:read',
      'chat:edit',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      state,
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TwitchTokenResponse> {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json() as Promise<TwitchTokenResponse>;
  }

  async refreshAccessToken(refreshToken: string): Promise<TwitchTokenResponse> {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    return response.json() as Promise<TwitchTokenResponse>;
  }

  async getUsers(accessToken: string, userIds: string[]): Promise<TwitchUser[]> {
    if (userIds.length === 0) return [];
    
    // Split into chunks of 100 which is Twitch's limit
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 100) {
      chunks.push(userIds.slice(i, i + 100));
    }

    const allUsers: TwitchUser[] = [];
    for (const chunk of chunks) {
      const params = new URLSearchParams();
      chunk.forEach(id => params.append('id', id));
      
      const response = await fetch(`${TWITCH_API_BASE}/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
      });

      if (response.ok) {
        const data = await response.json() as { data: TwitchUser[] };
        allUsers.push(...data.data);
      }
    }
    
    return allUsers;
  }

  async getUser(accessToken: string): Promise<TwitchUser> {
    const response = await fetch(`${TWITCH_API_BASE}/users`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user');
    }

    const data = await response.json() as { data: TwitchUser[] };
    const user = data.data[0];
    if (!user) {
      throw new Error('No user data found');
    }
    return user;
  }

  async getLiveFollowedStreamsWithUsers(accessToken: string, userId: string): Promise<any[]> {
     const streams = await this.getLiveFollowedStreams(accessToken, userId);
     if (streams.length === 0) return [];
     
     const userIds = streams.map(s => s.user_id);
     const users = await this.getUsers(accessToken, userIds);
     
     return streams.map(stream => ({
       ...stream,
       user_profile_image_url: users.find(u => u.id === stream.user_id)?.profile_image_url || null
     }));
  }

  async getStreamMetadata(channelName: string): Promise<{ sig: string; token: string }> {
    const query = JSON.stringify({
      query: `query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $playerType: String!) {
        streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {
          value
          signature
          __typename
        }
      }`,
      variables: {
        isLive: true,
        login: channelName,
        playerType: 'embed'
      }
    });

    const response = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-Id': 'kd1unb4b3q4t58fwlpcbzcbnm76a8fp',
        'Content-Type': 'application/json'
      },
      body: query
    });

    if (!response.ok) {
      throw new Error('Failed to get playback token');
    }

    const data = await response.json() as any;
    const tokenData = data.data.streamPlaybackAccessToken;
    
    if (!tokenData) {
      throw new Error('Stream not found or offline');
    }

    return {
      sig: tokenData.signature,
      token: tokenData.value
    };
  }

  async getUserFollows(accessToken: string, broadcasterId: string, after?: string, first: number = 100): Promise<{ data: TwitchFollow[]; cursor?: string; total: number }> {
    let url = `${TWITCH_API_BASE}/users/follows?to_id=${broadcasterId}&first=${first}`;
    if (after) url += `&after=${after}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get follows');
    }

    const data = await response.json() as { data: TwitchFollow[]; pagination?: { cursor: string }; total: number };
    return {
      data: data.data,
      cursor: data.pagination?.cursor,
      total: data.total,
    };
  }

  async getFollowing(
    accessToken: string,
    userId: string,
    after?: string,
    first: number = 100
  ): Promise<{ data: TwitchFollow[]; cursor?: string; total: number }> {

    let url = `${TWITCH_API_BASE}/channels/followed?user_id=${userId}&first=${first}`;
    if (after) url += `&after=${after}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Twitch API error:', response.status, errorBody);
      throw new Error(`Failed to get following: ${response.status} ${errorBody}`);
    }

    const data = await response.json() as {
      data: TwitchFollow[];
      pagination?: { cursor: string };
      total: number;
    };

    return {
      data: data.data,
      cursor: data.pagination?.cursor,
      total: data.total,
    };
  }

  async getLiveFollowedStreams(accessToken: string, userId: string): Promise<TwitchStream[]> {
    const response = await fetch(`${TWITCH_API_BASE}/streams/followed?user_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get followed streams: ${error}`);
    }

    const data = await response.json() as { data: TwitchStream[] };
    return data.data;
  }

  async getStreams(accessToken: string, gameId?: string, first: number = 100): Promise<TwitchStream[]> {
    let url = `${TWITCH_API_BASE}/streams?first=${first}`;
    if (gameId) url += `&game_id=${gameId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get streams');
    }

    const data = await response.json() as { data: TwitchStream[] };
    return data.data;
  }

  async getTopCategories(accessToken: string, first: number = 100): Promise<TwitchCategory[]> {
    const response = await fetch(`${TWITCH_API_BASE}/games/top?first=${first}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get categories');
    }

    const data = await response.json() as { data: TwitchCategory[] };
    return data.data.map((game: { id: string; name: string; box_art_url: string }) => ({
      id: game.id,
      name: game.name,
      box_art_url: game.box_art_url,
    }));
  }

  async getCategoryById(accessToken: string, id: string): Promise<TwitchCategory | null> {
    const response = await fetch(`${TWITCH_API_BASE}/games?id=${id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { data: TwitchCategory[] };
    return data.data[0] || null;
  }

  async searchCategories(accessToken: string, query: string, first: number = 20): Promise<TwitchCategory[]> {
    const response = await fetch(`${TWITCH_API_BASE}/search/categories?query=${encodeURIComponent(query)}&first=${first}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to search categories');
    }

    const data = await response.json() as { data: TwitchCategory[] };
    return data.data;
  }

  async searchChannels(accessToken: string, query: string, first: number = 20): Promise<TwitchSearchChannel[]> {
    const response = await fetch(`${TWITCH_API_BASE}/search/channels?query=${encodeURIComponent(query)}&first=${first}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to search channels');
    }

    const data = await response.json() as { data: TwitchSearchChannel[] };
    return data.data;
  }

  async getCategoryStreams(accessToken: string, gameId: string, first: number = 100): Promise<TwitchStream[]> {
    const response = await fetch(`${TWITCH_API_BASE}/streams?game_id=${gameId}&first=${first}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get category streams');
    }

    const data = await response.json() as { data: TwitchStream[] };
    return data.data;
  }

  async getChannelInfo(accessToken: string, broadcasterId: string): Promise<{ broadcaster_id: string; broadcaster_name: string; game_name: string; title: string } | null> {
    const response = await fetch(`${TWITCH_API_BASE}/channels?broadcaster_id=${broadcasterId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { data: { broadcaster_id: string; broadcaster_name: string; game_name: string; title: string }[] };
    return data.data[0] || null;
  }
}

export const twitchService = new TwitchService();
