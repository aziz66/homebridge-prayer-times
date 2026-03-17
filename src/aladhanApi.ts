import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Logging } from 'homebridge';

import type { AladhanApiResponse, CachedPrayerTimes, PrayerTimesConfig, PrayerTimings } from './settings.js';

export class AladhanApi {
  private readonly cachePath: string;

  constructor(
    private readonly config: PrayerTimesConfig,
    private readonly storagePath: string,
    private readonly log: Logging,
  ) {
    this.cachePath = path.join(storagePath, 'prayer-times-cache.json');
  }

  async fetchTimings(date?: Date): Promise<PrayerTimings | null> {
    const d = date ?? new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

    // Check cache first
    const cached = await this.readCache();
    if (cached && cached.date === dateStr) {
      this.log.debug('Using cached prayer times for', dateStr);
      return cached.timings;
    }

    // Build API URL
    const url = this.buildUrl(dateStr);
    if (!url) {
      return cached?.timings ?? null;
    }

    try {
      this.log.info('Fetching prayer times from AlAdhan API for', dateStr);
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

      const json = await response.json() as AladhanApiResponse;

      if (!response.ok || json.code !== 200 || !json.data?.timings) {
        const detail = typeof json.data === 'string' ? json.data : json.status;
        throw new Error(`API error (${json.code}): ${detail}`);
      }

      const timings = this.cleanTimings(json.data.timings);
      const meta = json.data.meta;
      await this.writeCache({
        date: dateStr,
        timings,
        meta: { timezone: meta.timezone, method: meta.method.name },
      });
      this.log.info(
        `Prayer times fetched — timezone: ${meta.timezone}, method: ${meta.method.name}`,
      );

      return timings;
    } catch (error) {
      this.log.error('Failed to fetch prayer times:', (error as Error).message);

      if (cached) {
        this.log.warn('Using cached prayer times (may be stale)');
        return cached.timings;
      }

      return null;
    }
  }

  private buildUrl(dateStr: string): string | null {
    const loc = this.config.location;
    if (!loc) {
      this.log.error('No location configured');
      return null;
    }

    const method = this.config.calculationMethod ?? 4;
    const school = this.config.school ?? 0;

    if (loc.mode === 'coordinates' && loc.latitude !== undefined && loc.longitude !== undefined) {
      const tz = this.config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const base = `https://api.aladhan.com/v1/timings/${dateStr}`;
      const params = `latitude=${loc.latitude}&longitude=${loc.longitude}`
        + `&method=${method}&school=${school}&timezonestring=${encodeURIComponent(tz)}`;
      return `${base}?${params}`;
    }

    if (loc.mode === 'city' && loc.city?.trim() && loc.country?.trim()) {
      const city = loc.city.trim();
      const country = loc.country.trim();
      const base = `https://api.aladhan.com/v1/timingsByCity/${dateStr}`;
      const params = `city=${encodeURIComponent(city)}`
        + `&country=${encodeURIComponent(country)}&method=${method}&school=${school}`;
      return `${base}?${params}`;
    }

    this.log.error('Invalid location configuration');
    return null;
  }

  private cleanTimings(timings: PrayerTimings): PrayerTimings {
    const cleaned = { ...timings };
    for (const key of Object.keys(cleaned)) {
      // Strip timezone suffixes like " (BST)" from "HH:mm (BST)"
      cleaned[key] = cleaned[key].replace(/\s*\(.*\)$/, '');
    }
    return cleaned;
  }

  private async readCache(): Promise<CachedPrayerTimes | null> {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      return JSON.parse(data) as CachedPrayerTimes;
    } catch {
      return null;
    }
  }

  private async writeCache(cache: CachedPrayerTimes): Promise<void> {
    try {
      await fs.writeFile(this.cachePath, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (error) {
      this.log.warn('Failed to write cache:', (error as Error).message);
    }
  }
}
