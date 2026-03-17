# Changelog

## 1.0.2 (2026-03-17)

### Bug Fixes

- **Timezone fix** — prayer times are now scheduled in the configured timezone, not the machine's local timezone. Previously, if the machine was set to UTC but the location was Asia/Riyadh (UTC+3), prayers would be scheduled 3 hours late. The config timezone always takes priority (config > API-detected > machine local), which is critical for Docker/Ubuntu setups that default to UTC.
- **Date calculation** — the API date request now uses the configured timezone to determine "today", fixing edge cases near midnight where the machine date differs from the location date.
- **Daily refresh** — the 00:05 daily refresh now fires at 00:05 in the configured timezone, not the machine's timezone.
- **Scheduling timezone log** — the plugin now logs which timezone is being used for scheduling so users can verify their config.
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
