import { describe, expect, it } from 'vitest';

import {
    STORY_EVENTS,
    advanceStoryProgress,
    getStoryProgress,
    reconcileStoryProgress,
    recordStoryMilestone
} from '../js/storyProgress.js';

describe('long-term story progress', () => {
    it('starts with surviving the first night', () => {
        expect(getStoryProgress(0, { dayCount: 0 })).toEqual({
            index: 0,
            objective: expect.objectContaining({
                label: 'Deine Reise',
                text: 'Überstehe deine erste Nacht',
                step: 1,
                total: 11
            })
        });
    });

    it('moves to the village objective after the first night', () => {
        expect(getStoryProgress(0, { dayCount: 1 })).toEqual({
            index: 1,
            objective: expect.objectContaining({
                text: 'Folge den Spuren zu einem Dorf',
                step: 2
            })
        });
    });

    it('points toward the nearest known village', () => {
        const progress = getStoryProgress(1, {
            playerPosition: { x: 0, z: 0 },
            villages: [
                { houses: [{ x: 300, z: 300 }] },
                { houses: [{ x: 30, z: -40 }, { x: 30, z: -40 }] }
            ]
        });

        expect(progress.objective.hint).toContain('etwa 50 Blöcke nordöstlich');
        expect(progress.objective.hint).toContain('Rechtsklick');
        expect(progress.objective.touchHint).toContain('Tippe');
    });

    it('explains how village trust advances the journey', () => {
        const progress = getStoryProgress(2);

        expect(progress.objective.hint).toContain('Dorfquest');
        expect(progress.objective.hint).toContain('Vertrauensbelohnung');
        expect(progress.objective.touchHint).toContain('Dorfquest');
    });

    it('states that the first blood moon night must be survived', () => {
        const progress = getStoryProgress(3);

        expect(progress.objective.text).toBe('Überlebe die erste Blutmondnacht');
        expect(progress.objective.hint).toContain('bis zum Morgen');
        expect(progress.objective.hint).toContain('nicht schlafen');
    });

    it('only accepts the event belonging to the current objective', () => {
        expect(advanceStoryProgress(1, STORY_EVENTS.QUEST_COMPLETED)).toBe(1);
        expect(advanceStoryProgress(1, STORY_EVENTS.VILLAGER_MET)).toBe(2);
        expect(advanceStoryProgress(2, STORY_EVENTS.QUEST_COMPLETED)).toBe(2);
        expect(advanceStoryProgress(2, STORY_EVENTS.VILLAGE_TRUST_EARNED)).toBe(3);
        expect(advanceStoryProgress(3, STORY_EVENTS.BLOOD_MOON_SURVIVED)).toBe(4);
        expect(advanceStoryProgress(4, STORY_EVENTS.MINE_COMPLETED)).toBe(5);
        expect(advanceStoryProgress(5, STORY_EVENTS.DUNGEON_KEY_FOUND)).toBe(6);
        expect(advanceStoryProgress(6, STORY_EVENTS.DUNGEON_GATE_OPENED)).toBe(7);
        expect(advanceStoryProgress(7, STORY_EVENTS.DUNGEON_COMPLETED)).toBe(8);
        expect(advanceStoryProgress(8, STORY_EVENTS.RITUAL_ACTIVATED)).toBe(9);
        expect(advanceStoryProgress(9, STORY_EVENTS.BOSS_DEFEATED)).toBe(10);
    });

    it('remembers early milestones and applies them later in story order', () => {
        let milestones = recordStoryMilestone({}, STORY_EVENTS.DUNGEON_KEY_FOUND);

        expect(reconcileStoryProgress(4, milestones)).toBe(4);

        milestones = recordStoryMilestone(milestones, STORY_EVENTS.MINE_COMPLETED);

        expect(reconcileStoryProgress(4, milestones)).toBe(6);
    });

    it('never regresses restored progress and opens the endgame after the boss', () => {
        expect(getStoryProgress(3, { dayCount: 0 }).index).toBe(3);
        expect(getStoryProgress(10, { dayCount: 10 })).toEqual({
            index: 10,
            objective: expect.objectContaining({
                label: 'Neue Gefahren',
                text: 'Stärke die Dörfer und jage Blutmondechos',
                step: 11,
                total: 11
            })
        });
    });
});
