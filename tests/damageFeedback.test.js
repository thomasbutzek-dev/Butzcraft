import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageFeedback } from '../js/damageFeedback.js';

describe('DamageFeedback', () => {
    let now;

    beforeEach(() => {
        document.body.innerHTML = '<canvas id="game"></canvas>';
        now = vi.spyOn(performance, 'now').mockReturnValue(1000);
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            callback();
            return 1;
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it('owns the damage flash and resets the canvas shake after its duration', () => {
        const canvas = document.getElementById('game');
        const feedback = new DamageFeedback(canvas);

        feedback.trigger(8);
        expect(document.getElementById('damage-flash')).not.toBeNull();

        now.mockReturnValue(1075);
        feedback.update();
        expect(canvas.style.transform).toContain('rotate(');

        now.mockReturnValue(1150);
        feedback.update();
        expect(canvas.style.transform).toBe('');

        feedback.dispose();
        expect(document.getElementById('damage-flash')).toBeNull();
    });
});
