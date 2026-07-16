import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('start menu loading feedback', () => {
    it('associates the live engine status with the start button', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const startButton = document.getElementById('start-button');
        const status = document.getElementById('mobile-start-status');

        expect(startButton.getAttribute('aria-describedby')).toBe('mobile-start-status');
        expect(status.getAttribute('role')).toBe('status');
        expect(status.getAttribute('aria-live')).toBe('polite');
        expect(status.getAttribute('aria-atomic')).toBe('true');
    });
});

describe('first-day objective HUD', () => {
    it('exposes one atomic objective with seven visible progress steps', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const objective = document.getElementById('first-objective');

        expect(objective.getAttribute('role')).toBe('status');
        expect(objective.getAttribute('aria-live')).toBe('polite');
        expect(objective.getAttribute('aria-atomic')).toBe('true');
        expect(objective.querySelectorAll('#first-objective-progress i')).toHaveLength(7);
        expect(document.querySelectorAll('#first-objective')).toHaveLength(1);
    });
});
