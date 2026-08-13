import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('start menu loading feedback', () => {
    it('associates the live engine status with the start button', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const startButton = document.getElementById('start-button');
        const status = document.getElementById('mobile-start-status');

        expect(startButton.getAttribute('aria-describedby')).toBe('mobile-experimental-notice mobile-start-status');
        expect(status.getAttribute('role')).toBe('status');
        expect(status.getAttribute('aria-live')).toBe('polite');
        expect(status.getAttribute('aria-atomic')).toBe('true');
    });

    it('explains the experimental mobile version and starts without depending on fullscreen', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const notice = document.getElementById('mobile-experimental-notice');

        expect(notice.textContent).toContain('experimentell');
        expect(notice.textContent).toContain('Desktop-Version');
        expect(document.getElementById('start-without-fullscreen-button')).toBeNull();
        expect(html).toContain("request.call(el, { navigationUI: 'hide' })");
        expect(html).toContain('window.__butzcraftRequestFullscreen();');
        expect(html).toContain('window.__butzcraftBeginGameStart();');
    });

    it('prioritizes the notice and start controls in short mobile landscape viewports', () => {
        const styles = readFileSync('style.css', 'utf8');
        const start = styles.indexOf('@media (pointer: coarse) and (orientation: landscape) and (max-height: 460px)');
        const end = styles.indexOf('.village-chest-warning', start);
        const landscapeRules = styles.slice(start, end);

        expect(landscapeRules).toContain('#start-menu-content');
        expect(landscapeRules).toContain('max-height: calc(100svh - 12px)');
        expect(landscapeRules).toContain('.logo-img');
        expect(landscapeRules).toContain('max-height: 58px');
        expect(landscapeRules).toContain('#start-promise');
        expect(landscapeRules).toContain('display: none');
    });

    it('keeps the menu inside short desktop viewports with its own scroll area', () => {
        const styles = readFileSync('style.css', 'utf8');
        const baseRule = styles.match(/#start-menu-content\s*\{([^}]*)\}/)?.[1] || '';

        expect(baseRule).toContain('max-height: calc(100svh - 24px)');
        expect(baseRule).toContain('overflow-y: auto');
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

    it('keeps the current objective available while crafting in the inventory', () => {
        const html = readFileSync('index.html', 'utf8');
        const source = readFileSync('js/GameMain.js', 'utf8');
        const styles = readFileSync('style.css', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const objective = document.getElementById('inventory-objective');

        expect(objective.getAttribute('role')).toBe('status');
        expect(objective.getAttribute('aria-live')).toBe('polite');
        expect(objective.getAttribute('aria-atomic')).toBe('true');
        expect(source).toContain('updateInventoryObjective();');
        expect(source).toContain('if (!isInventoryOpened() || !objective)');
        expect(styles).toContain('#inventory-objective.visible');
    });

    it('uses a compact top-left objective in short touch landscape viewports', () => {
        const styles = readFileSync('style.css', 'utf8');
        const start = styles.indexOf('@media (pointer: coarse) and (orientation: landscape) and (max-height: 460px)');
        const end = styles.indexOf('.village-chest-warning', start);
        const landscapeRules = styles.slice(start, end);

        expect(landscapeRules).toContain('#first-objective.visible');
        expect(landscapeRules).toContain('left: max(6px, env(safe-area-inset-left))');
        expect(landscapeRules).toContain('width: min(38vw, 240px)');
        expect(landscapeRules).toContain('#first-objective-progress');
        expect(landscapeRules).toContain('display: none');
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

    it('does not reveal screenshot camera controls', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const pauseMenu = document.getElementById('instructions');

        expect(pauseMenu.textContent).not.toContain('V = Kamera wechseln');
        expect(pauseMenu.textContent).not.toContain('MAUSRAD = Third-Person-Zoom');
    });
});

describe('time and performance HUD', () => {
    it('keeps current, minimum and maximum FPS inside the top-right time panel', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const timePanel = document.getElementById('time-info');
        const fpsSummary = document.getElementById('fps-summary');

        expect(timePanel.contains(fpsSummary)).toBe(true);
        expect(fpsSummary.textContent).toContain('Aktuell');
        expect(fpsSummary.textContent).toContain('Min');
        expect(fpsSummary.textContent).toContain('Max');
    });

    it('hides the FPS summary only in touch mode', () => {
        const styles = readFileSync('style.css', 'utf8');
        const touchRule = styles.match(/html\.touch-device\s+#fps-summary\s*\{([^}]*)\}/)?.[1] || '';

        expect(touchRule).toContain('display: none');
        expect(styles).not.toMatch(/#world-time-info\s*\{[^}]*display:\s*none/);
    });
});
