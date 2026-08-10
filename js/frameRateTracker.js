export class FrameRateTracker {
    constructor(sampleWindowMs = 500) {
        this.sampleWindowMs = sampleWindowMs;
        this.reset(0);
    }

    reset(now) {
        this.windowStartedAt = now;
        this.frameCount = 0;
        this.minimum = Infinity;
        this.maximum = 0;
    }

    record(now, active) {
        if (!active) {
            this.windowStartedAt = now;
            this.frameCount = 0;
            return null;
        }

        this.frameCount++;
        const elapsed = now - this.windowStartedAt;
        if (elapsed > this.sampleWindowMs * 2) {
            this.windowStartedAt = now;
            this.frameCount = 1;
            return null;
        }
        if (elapsed < this.sampleWindowMs) return null;

        const current = Math.max(0, Math.round((this.frameCount * 1000) / elapsed));
        this.minimum = Math.min(this.minimum, current);
        this.maximum = Math.max(this.maximum, current);
        this.windowStartedAt = now;
        this.frameCount = 0;

        return { current, min: this.minimum, max: this.maximum };
    }
}

const FRAME_BUDGETS = [
    ['over16_7ms', 1000 / 60],
    ['over33_3ms', 1000 / 30],
    ['over50ms', 50]
];

function round(value, digits = 2) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function percentile(sortedValues, ratio) {
    if (sortedValues.length === 0) return null;
    const position = (sortedValues.length - 1) * ratio;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sortedValues[lower];
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

function summarizeDiagnostics(samples) {
    const keys = new Set(samples.flatMap(sample => Object.keys(sample || {})));
    return Object.fromEntries([...keys].map(key => {
        const values = samples
            .map(sample => sample?.[key])
            .filter(Number.isFinite);
        if (values.length === 0) return [key, null];
        return [key, {
            first: round(values[0]),
            last: round(values.at(-1)),
            min: round(Math.min(...values)),
            max: round(Math.max(...values))
        }];
    }));
}

function summarizePhaseTimes(samples) {
    return Object.fromEntries(Object.entries(samples).map(([name, values]) => {
        const sorted = [...values].sort((left, right) => left - right);
        return [name, {
            count: sorted.length,
            p50: round(percentile(sorted, 0.5)),
            p95: round(percentile(sorted, 0.95)),
            worst: round(sorted.at(-1))
        }];
    }));
}

function traversalPoint(diagnostics) {
    if (!Number.isFinite(diagnostics?.playerX) || !Number.isFinite(diagnostics?.playerZ)) return null;
    return {
        x: diagnostics.playerX,
        y: Number.isFinite(diagnostics.playerY) ? diagnostics.playerY : null,
        z: diagnostics.playerZ,
        chunkX: Number.isFinite(diagnostics.playerChunkX) ? diagnostics.playerChunkX : null,
        chunkZ: Number.isFinite(diagnostics.playerChunkZ) ? diagnostics.playerChunkZ : null
    };
}

function roundTraversalPoint(point) {
    if (!point) return null;
    return Object.fromEntries(Object.entries(point).map(([key, value]) => [key, round(value)]));
}

export class FrameTimeRecorder {
    constructor({ durationMs = 30000, maxFrameGapMs = 5000 } = {}) {
        this.durationMs = durationMs;
        this.maxFrameGapMs = maxFrameGapMs;
        this.running = false;
        this.lastReport = null;
    }

    start(now = 0, metadata = {}) {
        this.running = true;
        this.startedAt = now;
        this.lastFrameAt = null;
        this.activeDurationMs = 0;
        this.frameTimes = [];
        this.diagnosticSamples = [];
        this.phaseSamples = {};
        this.traversalStart = null;
        this.traversalEnd = null;
        this.lastTraversalPoint = null;
        this.lastTraversalChunk = null;
        this.horizontalDistanceBlocks = 0;
        this.uniqueTraversalChunks = new Set();
        this.chunkTransitions = 0;
        this.excludedFrameGaps = 0;
        this.metadata = { ...metadata };
        this.lastReport = null;
        return this.getStatus();
    }

    record(now, active, diagnostics = {}, phaseTimes = {}) {
        if (!this.running) return null;
        if (!active) {
            this.lastFrameAt = null;
            this.lastTraversalPoint = null;
            this.lastTraversalChunk = null;
            return null;
        }

        if (this.lastFrameAt === null) {
            this.lastFrameAt = now;
            this.diagnosticSamples.push({ ...diagnostics });
            this.recordPhaseTimes(phaseTimes);
            this.recordTraversal(diagnostics);
            return null;
        }

        const frameTimeMs = now - this.lastFrameAt;
        this.lastFrameAt = now;
        if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) return null;
        if (frameTimeMs > this.maxFrameGapMs) {
            this.excludedFrameGaps++;
            this.lastTraversalPoint = null;
            this.lastTraversalChunk = null;
            return null;
        }

        this.frameTimes.push(frameTimeMs);
        this.diagnosticSamples.push({ ...diagnostics });
        this.recordPhaseTimes(phaseTimes);
        this.recordTraversal(diagnostics);
        this.activeDurationMs += frameTimeMs;
        if (this.activeDurationMs < this.durationMs) return null;
        return this.stop('duration');
    }

    recordPhaseTimes(phaseTimes) {
        for (const [name, rawValues] of Object.entries(phaseTimes || {})) {
            const values = Array.isArray(rawValues) ? rawValues : [rawValues];
            const validValues = values.filter(value => Number.isFinite(value) && value >= 0);
            if (validValues.length === 0) continue;
            if (!this.phaseSamples[name]) this.phaseSamples[name] = [];
            this.phaseSamples[name].push(...validValues);
        }
    }

    recordTraversal(diagnostics) {
        const point = traversalPoint(diagnostics);
        if (!point) return;
        if (!this.traversalStart) this.traversalStart = point;
        if (this.lastTraversalPoint) {
            this.horizontalDistanceBlocks += Math.hypot(
                point.x - this.lastTraversalPoint.x,
                point.z - this.lastTraversalPoint.z
            );
        }
        const chunkKey = Number.isFinite(point.chunkX) && Number.isFinite(point.chunkZ)
            ? `${point.chunkX},${point.chunkZ}`
            : null;
        if (chunkKey) {
            this.uniqueTraversalChunks.add(chunkKey);
            if (this.lastTraversalChunk && this.lastTraversalChunk !== chunkKey) this.chunkTransitions++;
        }
        this.traversalEnd = point;
        this.lastTraversalPoint = point;
        this.lastTraversalChunk = chunkKey;
    }

    stop(reason = 'manual') {
        if (!this.running) return this.lastReport;
        this.running = false;
        const sorted = [...this.frameTimes].sort((left, right) => left - right);
        const totalFrameTimeMs = this.frameTimes.reduce((sum, value) => sum + value, 0);
        const frameBudget = Object.fromEntries(FRAME_BUDGETS.map(([name, thresholdMs]) => {
            const count = this.frameTimes.filter(value => value > thresholdMs).length;
            return [name, {
                count,
                percent: round(this.frameTimes.length > 0 ? count / this.frameTimes.length * 100 : 0)
            }];
        }));

        this.lastReport = {
            schemaVersion: 2,
            reason,
            targetDurationMs: this.durationMs,
            activeDurationMs: round(this.activeDurationMs),
            frameCount: this.frameTimes.length,
            excludedFrameGaps: this.excludedFrameGaps,
            averageFps: round(totalFrameTimeMs > 0 ? this.frameTimes.length * 1000 / totalFrameTimeMs : 0),
            frameTimeMs: {
                p50: round(percentile(sorted, 0.5)),
                p95: round(percentile(sorted, 0.95)),
                p99: round(percentile(sorted, 0.99)),
                worst: round(sorted.at(-1))
            },
            frameBudget,
            phaseTimeMs: summarizePhaseTimes(this.phaseSamples),
            diagnostics: summarizeDiagnostics(this.diagnosticSamples),
            traversal: this.traversalStart ? {
                start: roundTraversalPoint(this.traversalStart),
                end: roundTraversalPoint(this.traversalEnd),
                horizontalDistanceBlocks: round(this.horizontalDistanceBlocks),
                uniqueChunks: this.uniqueTraversalChunks.size,
                chunkTransitions: this.chunkTransitions
            } : null,
            metadata: { ...this.metadata }
        };
        return this.lastReport;
    }

    getStatus() {
        return {
            running: this.running,
            activeDurationMs: round(this.activeDurationMs || 0),
            targetDurationMs: this.durationMs,
            frameCount: this.frameTimes?.length || 0
        };
    }
}
