export function getDayRatio(time, dayDuration) {
    if (!Number.isFinite(time) || dayDuration <= 0) return 0.45;
    return (time % dayDuration) / dayDuration;
}

export function isNight(dayRatio) {
    return dayRatio < 0.25 || dayRatio > 0.75;
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
