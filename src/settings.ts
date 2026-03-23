import type { PlatformConfig } from 'homebridge';

export const PLATFORM_NAME = 'PrayerTimes';
export const PLUGIN_NAME = 'homebridge-prayer-times';
export const PLUGIN_VERSION = '1.0.5';

export const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = typeof PRAYERS[number];

export interface PrayerTimesConfig extends PlatformConfig {
  location?: {
    mode: 'city' | 'coordinates';
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  calculationMethod?: number;
  school?: number;
  timezone?: string;
  prayers?: Partial<Record<Lowercase<PrayerName>, boolean>>;
  motionDuration?: number;
  windowDuration?: number;
  preAdhanAlert?: boolean;
  preAdhanMinutes?: number;
  showCountdown?: boolean;
  countdownStyle?: 'valve' | 'lux';
}

export interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  Sunset: string;
  Imsak: string;
  Midnight: string;
  [key: string]: string;
}

export interface AladhanApiResponse {
  code: number;
  status: string;
  data: {
    timings: PrayerTimings;
    date: {
      readable: string;
      timestamp: string;
    };
    meta: {
      latitude: number;
      longitude: number;
      timezone: string;
      method: {
        id: number;
        name: string;
      };
    };
  };
}

export interface CachedPrayerTimes {
  date: string;
  timings: PrayerTimings;
  meta?: {
    timezone: string;
    method: string;
  };
}

export interface FetchResult {
  timings: PrayerTimings;
  timezone: string;
}

export interface SchedulerCallbacks {
  onMotionDetected: (prayer: PrayerName, detected: boolean) => void;
  onContactState: (prayer: PrayerName, open: boolean) => void;
  onPreAdhan: (prayer: PrayerName, detected: boolean) => void;
  onCountdownUpdate: (minutes: number) => void;
  onResetAll: () => void;
  onDayRefresh: () => void;
}
