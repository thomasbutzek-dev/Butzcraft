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
    it('exposes one atomic objective with eleven visible progress steps', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const objective = document.getElementById('first-objective');

        expect(objective.getAttribute('role')).toBe('status');
        expect(objective.getAttribute('aria-live')).toBe('polite');
        expect(objective.getAttribute('aria-atomic')).toBe('true');
        expect(objective.querySelectorAll('#first-objective-progress i')).toHaveLength(11);
        expect(document.querySelectorAll('#first-objective')).toHaveLength(1);
    });
});

describe('pause menu focus', () => {
    it('hides gameplay HUD elements while the pause menu is open', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');
        const styles = readFileSync('style.css', 'utf8');

        expect(source).toContain("document.body.classList.add('game-paused')");
        expect(source).toContain("document.body.classList.remove('game-paused')");
        expect(styles).toContain('body.game-paused #bottom-ui');
        expect(styles).toContain('body.game-paused #top-ui');
    });
});
