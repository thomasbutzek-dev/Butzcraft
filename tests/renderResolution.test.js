import { describe, expect, it } from 'vitest';
import { calculateRenderPixelRatio, MAX_RENDER_PIXELS } from '../js/renderResolution.js';

describe('calculateRenderPixelRatio', () => {
    it('keeps ordinary 1080p rendering unchanged', () => {
        expect(calculateRenderPixelRatio(1920, 1080, 1, 1)).toBe(1);
    });

    it('keeps a high-DPI 720p viewport within the pixel budget', () => {
        const ratio = calculateRenderPixelRatio(1280, 720, 2, 1);
        expect(ratio).toBe(2);
        expect(1280 * 720 * ratio * ratio).toBeLessThanOrEqual(MAX_RENDER_PIXELS);
    });

    it('caps a 4K framebuffer instead of rendering more than eight million pixels', () => {
        const ratio = calculateRenderPixelRatio(3840, 2160, 1, 1);
        expect(ratio).toBeCloseTo(Math.sqrt(MAX_RENDER_PIXELS / (3840 * 2160)));
        expect(3840 * 2160 * ratio * ratio).toBeLessThanOrEqual(MAX_RENDER_PIXELS);
    });

    it('preserves an explicitly reduced scale when it is already cheaper', () => {
        expect(calculateRenderPixelRatio(3840, 2160, 1, 0.5)).toBe(0.5);
    });
});
