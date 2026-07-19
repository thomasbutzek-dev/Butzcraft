export function getDayRatio(time, dayDuration) {
    if (!Number.isFinite(time) || dayDuration <= 0) return 0.45;
    return (time % dayDuration) / dayDuration;
}

export function isNight(dayRatio) {
    return dayRatio < 0.25 || dayRatio > 0.75;
}

export function getDayCycleSpeed(dayRatio) {
    return isNight(dayRatio) ? 1 : 0.5;
}

export function getSkyLightIntensity(dayRatio) {
    if (dayRatio >= 0.20 && dayRatio < 0.25) return 0.12 + ((dayRatio - 0.20) / 0.05) * 0.28;
    if (dayRatio >= 0.25 && dayRatio < 0.30) return 0.4 + ((dayRatio - 0.25) / 0.05) * 0.6;
    if (dayRatio >= 0.30 && dayRatio <= 0.70) return 1;
    if (dayRatio > 0.70 && dayRatio <= 0.75) return 1 - ((dayRatio - 0.70) / 0.05) * 0.6;
    if (dayRatio > 0.75 && dayRatio <= 0.80) return 0.4 - ((dayRatio - 0.75) / 0.05) * 0.28;
    return 0.12;
}

export function getAmbientLightIntensity(skyIntensity, nightIntensity, dayIntensity) {
    const playableNightIntensity = Math.max(nightIntensity, 0.32);
    const daylight = Math.pow(Math.max(0, Math.min(1, skyIntensity)), 0.7);
    return playableNightIntensity + (dayIntensity - playableNightIntensity) * daylight;
}

export function getWakeTime(time, dayDuration) {
    const dayCount = Math.floor(time / dayDuration);
    const dayRatio = getDayRatio(time, dayDuration);
    const wakeDay = dayRatio > 0.75 ? dayCount + 1 : dayCount;
    return wakeDay * dayDuration + dayDuration * 0.26;
}

export function getSleepBlockReason(dayRatio, isBloodMoon, hostileNearby) {
    if (!isNight(dayRatio)) return 'day';
    if (isBloodMoon) return 'bloodMoon';
    if (hostileNearby) return 'hostile';
    return null;
}
