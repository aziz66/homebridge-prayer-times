# Changelog

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
