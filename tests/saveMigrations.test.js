/* tests/saveMigrations.test.js
 *
 * Tests für das Versions-basierte Migrations-System. Decken ab:
 *  - v0 (Legacy) → v1 (Array-Inventory) Konvertierung
 *  - Bereits-aktuelle Saves bleiben unverändert (Idempotenz)
 *  - Migrations sind nicht-destruktiv für andere Felder (pos, health, time)
 *  - stampSaveVersion setzt korrekt die Version
 */
import { describe, it, expect } from 'vitest';
import { migrateSave, stampSaveVersion, CURRENT_SAVE_VERSION } from '../js/saveMigrations.js';

describe('migrateSave – v0 → v1 (Inventory-Format)', () => {
    it('konvertiert Legacy-Inventory-Objekt zu Array', () => {
        const legacy = {
            // version fehlt → wird als v0 behandelt
            pos: { x: 0, y: 50, z: 0 },
            health: 100,
            inventory: { '1': 64, '3': 32 } // GRASS=64, STONE=32 in Legacy-Map
        };
        const migrated = migrateSave(legacy);
        expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
        expect(Array.isArray(migrated.inventory)).toBe(true);
        expect(migrated.inventory.length).toBe(64);
        // OLD_INVENTORY_MAP: '1' → slot 0 (type=1, count=64), '3' → slot 2 (type=3, count=32)
        expect(migrated.inventory[0]).toEqual({ type: 1, count: 64 });
        expect(migrated.inventory[2]).toEqual({ type: 3, count: 32 });
    });

    it('lässt pos/health/time unverändert', () => {
        const legacy = {
            pos: { x: 100, y: 50, z: -200 },
            health: 75,
            hunger: 60,
            time: 1234,
            inventory: { '1': 5 }
        };
        const migrated = migrateSave(legacy);
        expect(migrated.pos).toEqual({ x: 100, y: 50, z: -200 });
        expect(migrated.health).toBe(75);
        expect(migrated.hunger).toBe(60);
        expect(migrated.time).toBe(1234);
    });
});

describe('migrateSave – Idempotenz', () => {
    it('lässt aktuelles Save unverändert (keine erneute Konversion)', () => {
        const current = {
            version: CURRENT_SAVE_VERSION,
            inventory: [{ type: 1, count: 5 }, { type: 0, count: 0 }],
            pos: { x: 0, y: 50, z: 0 }
        };
        const migrated = migrateSave(current);
        expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
        expect(migrated.inventory).toBe(current.inventory); // gleiche Referenz
    });

    it('mehrfache migrateSave-Aufrufe sind safe', () => {
        const legacy = { inventory: { '1': 10 } };
        const once = migrateSave(legacy);
        const twice = migrateSave(once);
        expect(twice.version).toBe(CURRENT_SAVE_VERSION);
        expect(twice.inventory).toEqual(once.inventory);
    });
});

describe('migrateSave – Edge Cases', () => {
    it('null/undefined gehen unverändert durch', () => {
        expect(migrateSave(null)).toBeNull();
        expect(migrateSave(undefined)).toBeUndefined();
    });

    it('Save ohne inventory bleibt valide', () => {
        const data = { pos: { x: 0, y: 50, z: 0 }, health: 100 };
        const migrated = migrateSave(data);
        expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
        expect(migrated.pos).toEqual({ x: 0, y: 50, z: 0 });
    });

    it('ergaenzt Blood-Moon-Reward-State fuer alte Saves', () => {
        const data = { version: 4, inventory: [] };
        const migrated = migrateSave(data);
        expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
        expect(migrated.lastBloodMoonRewardDay).toBe(-1);
    });

    it('ergaenzt Onboarding- und ausstehenden Reward-State ab Version 6', () => {
        const data = { version: 5, inventory: [] };

        const migrated = migrateSave(data);

        expect(migrated.version).toBe(6);
        expect(migrated.onboardingObjectiveIndex).toBe(0);
        expect(migrated.pendingBloodMoonRewardDay).toBe(-1);
    });
});

describe('stampSaveVersion', () => {
    it('setzt die aktuelle Version', () => {
        const data = { foo: 'bar' };
        const stamped = stampSaveVersion(data);
        expect(stamped.version).toBe(CURRENT_SAVE_VERSION);
        expect(stamped.foo).toBe('bar');
    });

    it('überschreibt eine veraltete Version', () => {
        const data = { version: 0, foo: 'bar' };
        const stamped = stampSaveVersion(data);
        expect(stamped.version).toBe(CURRENT_SAVE_VERSION);
    });

    it('null wird unverändert zurückgegeben', () => {
        expect(stampSaveVersion(null)).toBeNull();
    });
});
