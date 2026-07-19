import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('painterly interface skin', () => {
    it('scopes the warmer interface to graphics variants B and C', () => {
        const styles = readFileSync('style.css', 'utf8');

        expect(styles).toContain(':is(html[data-graphics-variant="B"], html[data-graphics-variant="C"])');
        expect(styles).toContain('--painter-ui-parchment');
        expect(styles).toContain('#bottom-ui');
        expect(styles).toContain('#inventory-overlay');
        expect(styles).toContain('.furnace-panel');
        expect(styles).toContain('.trade-panel');
    });

    it('gives the interactive station panels shared styling hooks', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');

        expect(document.querySelector('.furnace-panel .panel-title')).not.toBeNull();
        expect(document.querySelector('.chest-panel .panel-title')).not.toBeNull();
        expect(document.querySelector('.trade-panel .panel-title')).not.toBeNull();
        expect(document.querySelectorAll('.panel-close-button')).toHaveLength(3);
    });

    it('refreshes the stylesheet URL so browsers receive the new skin', () => {
        const html = readFileSync('index.html', 'utf8');

        expect(html).toContain('style.css?v=20260719b');
    });

    it('keeps filtered recipe entries visually hidden', () => {
        const styles = readFileSync('style.css', 'utf8');

        expect(styles).toContain('#recipe-list-container > [hidden]');
    });

    it('keeps the desktop recipe book beside the inventory content', () => {
        const styles = readFileSync('style.css', 'utf8');
        const desktopRule = styles.match(/\/\* --- INVENTAR OVERLAY --- \*\/\s*#inventory-overlay\s*\{([^}]*)\}/)?.[1] || '';

        expect(desktopRule).toContain('flex-direction: row');
        expect(desktopRule).toContain('justify-content: center');
        expect(desktopRule).toContain('align-items: flex-start');
    });

    it('stretches the desktop recipe book to fill the inventory panel height', () => {
        const styles = readFileSync('style.css', 'utf8');
        const recipeBookRule = styles.match(/\/\* --- REZEPTBUCH STYLES --- \*\/\s*#recipe-book\s*\{([^}]*)\}/)?.[1] || '';

        expect(recipeBookRule).toContain('align-self: stretch');
        expect(recipeBookRule).toContain('height: auto');
        expect(recipeBookRule).toContain('contain: size');
    });

    it('keeps the active hotbar slot inside its frame', () => {
        const styles = readFileSync('style.css', 'utf8');
        const activeSlotRule = styles.match(/\.slot\.active\s*\{([^}]*)\}/)?.[1] || '';

        expect(activeSlotRule).toContain('transform: none');
    });
});
