import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { AladhanApi } from './aladhanApi.js';
import { CountdownAccessory, PreAdhanAccessory, PrayerTimeAccessory } from './prayerAccessory.js';
import { Scheduler } from './scheduler.js';
import { PLATFORM_NAME, PLUGIN_NAME, PRAYERS } from './settings.js';
import type { PrayerName, PrayerTimesConfig, SchedulerCallbacks } from './settings.js';

export class PrayerTimesPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly accessories: Map<string, PlatformAccessory> = new Map();
  private readonly prayerAccessories: Map<PrayerName, PrayerTimeAccessory> = new Map();
  private readonly preAdhanAccessories: Map<PrayerName, PreAdhanAccessory> = new Map();
  private countdownAccessory: CountdownAccessory | null = null;

  private readonly scheduler: Scheduler;
  private readonly apiClient: AladhanApi;
  private readonly ptConfig: PrayerTimesConfig;
  private retryCount = 0;
  private readonly maxRetries = 3;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly log: Logging,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.ptConfig = config as PrayerTimesConfig;
    this.scheduler = new Scheduler(log);
    this.apiClient = new AladhanApi(this.ptConfig, api.user.storagePath(), log);

    if (!this.ptConfig.location) {
      this.log.error('No location configured. Please configure the plugin in Homebridge settings.');
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  private discoverDevices(): void {
    const discoveredUUIDs: string[] = [];
    const enabledPrayers = this.getEnabledPrayers();

    // Create/restore prayer accessories
    for (const prayer of enabledPrayers) {
      const uuid = this.api.hap.uuid.generate(`prayer-${prayer}`);
      discoveredUUIDs.push(uuid);

      const existing = this.accessories.get(uuid);
      if (existing) {
        this.log.info('Restoring:', existing.displayName);
        const handler = new PrayerTimeAccessory(this, existing, prayer);
        this.prayerAccessories.set(prayer, handler);
      } else {
        this.log.info('Adding new accessory:', prayer);
        const accessory = new this.api.platformAccessory(prayer, uuid);
        accessory.context.prayer = prayer;
        const handler = new PrayerTimeAccessory(this, accessory, prayer);
        this.prayerAccessories.set(prayer, handler);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

    // Pre-adhan accessories
    if (this.ptConfig.preAdhanAlert) {
      for (const prayer of enabledPrayers) {
        const uuid = this.api.hap.uuid.generate(`pre-adhan-${prayer}`);
        discoveredUUIDs.push(uuid);

        const existing = this.accessories.get(uuid);
        if (existing) {
          this.log.info('Restoring:', existing.displayName);
          const handler = new PreAdhanAccessory(this, existing, prayer);
          this.preAdhanAccessories.set(prayer, handler);
        } else {
          this.log.info('Adding pre-adhan accessory:', `${prayer} Alert`);
          const accessory = new this.api.platformAccessory(`${prayer} Alert`, uuid);
          accessory.context.prayer = prayer;
          accessory.context.type = 'preAdhan';
          const handler = new PreAdhanAccessory(this, accessory, prayer);
          this.preAdhanAccessories.set(prayer, handler);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    }

    // Countdown accessory
    if (this.ptConfig.showCountdown) {
      const uuid = this.api.hap.uuid.generate('prayer-countdown');
      discoveredUUIDs.push(uuid);

      const existing = this.accessories.get(uuid);
      if (existing) {
        this.log.info('Restoring:', existing.displayName);
        this.countdownAccessory = new CountdownAccessory(this, existing);
      } else {
        this.log.info('Adding countdown accessory');
        const accessory = new this.api.platformAccessory('Next Prayer', uuid);
        accessory.context.type = 'countdown';
        this.countdownAccessory = new CountdownAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

    // Remove stale accessories
    for (const [uuid, accessory] of this.accessories) {
      if (!discoveredUUIDs.includes(uuid)) {
        this.log.info('Removing stale accessory:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

    // Fetch prayer times and schedule
    this.fetchAndSchedule().catch((error) => {
      this.log.error('Failed to fetch and schedule prayer times:', (error as Error).message);
    });
  }

  private async fetchAndSchedule(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const result = await this.apiClient.fetchTimings();

    if (!result) {
      this.retryCount++;
      // Always keep retrying — use backoff: 5min for first 3, then 30min, then 60min
      let delayMin: number;
      if (this.retryCount <= this.maxRetries) {
        delayMin = 5;
      } else if (this.retryCount <= 6) {
        delayMin = 30;
      } else {
        delayMin = 60;
      }
      this.log.warn(`Retry ${this.retryCount}: will try again in ${delayMin} minutes`);
      this.retryTimer = setTimeout(() => {
        this.fetchAndSchedule().catch((error) => {
          this.log.error('Retry failed:', (error as Error).message);
        });
      }, delayMin * 60 * 1000);
      return;
    }

    this.retryCount = 0;

    // Reset all sensors before scheduling — clears stale state from previous config
    for (const acc of this.prayerAccessories.values()) {
      acc.setMotionDetected(false);
      acc.setContactState(false);
    }
    for (const acc of this.preAdhanAccessories.values()) {
      acc.setMotionDetected(false);
    }

    // Log resolved location and timezone so users can verify their config
    this.logResolvedLocation();
    this.log.info(`Scheduling timezone: ${result.timezone}`);

    const callbacks: SchedulerCallbacks = {
      onMotionDetected: (prayer, detected) => {
        this.prayerAccessories.get(prayer)?.setMotionDetected(detected);
      },
      onContactState: (prayer, open) => {
        this.prayerAccessories.get(prayer)?.setContactState(open);
      },
      onPreAdhan: (prayer, detected) => {
        this.preAdhanAccessories.get(prayer)?.setMotionDetected(detected);
      },
      onCountdownUpdate: (minutes) => {
        this.countdownAccessory?.updateCountdown(minutes);
      },
      onResetAll: () => {
        for (const acc of this.prayerAccessories.values()) {
          acc.setMotionDetected(false);
          acc.setContactState(false);
        }
        for (const acc of this.preAdhanAccessories.values()) {
          acc.setMotionDetected(false);
        }
      },
      onDayRefresh: () => {
        this.log.info('Refreshing prayer times for new day');
        this.fetchAndSchedule().catch((error) => {
          this.log.error('Failed to refresh prayer times:', (error as Error).message);
        });
      },
    };

    this.scheduler.scheduleDay(result.timings, this.ptConfig, callbacks, result.timezone);
  }

  private logResolvedLocation(): void {
    const loc = this.ptConfig.location;
    if (!loc) {
      return;
    }
    if (loc.mode === 'city') {
      this.log.info(`Location: ${loc.city}, ${loc.country}`);
    } else if (loc.mode === 'coordinates') {
      this.log.info(`Location: ${loc.latitude}, ${loc.longitude}`);
    }
  }

  private getEnabledPrayers(): PrayerName[] {
    const prayerConfig = this.ptConfig.prayers;
    return PRAYERS.filter(prayer => {
      if (!prayerConfig) {
        return true;
      }
      const key = prayer.toLowerCase() as Lowercase<PrayerName>;
      return prayerConfig[key] !== false;
    });
  }
}
