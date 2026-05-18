import { describe, expect, it } from 'vitest';
import { getDayRatio, getSleepBlockReason, getWakeTime, isNight } from '../js/sleep.js';

describe('sleep helpers', () => {
    it('erkennt Nacht vor und nach Mitternacht', () => {
        expect(isNight(0.1)).toBe(true);
        expect(isNight(0.8)).toBe(true);
        expect(isNight(0.5)).toBe(false);
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
