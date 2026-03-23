# Changelog

## 1.0.5 (2026-03-24)

### Features

- **Valve countdown timer** — the "Next Prayer" countdown now defaults to a Valve service with `RemainingDuration`, which shows a native auto-decrementing timer in Apple Home.
- **Countdown style setting** — users can choose between "Timer (Valve)" (default) or "Light Sensor (Lux)" in the config. The lux mode preserves the original behavior for threshold-based automations.
- Switching modes automatically removes the old service type and creates the new one.

## 1.0.4 (2026-03-23)

### Bug Fixes

- **Config schema** — fixed `required` property to use JSON Schema array syntax instead of boolean on individual fields (Homebridge verification requirement).
- **Dependencies** — removed `package-lock.json` from repo to prevent verification checker from flagging homebridge/hap-nodejs as runtime dependencies.

## 1.0.3 (2026-03-17)

### Bug Fixes

- **Stale sensor reset** — all sensors are now reset to their default state (motion off, contact closed) before scheduling. Previously, changing the city or timezone in the config would leave sensors from the old config stuck in their active state.

## 1.0.2 (2026-03-17)

### Bug Fixes

- **Timezone priority** — config timezone now always takes priority over the API-detected timezone. Critical for Docker/Ubuntu setups where the system timezone is UTC and users explicitly set their timezone in the plugin config.
- **Scheduling timezone log** — the plugin now logs which timezone is being used for scheduling so users can verify their config.

## 1.0.1 (2026-03-17)

### Bug Fixes

- **Timezone fix** — prayer times are now scheduled in the configured timezone, not the machine's local timezone. Previously, if the machine was set to UTC but the location was Asia/Riyadh (UTC+3), prayers would be scheduled 3 hours late.
- **Date calculation** — the API date request now uses the configured timezone to determine "today", fixing edge cases near midnight where the machine date differs from the location date.
- **Daily refresh** — the 00:05 daily refresh now fires at 00:05 in the configured timezone, not the machine's timezone.
- **Node.js 24** — added `^24.0.0` to supported engines.

## 1.0.0 (2025-03-17)

### Features

- **Prayer time sensors** — each prayer (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) exposed as a HomeKit motion sensor and contact sensor
- **Motion sensor** triggers at adhan time and stays active for a configurable `motionDuration` (default 30 min)
- **Contact sensor** opens at adhan time and stays open for a configurable `windowDuration` (default 30 min)
- **Pre-adhan alerts** — optional motion sensors that trigger before each prayer (configurable minutes)
- **Countdown sensor** — optional light sensor showing minutes until the next prayer as a lux value
- **City or coordinates** location modes for flexible configuration
- **24 calculation methods** supported (ISNA, MWL, Umm Al-Qura, Egyptian, Gulf Region, and more)
- **Hanafi/Shafi Asr** school selection
- **Per-prayer toggles** — enable or disable individual prayers
- **Automatic timezone detection** with manual override option
- **Disk caching** — prayer times cached locally so restarts don't require new API calls
- **Daily refresh** at 00:05 fetches the next day's times automatically
- **Progressive retry** — if the API is unreachable, retries at 5min, 30min, then hourly intervals (never gives up)
- **Mid-day restart recovery** — if Homebridge restarts, sensors resume correct state based on elapsed time
- **Zero runtime dependencies** — uses only native Node.js APIs and Homebridge SDK
- **Homebridge UI config** — full settings form via `config.schema.json`
- Prayer times provided by the [AlAdhan API](https://aladhan.com)
