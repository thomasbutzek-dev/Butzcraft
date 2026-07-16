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
                total: 4
            })
        });
    });

    it('moves to the village objective after the first night', () => {
        expect(getStoryProgress(0, { dayCount: 1 })).toEqual({
            index: 1,
            objective: expect.objectContaining({
                text: 'Finde ein Dorf',
                step: 2
            })
        });
    });

    it('only accepts the event belonging to the current objective', () => {
        expect(advanceStoryProgress(1, STORY_EVENTS.QUEST_COMPLETED)).toBe(1);
        expect(advanceStoryProgress(1, STORY_EVENTS.VILLAGER_MET)).toBe(2);
        expect(advanceStoryProgress(2, STORY_EVENTS.QUEST_COMPLETED)).toBe(3);
        expect(advanceStoryProgress(3, STORY_EVENTS.BLOOD_MOON_SURVIVED)).toBe(4);
    });

    it('never regresses restored progress and ends after the blood moon', () => {
        expect(getStoryProgress(3, { dayCount: 0 }).index).toBe(3);
        expect(getStoryProgress(4, { dayCount: 10 })).toEqual({ index: 4, objective: null });
    });
});
