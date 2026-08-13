import { describe, expect, it } from 'vitest';

import {
    getCompassGuidance,
    getCompassHeadingDegrees,
    getRelativeCompassBearing,
    resolveHomeTarget,
    resolveMainQuestTarget,
    resolveRitualSite,
    resolveSideQuestTarget
} from '../js/questNavigation.js';

describe('quest compass guidance', () => {
    it('reports direction and distance to a tracked target', () => {
        expect(getCompassGuidance(
            { x: 0, z: 0 },
            { x: 30, z: -40 }
        )).toEqual(expect.objectContaining({
            distance: 50,
            directionName: 'nordöstlich'
        }));
    });

    it('returns a search area for an undiscovered target', () => {
        const guidance = getCompassGuidance(
            { x: 0, z: 0 },
            { x: 96, z: 12, discovered: false, searchRadius: 40 }
        );

        expect(guidance.exact).toBe(false);
        expect(guidance.searchRadius).toBe(40);
        expect(guidance.displayDistance % 50).toBe(0);
    });
});

describe('quest compass orientation', () => {
    it('points straight up while the camera faces the target', () => {
        const eastBearing = getCompassGuidance(
            { x: 0, z: 0 },
            { x: 10, z: 0 }
        ).bearing;
        const eastHeading = getCompassHeadingDegrees(-Math.PI / 2);

        expect(getRelativeCompassBearing(eastBearing, eastHeading)).toBe(0);
    });

    it('uses the shortest rotation across north', () => {
        expect(getRelativeCompassBearing(0, 270)).toBe(90);
        expect(getRelativeCompassBearing(270, 0)).toBe(-90);
    });
});

describe('home compass target', () => {
    it('uses the last bed while either bed half still exists', () => {
        const target = resolveHomeTarget({ x: 5, y: 20, z: -3 }, () => 38);

        expect(target).toEqual({ x: 5.5, y: 20.5, z: -2.5, kind: 'home', discovered: true });
    });

    it('invalidates home after the saved bed is destroyed', () => {
        expect(resolveHomeTarget({ x: 5, y: 20, z: -3 }, () => 0)).toBeNull();
        expect(resolveHomeTarget(null, () => 38)).toBeNull();
    });
});

describe('main quest targets', () => {
    const village = { id: 'village:1,2', center: { x: 20, z: 10 }, isHome: true };
    const structures = new Map([
        ['mine:far', { id: 'mine:far', kind: 'mine', x: 200, z: 0 }],
        ['mine:near', { id: 'mine:near', kind: 'mine', x: 100, z: 0 }],
        ['dungeon:near', { id: 'dungeon:near', kind: 'dungeon', x: 0, z: 120 }]
    ]);

    it('uses villages only for village objectives', () => {
        expect(resolveMainQuestTarget({
            mainQuestIndex: 2,
            playerPosition: { x: 0, z: 0 },
            knownVillages: [village]
        })).toEqual(expect.objectContaining({
            x: 20,
            z: 10,
            label: 'Auftragsdorf'
        }));
        expect(resolveMainQuestTarget({
            mainQuestIndex: 3,
            playerPosition: { x: 0, z: 0 },
            knownVillages: [village]
        })).toBeNull();
    });

    it('uses the nearest matching structure without falling back to a village', () => {
        expect(resolveMainQuestTarget({
            mainQuestIndex: 4,
            playerPosition: { x: 0, z: 0 },
            knownVillages: [village],
            structures
        })).toEqual(expect.objectContaining({
            x: 100,
            z: 0,
            structureId: 'mine:near',
            label: 'Große Mine',
            discovered: false
        }));
        expect(resolveMainQuestTarget({
            mainQuestIndex: 4,
            playerPosition: { x: 0, z: 0 },
            knownVillages: [village],
            structures: new Map()
        })).toBeNull();
    });
});

describe('ritual targets', () => {
    const structures = new Map([
        ['dungeon:near', {
            id: 'dungeon:near',
            kind: 'dungeon',
            x: 20,
            z: 0,
            altar: { interaction: { x: 24, y: 18, z: 6 } }
        }],
        ['dungeon:ritual', {
            id: 'dungeon:ritual',
            kind: 'dungeon',
            x: 200,
            z: 0,
            altar: { interaction: { x: 212, y: 14, z: -8 } }
        }]
    ]);
    const ritualSite = {
        structureId: 'dungeon:ritual',
        position: { x: 204, y: 13, z: -4 }
    };

    it('corrects a stored legacy coordinate from the matching altar metadata', () => {
        expect(resolveRitualSite(ritualSite, structures)).toEqual({
            structureId: 'dungeon:ritual',
            position: { x: 212, y: 14, z: -8 }
        });
    });

    it('uses the stored dungeon instead of a nearer dungeon for ritual and boss steps', () => {
        expect(resolveMainQuestTarget({
            mainQuestIndex: 8,
            playerPosition: { x: 0, z: 0 },
            structures,
            ritualSite
        })).toEqual(expect.objectContaining({
            x: 212,
            y: 14,
            z: -8,
            structureId: 'dungeon:ritual',
            label: 'Ritualaltar'
        }));
        expect(resolveMainQuestTarget({
            mainQuestIndex: 9,
            playerPosition: { x: 0, z: 0 },
            structures,
            ritualSite
        })).toEqual(expect.objectContaining({
            structureId: 'dungeon:ritual',
            label: 'Blutmondwächter'
        }));
    });

    it('does not fall back to an arbitrary dungeon without a saved ritual site', () => {
        expect(resolveMainQuestTarget({
            mainQuestIndex: 8,
            playerPosition: { x: 0, z: 0 },
            structures
        })).toBeNull();
    });

    it('guides an active blood moon echo quest to the saved altar', () => {
        expect(resolveSideQuestTarget({
            quest: {
                objective: {
                    type: 'boss',
                    bossType: 'bloodMoonEcho',
                    required: 1,
                    current: 0
                }
            },
            progressComplete: false,
            structures,
            ritualSite
        })).toEqual(expect.objectContaining({
            x: 212,
            z: -8,
            structureId: 'dungeon:ritual'
        }));
    });
});

describe('side quest targets', () => {
    const village = { center: { x: 20, z: 10 } };
    const structures = new Map([
        ['mine:near', { id: 'mine:near', kind: 'mine', x: 100, z: 0 }]
    ]);

    it('hides activity-less targets and points completed quests back to the village', () => {
        const quest = {
            objective: { type: 'delivery', itemType: 60, required: 12 }
        };

        expect(resolveSideQuestTarget({
            quest,
            progressComplete: false,
            village,
            playerPosition: { x: 0, z: 0 }
        })).toBeNull();
        expect(resolveSideQuestTarget({
            quest,
            progressComplete: true,
            village,
            playerPosition: { x: 0, z: 0 }
        })).toEqual(expect.objectContaining({
            x: 20,
            z: 10,
            handIn: true
        }));
    });

    it('points placement quests to the village', () => {
        expect(resolveSideQuestTarget({
            quest: { objective: { type: 'place', itemType: 102, required: 8 } },
            progressComplete: false,
            village
        })).toEqual(expect.objectContaining({
            x: 20,
            z: 10,
            discovered: true
        }));
    });

    it('shows an undiscovered structure as a search area and an approached one exactly', () => {
        const quest = {
            objective: {
                type: 'structure',
                structureKind: 'mine',
                required: 1,
                target: { x: 20, z: 10 }
            }
        };

        expect(resolveSideQuestTarget({
            quest,
            progressComplete: false,
            village,
            playerPosition: { x: 0, z: 0 },
            structures
        })).toEqual(expect.objectContaining({
            x: 100,
            z: 0,
            structureId: 'mine:near',
            discovered: false
        }));
        expect(resolveSideQuestTarget({
            quest,
            progressComplete: false,
            village,
            playerPosition: { x: 30, z: 0 },
            structures
        })).toEqual(expect.objectContaining({
            structureId: 'mine:near',
            discovered: true
        }));
    });
});
