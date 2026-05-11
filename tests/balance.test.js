import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../config.js';

describe('game balance', () => {
    it('zieht Hunger schneller ab als die alte Startbalance', () => {
        expect(CONFIG.GAMEPLAY.HUNGER_LOSS_PASSIVE).toBeGreaterThan(0.02);
        expect(CONFIG.GAMEPLAY.HUNGER_LOSS_MOVE).toBeGreaterThan(0.1);
    });

    it('hat Unterwasser-Atemzeit und langsamen Ertrinkungsschaden', () => {
        expect(CONFIG.GAMEPLAY.UNDERWATER_BREATH_SECONDS).toBeGreaterThan(0);
        expect(CONFIG.GAMEPLAY.UNDERWATER_DAMAGE_PER_SECOND).toBeGreaterThan(0);
        expect(CONFIG.GAMEPLAY.UNDERWATER_DAMAGE_PER_SECOND).toBeLessThan(CONFIG.GAMEPLAY.MAX_HEALTH / 10);
    });

    it('wendet Zombie-Kontaktschaden als Sekundenwert an', () => {
        const source = readFileSync('js/mobs.js', 'utf8');
        expect(source).toContain('ZOMBIE_DAMAGE * delta');
        expect(source).not.toContain('ZOMBIE_DAMAGE * delta * 20');
    });
});
