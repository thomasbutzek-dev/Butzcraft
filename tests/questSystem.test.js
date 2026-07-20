import { describe, expect, it } from 'vitest';

import {
    MAX_ACTIVE_SIDE_QUESTS,
    abandonSideQuest,
    acceptSideQuest,
    addVillageTrust,
    applyQuestEvent,
    completeSideQuest,
    createQuestState,
    ensureVillageState,
    generateVillageOffers,
    getAdjustedTrade,
    getNpcIdentity,
    getProfessionChainStatus,
    getTrustTier,
    getVillageId,
    grantQuestItem,
    hasQuestItems,
    normalizeQuestState,
    refreshVillageOffers
} from '../js/quests.js';

const grassVillage = {
    cx: 4,
    cz: -2,
    biome: 'Grasland',
    houses: [{ x: 70, z: -30 }, { x: 74, z: -34 }]
};

describe('persistent quest state', () => {
    it('migrates the existing journey index into the new main quest state', () => {
        expect(createQuestState(3)).toEqual(expect.objectContaining({
            mainQuestIndex: 3,
            homeVillageId: null,
            trackedTarget: { kind: 'main' },
            activeSideQuests: [],
            completedQuestIds: [],
            villages: {}
        }));
    });

    it('normalizes malformed collections without losing valid progress', () => {
        const normalized = normalizeQuestState({
            mainQuestIndex: 4,
            activeSideQuests: 'invalid',
            completedQuestIds: ['one'],
            villages: null
        });

        expect(normalized.mainQuestIndex).toBe(4);
        expect(normalized.activeSideQuests).toEqual([]);
        expect(normalized.completedQuestIds).toEqual(['one']);
        expect(normalized.villages).toEqual({});
        expect(normalized.questItems).toEqual({});
    });

    it('keeps story relics outside the normal inventory', () => {
        const state = createQuestState();

        grantQuestItem(state, 'deepCrystal');
        grantQuestItem(state, 'bloodSeal', 2);

        expect(hasQuestItems(state, { deepCrystal: 1, bloodSeal: 2 })).toBe(true);
        expect(hasQuestItems(state, { deepCrystal: 2 })).toBe(false);
        expect(normalizeQuestState(state).questItems).toEqual({ deepCrystal: 1, bloodSeal: 2 });
    });
});

describe('village identity and offers', () => {
    it('creates stable village and named NPC identities', () => {
        expect(getVillageId(grassVillage)).toBe('village:4,-2');
        expect(getNpcIdentity('village:4,-2', 0, 0)).toEqual(
            getNpcIdentity('village:4,-2', 0, 0)
        );
        expect(getNpcIdentity('village:4,-2', 0, 0).name).toMatch(/\S+/);
    });

    it('keeps a deterministic problem profile and three distinct offers', () => {
        const first = generateVillageOffers(grassVillage, 6);
        const second = generateVillageOffers(grassVillage, 6);

        expect(first).toEqual(second);
        expect(first).toHaveLength(3);
        expect(new Set(first.map(offer => offer.templateId))).toHaveLength(3);
        expect(first.every(offer => offer.villageId === 'village:4,-2')).toBe(true);
    });

    it('stores trust and offers independently for every village', () => {
        const state = createQuestState();
        const first = ensureVillageState(state, grassVillage, 0);
        const second = ensureVillageState(state, { ...grassVillage, cx: 9 }, 0);

        addVillageTrust(state, first.id, 7);

        expect(first.trust).toBe(7);
        expect(second.trust).toBe(0);
        expect(first.problemProfile).toBeTruthy();
        expect(first.offers).toHaveLength(3);
    });
});

describe('side quest capacity', () => {
    it('allows at most three simultaneous side quests', () => {
        const state = createQuestState();
        const offers = Array.from({ length: MAX_ACTIVE_SIDE_QUESTS + 1 }, (_, index) => ({
            id: `quest-${index}`,
            villageId: 'village:0,0',
            title: `Quest ${index}`,
            objective: { type: 'delivery', itemType: 3, required: 1 },
            reward: { type: 26, count: 1 },
            trustReward: 1
        }));

        expect(offers.slice(0, 3).map(offer => acceptSideQuest(state, offer).accepted)).toEqual([true, true, true]);
        expect(acceptSideQuest(state, offers[3])).toEqual({ accepted: false, reason: 'quest-limit' });
        expect(state.activeSideQuests).toHaveLength(3);

        expect(abandonSideQuest(state, 'quest-1')).toBe(true);
        expect(acceptSideQuest(state, offers[3]).accepted).toBe(true);
    });
});

describe('profession quest chains', () => {
    it('unlocks the next local profession stage through trust and completion', () => {
        const state = createQuestState();
        const village = ensureVillageState(state, grassVillage, 0);
        const first = getProfessionChainStatus(state, village.id, 0, 10);

        expect(first.state).toBe('available');
        expect(first.quest.title).toBe('Die kalte Esse');
        acceptSideQuest(state, first.quest);
        state.activeSideQuests[0].objective.current = 12;
        completeSideQuest(state, first.quest.id, 1);

        expect(village.professionChainProgress[0]).toBe(1);
        expect(getProfessionChainStatus(state, village.id, 0, 10)).toEqual(expect.objectContaining({
            state: 'locked',
            reason: '3 Vertrauen in diesem Dorf erforderlich.'
        }));

        addVillageTrust(state, village.id, 1);
        expect(getProfessionChainStatus(state, village.id, 0, 10).quest.title).toBe('Werkzeug für die Tiefe');
    });

    it('keeps the librarian endgame stage locked until the story boss is defeated', () => {
        const state = createQuestState();
        const village = ensureVillageState(state, grassVillage, 0);
        village.trust = 12;
        village.professionChainProgress[3] = 2;

        expect(getProfessionChainStatus(state, village.id, 3, 9).state).toBe('locked');
        const endgame = getProfessionChainStatus(state, village.id, 3, 10);
        expect(endgame.state).toBe('available');
        expect(endgame.quest.objective).toMatchObject({ type: 'boss', bossType: 'bloodMoonEcho' });
    });
});

describe('side quest progress', () => {
    it('counts accepted actions only when type, target and location match', () => {
        const state = createQuestState();
        acceptSideQuest(state, {
            id: 'repair',
            villageId: 'village:0,0',
            title: 'Repair',
            objective: {
                type: 'place', itemType: 102, required: 2,
                target: { x: 10, z: 10 }, villageRadius: 12
            },
            reward: { type: 26, count: 1 },
            trustReward: 2
        });

        applyQuestEvent(state, { type: 'place', itemType: 101, position: { x: 10, z: 10 } });
        applyQuestEvent(state, { type: 'place', itemType: 102, position: { x: 40, z: 40 } });
        expect(state.activeSideQuests[0].objective.current).toBe(0);

        applyQuestEvent(state, { type: 'place', itemType: 102, position: { x: 12, z: 12 } });
        expect(state.activeSideQuests[0].objective.current).toBe(1);
    });

    it('completes a quest, awards local trust and frees its slot', () => {
        const state = createQuestState();
        state.villages['village:0,0'] = {
            id: 'village:0,0', trust: 0, nextOfferRefreshDay: 9, offers: []
        };
        acceptSideQuest(state, {
            id: 'hunt', villageId: 'village:0,0', title: 'Hunt',
            objective: { type: 'hunt', mobType: 'zombie', required: 1, current: 0 },
            reward: { type: 61, count: 1 }, trustReward: 2
        });
        applyQuestEvent(state, { type: 'hunt', mobType: 'zombie' });

        const completed = completeSideQuest(state, 'hunt', 4);

        expect(completed.id).toBe('hunt');
        expect(state.activeSideQuests).toEqual([]);
        expect(state.completedQuestIds).toContain('hunt');
        expect(state.villages['village:0,0'].trust).toBe(2);
        expect(state.villages['village:0,0'].nextOfferRefreshDay).toBe(9);
        expect(state.villages['village:0,0'].nextReplacementDay).toBe(5);
    });

    it('replaces only the completed offer next morning', () => {
        const state = createQuestState();
        const village = ensureVillageState(state, grassVillage, 0);
        const originalOffers = [...village.offers];
        const completed = originalOffers[0];
        village.offers = originalOffers.slice(1);
        state.completedQuestIds.push(completed.id);
        village.nextReplacementDay = 2;

        refreshVillageOffers(state, grassVillage, 2);

        expect(village.offers).toHaveLength(3);
        expect(village.offers).toEqual(expect.arrayContaining(originalOffers.slice(1)));
        expect(village.offers).not.toContainEqual(completed);
    });
});

describe('village trust prices', () => {
    it.each([
        [0, 'stranger', 11],
        [3, 'known', 9],
        [7, 'trusted', 8],
        [12, 'allied', 7]
    ])('uses the agreed price tier at %i trust', (trust, id, expectedCost) => {
        expect(getTrustTier(trust).id).toBe(id);
        expect(getAdjustedTrade({
            give: { type: 60, count: 10 },
            receive: { type: 61, count: 1 }
        }, trust).give.count).toBe(expectedCost);
    });

    it('never lowers a price below one item', () => {
        expect(getAdjustedTrade({
            give: { type: 62, count: 1 },
            receive: { type: 19, count: 8 }
        }, 99).give.count).toBe(1);
    });
});
