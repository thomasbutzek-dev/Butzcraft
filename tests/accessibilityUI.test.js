import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('accessible gameplay dialogs', () => {
    it('labels every blocking gameplay overlay as a modal dialog', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const dialogIds = ['instructions', 'inventory-overlay', 'furnace-overlay', 'chest-overlay', 'trade-overlay'];

        dialogIds.forEach(id => {
            const dialog = document.getElementById(id);
            expect(dialog.getAttribute('role'), id).toBe('dialog');
            expect(dialog.getAttribute('aria-modal'), id).toBe('true');
            expect(dialog.getAttribute('aria-labelledby'), id).toBeTruthy();
            expect(dialog.getAttribute('aria-hidden'), id).toBe('true');
        });
    });

    it('provides global focus visibility and reduced-motion fallbacks', () => {
        const styles = readFileSync('style.css', 'utf8');

        expect(styles).toContain('[tabindex]:not([tabindex="-1"])):focus-visible');
        expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
        expect(styles).toContain('animation-duration: 0.01ms !important');
        expect(styles).toContain('transition-duration: 0.01ms !important');
    });

    it('keeps the inventory close action in a dedicated header above the tutorial', () => {
        const html = readFileSync('index.html', 'utf8');
        const document = new DOMParser().parseFromString(html, 'text/html');
        const header = document.getElementById('inventory-header');

        expect(header).not.toBeNull();
        expect(header.contains(document.getElementById('inventory-title'))).toBe(true);
        expect(header.contains(document.getElementById('inventory-close-btn'))).toBe(true);
        expect(header.nextElementSibling.id).toBe('inventory-objective');
    });
});
