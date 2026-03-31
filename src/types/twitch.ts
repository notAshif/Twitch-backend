export interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  email?: string;
  created_at: string;
}

export interface TwitchFollow {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  followed_at: string;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids: string[];
  tags: string[];
  is_mature: boolean;
}

export interface TwitchCategory {
  id: string;
  name: string;
  box_art_url: string;
}

export interface TwitchSearchChannel {
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_id: string;
  game_id: string;
  game_name: string;
  is_live: boolean;
  thumbnail_url: string;
  title: string;
  started_at?: string;
}

export interface TwitchVideo {
  id: string;
  stream_id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  language: string;
  type: string;
  duration: string;
}
