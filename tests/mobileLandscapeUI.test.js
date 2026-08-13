import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('mobile landscape overlays', () => {
    it('uses the viewport width without page-level overflow', () => {
        const styles = readFileSync('style.css', 'utf8');
        const start = styles.indexOf('@media (pointer: coarse) and (orientation: landscape) and (max-height: 460px)');
        const end = styles.indexOf('.village-chest-warning', start);
        const landscapeRules = styles.slice(start, end);

        expect(landscapeRules).toContain('#inventory-overlay');
        expect(landscapeRules).toContain('flex-direction: row !important');
        expect(landscapeRules).toContain('overflow: hidden !important');
        expect(landscapeRules).toContain('#inventory-main-content');
        expect(landscapeRules).toContain('max-width: none !important');
        expect(landscapeRules).toContain('#recipe-book');
        expect(landscapeRules).toContain('width: min(30vw, 220px) !important');
    });

    it('keeps inventory and quest content inside their own scroll areas', () => {
        const styles = readFileSync('style.css', 'utf8');
        const start = styles.indexOf('@media (pointer: coarse) and (orientation: landscape) and (max-height: 460px)');
        const end = styles.indexOf('.village-chest-warning', start);
        const landscapeRules = styles.slice(start, end);

        expect(landscapeRules).toContain('grid-template-columns: repeat(8, 40px) !important');
        expect(landscapeRules).toContain('#inventory-overlay.quest-view #inventory-main-content');
        expect(landscapeRules).toContain('#quest-journal');
        expect(landscapeRules).toContain('overflow-y: auto');
        expect(styles).toContain('#inventory-overlay[aria-hidden="false"] ~ #touch-overlay');
    });
});
