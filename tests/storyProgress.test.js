import { describe, expect, it } from 'vitest';

import {
    STORY_EVENTS,
    advanceStoryProgress,
    getStoryProgress
} from '../js/storyProgress.js';

describe('long-term story progress', () => {
    it('starts with surviving the first night', () => {
        expect(getStoryProgress(0, { dayCount: 0 })).toEqual({
            index: 0,
            objective: expect.objectContaining({
                label: 'Deine Reise',
                text: 'Überstehe deine erste Nacht',
                step: 1,
                total: 5
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

    it('only accepts the event belonging to the current objective', () => {
        expect(advanceStoryProgress(1, STORY_EVENTS.QUEST_COMPLETED)).toBe(1);
        expect(advanceStoryProgress(1, STORY_EVENTS.VILLAGER_MET)).toBe(2);
        expect(advanceStoryProgress(2, STORY_EVENTS.QUEST_COMPLETED)).toBe(3);
        expect(advanceStoryProgress(3, STORY_EVENTS.BLOOD_MOON_SURVIVED)).toBe(4);
    });

    it('never regresses restored progress and opens the sandbox epilogue after the blood moon', () => {
        expect(getStoryProgress(3, { dayCount: 0 }).index).toBe(3);
        expect(getStoryProgress(4, { dayCount: 10 })).toEqual({
            index: 4,
            objective: expect.objectContaining({
                label: 'Freie Reise',
                text: 'Schreibe deine eigene Geschichte',
                step: 5,
                total: 5
            })
        });
    });
});
