import { describe, expect, it } from 'vitest';
import { FrameRateTracker, FrameTimeRecorder } from '../js/frameRateTracker.js';

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

describe('FrameTimeRecorder', () => {
    it('reports frame-time percentiles, budget overruns and diagnostic ranges', () => {
        const recorder = new FrameTimeRecorder({ durationMs: 100 });
        recorder.start(0, { scenario: 'test' });
        recorder.record(10, true, {
            chunks: 4,
            usedJsHeapMiB: 10,
            playerX: 0,
            playerY: 40,
            playerZ: 0,
            playerChunkX: 0,
            playerChunkZ: 0
        }, { workerGenerationMs: [4] });

        let report = null;
        for (const [now, chunks, heap] of [
            [20, 5, 11],
            [30, 6, 12],
            [50, 7, 13],
            [90, 8, 15],
            [140, 9, 14]
        ]) {
            report = recorder.record(now, true, {
                chunks,
                usedJsHeapMiB: heap,
                playerX: chunks * 4,
                playerY: 40,
                playerZ: 0,
                playerChunkX: Math.floor(chunks / 4),
                playerChunkZ: 0
            }, { workerGenerationMs: [chunks] }) || report;
        }

        expect(report.frameTimeMs).toEqual({ p50: 20, p95: 48, p99: 49.6, worst: 50 });
        expect(report.frameBudget.over16_7ms).toEqual({ count: 3, percent: 60 });
        expect(report.frameBudget.over33_3ms).toEqual({ count: 2, percent: 40 });
        expect(report.frameBudget.over50ms).toEqual({ count: 0, percent: 0 });
        expect(report.diagnostics.chunks).toEqual({ first: 4, last: 9, min: 4, max: 9 });
        expect(report.diagnostics.usedJsHeapMiB).toEqual({ first: 10, last: 14, min: 10, max: 15 });
        expect(report.phaseTimeMs.workerGenerationMs).toEqual({ count: 6, p50: 6.5, p95: 8.75, worst: 9 });
        expect(report.traversal).toEqual({
            start: { x: 0, y: 40, z: 0, chunkX: 0, chunkZ: 0 },
            end: { x: 36, y: 40, z: 0, chunkX: 2, chunkZ: 0 },
            horizontalDistanceBlocks: 36,
            uniqueChunks: 3,
            chunkTransitions: 2
        });
        expect(report.metadata).toEqual({ scenario: 'test' });
    });

    it('pauses cleanly and excludes animation suspension gaps', () => {
        const recorder = new FrameTimeRecorder({ durationMs: 30, maxFrameGapMs: 100 });
        recorder.start(0);
        recorder.record(10, true);
        recorder.record(20, true);
        recorder.record(500, false);
        recorder.record(510, true);
        recorder.record(710, true);
        recorder.record(720, true);
        const report = recorder.record(730, true);

        expect(report.activeDurationMs).toBe(30);
        expect(report.frameCount).toBe(3);
        expect(report.excludedFrameGaps).toBe(1);
        expect(report.frameTimeMs.worst).toBe(10);
    });

    it('can produce a partial report when stopped manually', () => {
        const recorder = new FrameTimeRecorder({ durationMs: 30000 });
        recorder.start(0);
        recorder.record(16, true);
        recorder.record(32, true);

        const report = recorder.stop();

        expect(report.reason).toBe('manual');
        expect(report.activeDurationMs).toBe(16);
        expect(recorder.getStatus().running).toBe(false);
    });
});
