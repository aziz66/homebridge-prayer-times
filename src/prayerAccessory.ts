import type { Characteristic, PlatformAccessory, Service } from 'homebridge';

import type { PrayerTimesPlatform } from './platform.js';
import type { PrayerName } from './settings.js';
import { PLUGIN_VERSION } from './settings.js';

export class PrayerTimeAccessory {
  private readonly motionService: Service;
  private readonly contactService: Service;

  constructor(
    private readonly platform: PrayerTimesPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly prayer: PrayerName,
  ) {
    const { Service: Svc, Characteristic: Char } = platform;

    this.accessory.getService(Svc.AccessoryInformation)!
      .setCharacteristic(Char.Manufacturer, 'AlAdhan')
      .setCharacteristic(Char.Model, 'Prayer Times')
      .setCharacteristic(Char.SerialNumber, `prayer-${prayer.toLowerCase()}`)
      .setCharacteristic(Char.FirmwareRevision, PLUGIN_VERSION);

    this.motionService = this.accessory.getService(Svc.MotionSensor)
      || this.accessory.addService(Svc.MotionSensor, `${prayer} Adhan`);

    this.contactService = this.accessory.getServiceById(Svc.ContactSensor, 'contact')
      || this.accessory.addService(Svc.ContactSensor, `${prayer} Window`, 'contact');

    // Restore state from context
    const ctx = this.accessory.context;
    this.motionService.getCharacteristic(Char.MotionDetected)
      .onGet(() => ctx.motionDetected ?? false);

    this.contactService.getCharacteristic(Char.ContactSensorState)
      .onGet(() => ctx.contactOpen
        ? Char.ContactSensorState.CONTACT_NOT_DETECTED
        : Char.ContactSensorState.CONTACT_DETECTED);
  }

  setMotionDetected(detected: boolean): void {
    this.accessory.context.motionDetected = detected;
    this.motionService.updateCharacteristic(
      this.platform.Characteristic.MotionDetected,
      detected,
    );
    this.platform.log.debug(`${this.prayer} motion: ${detected}`);
  }

  setContactState(open: boolean): void {
    this.accessory.context.contactOpen = open;
    const state = open
      ? this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
    this.contactService.updateCharacteristic(
      this.platform.Characteristic.ContactSensorState,
      state,
    );
    this.platform.log.debug(`${this.prayer} contact: ${open ? 'open' : 'closed'}`);
  }
}

export class PreAdhanAccessory {
  private readonly motionService: Service;

  constructor(
    private readonly platform: PrayerTimesPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly prayer: PrayerName,
  ) {
    const { Service: Svc, Characteristic: Char } = platform;

    this.accessory.getService(Svc.AccessoryInformation)!
      .setCharacteristic(Char.Manufacturer, 'AlAdhan')
      .setCharacteristic(Char.Model, 'Prayer Times Pre-Alert')
      .setCharacteristic(Char.SerialNumber, `pre-adhan-${prayer.toLowerCase()}`)
      .setCharacteristic(Char.FirmwareRevision, PLUGIN_VERSION);

    this.motionService = this.accessory.getService(Svc.MotionSensor)
      || this.accessory.addService(Svc.MotionSensor, `${prayer} Alert`);

    this.motionService.getCharacteristic(Char.MotionDetected)
      .onGet(() => this.accessory.context.motionDetected ?? false);
  }

  setMotionDetected(detected: boolean): void {
    this.accessory.context.motionDetected = detected;
    this.motionService.updateCharacteristic(
      this.platform.Characteristic.MotionDetected,
      detected,
    );
    this.platform.log.debug(`${this.prayer} pre-adhan: ${detected}`);
  }
}

export class CountdownAccessory {
  private readonly service: Service;
  private readonly Char: typeof Characteristic;
  private readonly mode: 'valve' | 'lux';

  constructor(
    private readonly platform: PrayerTimesPlatform,
    private readonly accessory: PlatformAccessory,
    mode: 'valve' | 'lux' = 'valve',
  ) {
    const { Service: Svc, Characteristic: Char } = platform;
    this.Char = Char;
    this.mode = mode;

    this.accessory.getService(Svc.AccessoryInformation)!
      .setCharacteristic(Char.Manufacturer, 'AlAdhan')
      .setCharacteristic(Char.Model, 'Prayer Countdown')
      .setCharacteristic(Char.SerialNumber, 'prayer-countdown')
      .setCharacteristic(Char.FirmwareRevision, PLUGIN_VERSION);

    // Remove the old service type if switching modes
    const oldLight = this.accessory.getService(Svc.LightSensor);
    const oldValve = this.accessory.getService(Svc.Valve);
    if (mode === 'valve' && oldLight) {
      this.accessory.removeService(oldLight);
    } else if (mode === 'lux' && oldValve) {
      this.accessory.removeService(oldValve);
    }

    if (mode === 'valve') {
      this.service = this.accessory.getService(Svc.Valve)
        || this.accessory.addService(Svc.Valve, 'Next Prayer');

      this.service.getCharacteristic(Char.ValveType)
        .updateValue(Char.ValveType.GENERIC_VALVE);

      this.service.getCharacteristic(Char.Active)
        .onGet(() => this.accessory.context.countdownActive
          ? Char.Active.ACTIVE : Char.Active.INACTIVE)
        .onSet(() => {
          // Read-only — ignore set attempts
        });

      this.service.getCharacteristic(Char.InUse)
        .onGet(() => this.accessory.context.countdownActive
          ? Char.InUse.IN_USE : Char.InUse.NOT_IN_USE);

      this.service.getCharacteristic(Char.RemainingDuration)
        .setProps({ maxValue: 86400 })
        .onGet(() => this.accessory.context.countdownSeconds ?? 0);
    } else {
      this.service = this.accessory.getService(Svc.LightSensor)
        || this.accessory.addService(Svc.LightSensor, 'Next Prayer');

      this.service.getCharacteristic(Char.CurrentAmbientLightLevel)
        .onGet(() => this.accessory.context.countdownMinutes ?? 0.0001);
    }
  }

  updateCountdown(minutes: number): void {
    if (this.mode === 'valve') {
      const seconds = Math.min(Math.max(minutes * 60, 0), 86400);
      const isActive = minutes > 0;
      this.accessory.context.countdownSeconds = seconds;
      this.accessory.context.countdownActive = isActive;
      this.service.updateCharacteristic(this.Char.Active,
        isActive ? this.Char.Active.ACTIVE : this.Char.Active.INACTIVE);
      this.service.updateCharacteristic(this.Char.InUse,
        isActive ? this.Char.InUse.IN_USE : this.Char.InUse.NOT_IN_USE);
      this.service.updateCharacteristic(this.Char.RemainingDuration, seconds);
    } else {
      const value = Math.min(Math.max(minutes, 0.0001), 100000);
      this.accessory.context.countdownMinutes = value;
      this.service.updateCharacteristic(this.Char.CurrentAmbientLightLevel, value);
    }
    this.platform.log.debug(`Countdown: ${minutes} minutes`);
  }
}
