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
  private readonly lightService: Service;
  private readonly Char: typeof Characteristic;

  constructor(
    private readonly platform: PrayerTimesPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    const { Service: Svc, Characteristic: Char } = platform;
    this.Char = Char;

    this.accessory.getService(Svc.AccessoryInformation)!
      .setCharacteristic(Char.Manufacturer, 'AlAdhan')
      .setCharacteristic(Char.Model, 'Prayer Countdown')
      .setCharacteristic(Char.SerialNumber, 'prayer-countdown')
      .setCharacteristic(Char.FirmwareRevision, PLUGIN_VERSION);

    this.lightService = this.accessory.getService(Svc.LightSensor)
      || this.accessory.addService(Svc.LightSensor, 'Next Prayer');

    this.lightService.getCharacteristic(Char.CurrentAmbientLightLevel)
      .onGet(() => this.accessory.context.countdownMinutes ?? 0.0001);
  }

  updateCountdown(minutes: number): void {
    const value = Math.min(Math.max(minutes, 0.0001), 100000);
    this.accessory.context.countdownMinutes = value;
    this.lightService.updateCharacteristic(this.Char.CurrentAmbientLightLevel, value);
    this.platform.log.debug(`Countdown: ${minutes} minutes`);
  }
}
