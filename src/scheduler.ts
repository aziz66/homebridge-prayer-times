import type { Logging } from 'homebridge';

import type { PrayerTimesConfig, PrayerTimings, SchedulerCallbacks } from './settings.js';
import { PRAYERS, type PrayerName } from './settings.js';

export class Scheduler {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly log: Logging,
  ) {}

  scheduleDay(timings: PrayerTimings, config: PrayerTimesConfig, callbacks: SchedulerCallbacks): void {
    this.clearAll();

    const now = new Date();
    const motionDuration = (config.motionDuration ?? 30) * 60 * 1000;
    const windowDuration = (config.windowDuration ?? 30) * 60 * 1000;
    const enabledPrayers = this.getEnabledPrayers(config);
    const prayerDates = this.parsePrayerTimes(timings, enabledPrayers);

    // Schedule motion and contact sensors for each enabled prayer
    for (const prayer of enabledPrayers) {
      const prayerTime = prayerDates.get(prayer);
      if (!prayerTime) {
        continue;
      }

      const msUntilPrayer = prayerTime.getTime() - now.getTime();

      if (msUntilPrayer > 0) {
        // Future prayer — schedule motion ON and contact OPEN at prayer time
        this.timers.push(setTimeout(() => {
          this.log.info(`${prayer} time has arrived`);
          callbacks.onMotionDetected(prayer, true);
          callbacks.onContactState(prayer, true);

          // Schedule motion OFF after motionDuration
          this.timers.push(setTimeout(() => {
            callbacks.onMotionDetected(prayer, false);
          }, motionDuration));

          // Schedule contact CLOSE after windowDuration
          this.timers.push(setTimeout(() => {
            callbacks.onContactState(prayer, false);
          }, windowDuration));
        }, msUntilPrayer));

        this.log.info(`${prayer} scheduled at ${timings[prayer]}`);
      } else {
        // Prayer already passed — check how long ago
        const elapsed = Math.abs(msUntilPrayer);

        // If within motion window, set motion ON with remaining time
        if (elapsed < motionDuration) {
          callbacks.onMotionDetected(prayer, true);
          this.timers.push(setTimeout(() => {
            callbacks.onMotionDetected(prayer, false);
          }, motionDuration - elapsed));
        }

        // If within contact window, set contact OPEN with remaining time
        if (elapsed < windowDuration) {
          callbacks.onContactState(prayer, true);
          this.timers.push(setTimeout(() => {
            callbacks.onContactState(prayer, false);
          }, windowDuration - elapsed));
        }
      }
    }

    // Pre-adhan alerts
    if (config.preAdhanAlert) {
      const preMinutes = (config.preAdhanMinutes ?? 15) * 60 * 1000;
      for (const prayer of enabledPrayers) {
        const prayerTime = prayerDates.get(prayer);
        if (!prayerTime) {
          continue;
        }
        const msUntilPreAdhan = prayerTime.getTime() - preMinutes - now.getTime();
        if (msUntilPreAdhan > 0) {
          this.timers.push(setTimeout(() => {
            this.log.info(`Pre-adhan alert for ${prayer}`);
            callbacks.onPreAdhan(prayer, true);
            this.timers.push(setTimeout(() => {
              callbacks.onPreAdhan(prayer, false);
            }, motionDuration));
          }, msUntilPreAdhan));
        }
      }
    }

    // Countdown timer
    if (config.showCountdown) {
      this.startCountdown(enabledPrayers, prayerDates, callbacks);
    }

    // Schedule daily refresh at 00:05 next day
    this.scheduleDailyRefresh(callbacks);
  }

  clearAll(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private getEnabledPrayers(config: PrayerTimesConfig): PrayerName[] {
    const prayerConfig = config.prayers;
    return PRAYERS.filter(prayer => {
      if (!prayerConfig) {
        return true;
      }
      const key = prayer.toLowerCase() as Lowercase<PrayerName>;
      return prayerConfig[key] !== false;
    });
  }

  private parsePrayerTimes(timings: PrayerTimings, prayers: PrayerName[]): Map<PrayerName, Date> {
    const map = new Map<PrayerName, Date>();
    const today = new Date();

    for (const prayer of prayers) {
      const timeStr = timings[prayer];
      if (!timeStr) {
        continue;
      }
      const match = timeStr.match(/^(\d{2}):(\d{2})$/);
      if (!match) {
        this.log.warn(`Invalid time format for ${prayer}: ${timeStr}`);
        continue;
      }
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(match[1]), parseInt(match[2]));
      map.set(prayer, date);
    }

    return map;
  }

  private startCountdown(prayers: PrayerName[], prayerDates: Map<PrayerName, Date>, callbacks: SchedulerCallbacks): void {
    const update = () => {
      const now = new Date();
      let nextMinutes = 0;

      for (const prayer of prayers) {
        const time = prayerDates.get(prayer);
        if (time && time.getTime() > now.getTime()) {
          nextMinutes = Math.ceil((time.getTime() - now.getTime()) / 60000);
          break;
        }
      }

      callbacks.onCountdownUpdate(Math.max(nextMinutes, 0));
    };

    update();
    this.countdownInterval = setInterval(update, 60000);
  }

  private scheduleDailyRefresh(callbacks: SchedulerCallbacks): void {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0);
    const msUntilRefresh = tomorrow.getTime() - now.getTime();

    this.log.debug(`Daily refresh scheduled in ${Math.round(msUntilRefresh / 60000)} minutes`);

    this.timers.push(setTimeout(() => {
      this.log.info('Daily prayer times refresh');
      callbacks.onResetAll();
      callbacks.onDayRefresh();
    }, msUntilRefresh));
  }
}
