export type WhoopTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type WhoopWorkoutScore = {
  strain?: number;
  average_heart_rate?: number;
  max_heart_rate?: number;
  kilojoule?: number;
  distance_meter?: number;
  altitude_gain_meter?: number;
  altitude_change_meter?: number;
  zone_durations?: {
    zone_zero_milli?: number;
    zone_one_milli?: number;
    zone_two_milli?: number;
    zone_three_milli?: number;
    zone_four_milli?: number;
    zone_five_milli?: number;
  };
};

export type WhoopWorkout = {
  id: string;
  v1_id?: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name: string;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score?: WhoopWorkoutScore;
  sport_id?: number;
};

export type WhoopWorkoutCollection = {
  records: WhoopWorkout[];
  next_token?: string;
};
