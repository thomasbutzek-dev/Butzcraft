const NIGHT_START = 0.75;
const MORNING_START = 0.25;
const WARNING_START = 0.65;

function isBloodMoonNight(nightIndex, interval) {
    return nightIndex >= 0 && nightIndex % interval === interval - 1;
}

export function getBloodMoonState(time, dayDuration, interval) {
    const dayIndex = Math.floor(time / dayDuration);
    const dayRatio = (time % dayDuration) / dayDuration;
    const nightIndex = dayRatio > NIGHT_START
        ? dayIndex
        : (dayRatio < MORNING_START ? dayIndex - 1 : null);
    const active = nightIndex !== null && isBloodMoonNight(nightIndex, interval);
    const warning = !active
        && dayRatio > WARNING_START
        && dayRatio <= NIGHT_START
        && isBloodMoonNight(dayIndex, interval);

    return { active, warning, nightIndex };
}

export function normalizeBloodMoonSurvival(rawState) {
    return {
        activeNight: Number.isInteger(rawState?.activeNight) && rawState.activeNight >= 0
            ? rawState.activeNight
            : null,
        failedNight: Number.isInteger(rawState?.failedNight) && rawState.failedNight >= 0
            ? rawState.failedNight
            : null
    };
}

export function advanceBloodMoonSurvival(rawState, {
    previousTime,
    currentTime,
    dayDuration,
    interval,
    alive
}) {
    let state = normalizeBloodMoonSurvival(rawState);
    const previous = getBloodMoonState(previousTime, dayDuration, interval);
    const current = getBloodMoonState(currentTime, dayDuration, interval);
    let survivedNight = null;

    if (!previous.active && current.active && alive && state.failedNight !== current.nightIndex) {
        state = { activeNight: current.nightIndex, failedNight: null };
    }

    if (!alive && (previous.active || current.active)) {
        const failedNight = current.active ? current.nightIndex : previous.nightIndex;
        state = { activeNight: null, failedNight };
    }

    if (previous.active && !current.active) {
        if (alive && state.activeNight === previous.nightIndex && state.failedNight !== previous.nightIndex) {
            survivedNight = previous.nightIndex;
        }
        state = { activeNight: null, failedNight: null };
    }

    return { state, survivedNight };
}
