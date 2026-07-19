import { describe, expect, it } from 'vitest';
import { FrameRateTracker } from '../js/frameRateTracker.js';

describe('FrameRateTracker', () => {
    it('reports current, minimum and maximum FPS across completed sample windows', () => {
        const tracker = new FrameRateTracker(500);
        tracker.reset(0);

        let sample = null;
        for (let frame = 1; frame < 30; frame++) sample = tracker.record(frame * 16, true) || sample;
        sample = tracker.record(500, true) || sample;
        expect(sample).toEqual({ current: 60, min: 60, max: 60 });

        for (let frame = 1; frame < 15; frame++) sample = tracker.record(500 + frame * 33, true) || sample;
        sample = tracker.record(1000, true) || sample;
        expect(sample).toEqual({ current: 30, min: 30, max: 60 });
    });

    it('drops an inactive partial window without losing session extrema', () => {
        const tracker = new FrameRateTracker(500);
        tracker.reset(0);

        let sample = null;
        for (let frame = 1; frame < 30; frame++) sample = tracker.record(frame * 16, true) || sample;
        sample = tracker.record(500, true) || sample;
        tracker.record(650, false);

        for (let frame = 1; frame <= 20; frame++) {
            sample = tracker.record(650 + frame * 25, true) || sample;
        }
        expect(sample).toEqual({ current: 40, min: 40, max: 60 });
    });

    it('does not count a suspended animation frame as a zero-FPS window', () => {
        const tracker = new FrameRateTracker(500);
        tracker.reset(0);

        let sample = null;
        for (let frame = 1; frame <= 30; frame++) {
            sample = tracker.record(frame * 17, true) || sample;
        }
        expect(sample.min).toBeGreaterThan(0);

        tracker.record(8000, true);
        for (let frame = 1; frame <= 30; frame++) {
            sample = tracker.record(8000 + frame * 17, true) || sample;
        }

        expect(sample.current).toBeGreaterThan(0);
        expect(sample.min).toBeGreaterThan(0);
    });
});
