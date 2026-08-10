import { describe, expect, it } from 'vitest';

import { advanceBloodMoonSurvival, getBloodMoonState } from '../js/bloodMoonCycle.js';

describe('blood moon cycle', () => {
    it('treats every third night as one continuous blood moon from evening until morning', () => {
        const dayDuration = 300;

        expect(getBloodMoonState(dayDuration * 2.1, dayDuration, 3)).toEqual(expect.objectContaining({
            active: false,
            warning: false
        }));
        expect(getBloodMoonState(dayDuration * 2.7, dayDuration, 3)).toEqual(expect.objectContaining({
            active: false,
            warning: true
        }));
        expect(getBloodMoonState(dayDuration * 2.8, dayDuration, 3)).toEqual(expect.objectContaining({
            active: true,
            nightIndex: 2
        }));
        expect(getBloodMoonState(dayDuration * 3.1, dayDuration, 3)).toEqual(expect.objectContaining({
            active: true,
            nightIndex: 2
        }));
        expect(getBloodMoonState(dayDuration * 3.25, dayDuration, 3)).toEqual(expect.objectContaining({
            active: false,
            warning: false
        }));
    });

    it('rejects a night with a death and accepts the next fully survived blood moon', () => {
        const dayDuration = 300;
        let progress = advanceBloodMoonSurvival(null, {
            previousTime: dayDuration * 2.74,
            currentTime: dayDuration * 2.76,
            dayDuration,
            interval: 3,
            alive: true
        });

        expect(progress).toEqual({
            state: { activeNight: 2, failedNight: null },
            survivedNight: null
        });

        progress = advanceBloodMoonSurvival(progress.state, {
            previousTime: dayDuration * 2.9,
            currentTime: dayDuration * 2.9,
            dayDuration,
            interval: 3,
            alive: false
        });
        expect(progress.state).toEqual({ activeNight: null, failedNight: 2 });

        progress = advanceBloodMoonSurvival(progress.state, {
            previousTime: dayDuration * 2.91,
            currentTime: dayDuration * 2.92,
            dayDuration,
            interval: 3,
            alive: true
        });
        expect(progress.state).toEqual({ activeNight: null, failedNight: 2 });

        progress = advanceBloodMoonSurvival(progress.state, {
            previousTime: dayDuration * 3.24,
            currentTime: dayDuration * 3.25,
            dayDuration,
            interval: 3,
            alive: true
        });
        expect(progress.survivedNight).toBeNull();

        progress = advanceBloodMoonSurvival(progress.state, {
            previousTime: dayDuration * 5.74,
            currentTime: dayDuration * 5.76,
            dayDuration,
            interval: 3,
            alive: true
        });
        progress = advanceBloodMoonSurvival(progress.state, {
            previousTime: dayDuration * 6.24,
            currentTime: dayDuration * 6.25,
            dayDuration,
            interval: 3,
            alive: true
        });

        expect(progress).toEqual({
            state: { activeNight: null, failedNight: null },
            survivedNight: 5
        });
    });
});
