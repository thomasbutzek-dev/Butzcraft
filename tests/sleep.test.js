import { describe, expect, it } from 'vitest';
import { getAmbientLightIntensity, getDayCycleSpeed, getDayRatio, getSkyLightIntensity, getSleepBlockReason, getWakeTime, isNight } from '../js/sleep.js';

describe('sleep helpers', () => {
    it('erkennt Nacht vor und nach Mitternacht', () => {
        expect(isNight(0.1)).toBe(true);
        expect(isNight(0.8)).toBe(true);
        expect(isNight(0.5)).toBe(false);
    });

    it('macht den Tag doppelt so lang und laesst die Nacht unveraendert', () => {
        const virtualDayDuration = 300;
        const daylightDuration = virtualDayDuration * 0.5 / getDayCycleSpeed(0.5);
        const nightDuration = virtualDayDuration * 0.5 / getDayCycleSpeed(0.9);

        expect(daylightDuration).toBe(300);
        expect(nightDuration).toBe(150);
        expect(getDayCycleSpeed(0.25)).toBe(0.5);
        expect(getDayCycleSpeed(0.75)).toBe(0.5);
    });

    it('haelt die Nachtbeleuchtung auf einem spielbaren Minimum', () => {
        expect(getSkyLightIntensity(0.1)).toBeCloseTo(0.12);
        expect(getSkyLightIntensity(0.5)).toBe(1);
        expect(getAmbientLightIntensity(0.12, 0.18, 0.88)).toBeGreaterThan(0.4);
        expect(getAmbientLightIntensity(1, 0.18, 0.88)).toBeCloseTo(0.88);
    });

    it('blockiert Schlafen am Tag, bei Blutmond und bei Monstern', () => {
        expect(getSleepBlockReason(0.5, false, false)).toBe('day');
        expect(getSleepBlockReason(0.8, true, false)).toBe('bloodMoon');
        expect(getSleepBlockReason(0.8, false, true)).toBe('hostile');
        expect(getSleepBlockReason(0.8, false, false)).toBeNull();
    });

    it('setzt Abend auf den naechsten Morgen und Nacht nach Mitternacht auf denselben Morgen', () => {
        const day = 300;
        expect(getWakeTime(day * 2.8, day)).toBeCloseTo(day * 3.26);
        expect(getWakeTime(day * 3.1, day)).toBeCloseTo(day * 3.26);
        expect(getDayRatio(day * 3.26, day)).toBeCloseTo(0.26);
    });
});
