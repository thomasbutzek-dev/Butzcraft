import { describe, expect, it } from 'vitest';

import { getNpcConversation } from '../js/npcDialogue.js';
import { acceptSideQuest, createQuestState, ensureVillageState } from '../js/quests.js';

const villageData = { cx: 1, cz: 2, biome: 'Grasland', houses: [{ x: 20, z: 30 }] };
const npc = {
    villageId: 'village:1,2', displayName: 'Hagen', professionIdx: 0,
    profession: { name: 'Schmied' }
};

describe('NPC conversations', () => {
    it('offers the current profession quest through dialogue choices', () => {
        const state = createQuestState(2);
        const village = ensureVillageState(state, villageData, 0);
        const conversation = getNpcConversation({ npc, questState: state, villageState: village });

        expect(conversation.speaker).toBe('Hagen');
        expect(conversation.text).toContain('Esse');
        expect(conversation.actions.map(action => action.id)).toEqual(['accept', 'ask', 'trade', 'decline']);
    });

    it('changes from progress to turn-in dialogue when the objective is complete', () => {
        const state = createQuestState(4);
        const village = ensureVillageState(state, villageData, 0);
        const offer = getNpcConversation({ npc, questState: state, villageState: village }).quest;
        acceptSideQuest(state, offer);

        const inProgress = getNpcConversation({ npc, questState: state, villageState: village });
        expect(inProgress.phase).toBe('active');
        expect(inProgress.actions[0].id).toBe('progress');

        const inventory = [{ type: 60, count: 12 }];
        const complete = getNpcConversation({ npc, questState: state, villageState: village, inventorySlots: inventory });
        expect(complete.phase).toBe('complete');
        expect(complete.actions[0].id).toBe('turn-in');
    });

    it('reveals story lore without branching the quest state', () => {
        const state = createQuestState(8);
        const village = ensureVillageState(state, villageData, 0);
        const before = JSON.stringify(state);
        const conversation = getNpcConversation({ npc, questState: state, villageState: village });

        expect(conversation.lore).toContain('Altar');
        expect(JSON.stringify(state)).toBe(before);
    });
});
