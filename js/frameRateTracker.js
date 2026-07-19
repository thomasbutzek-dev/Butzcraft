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
