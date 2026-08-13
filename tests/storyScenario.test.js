import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const gradient = { addColorStop() {} };
const canvasContext = new Proxy({}, {
    get(target, property) {
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
            return () => gradient;
        }
        if (!(property in target)) target[property] = () => {};
        return target[property];
    }
});
HTMLCanvasElement.prototype.getContext = () => canvasContext;
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

const inventory = await import('../js/inventory.js');
const { PlayerInteraction } = await import('../js/PlayerInteraction.js');
const { openTradeUI } = await import('../js/tradeUI.js');
const { createQuestState } = await import('../js/quests.js');
const { prepareSaveForLoad, stampSaveVersion } = await import('../js/saveMigrations.js');
const { STORY_EVENTS } = await import('../js/storyProgress.js');
const { applyStoryEvent, reconcileStoryState } = await import('../js/storyOrchestrator.js');

const installedListeners = [];

function listen(type, listener) {
    window.addEventListener(type, listener);
    installedListeners.push([type, listener]);
}

function validSave(questState, storyObjectiveIndex) {
    return stampSaveVersion({
        pos: { x: 0, y: 40, z: 0 },
        health: 20,
        hunger: 20,
        time: 120,
        inventory: [],
        questState,
        storyObjectiveIndex
    });
}

beforeEach(() => {
    document.body.innerHTML = `
        <div id="trade-overlay" style="display:none">
            <div id="trade-title"></div>
            <div id="npc-dialogue"><p id="npc-dialogue-text"></p><div id="npc-dialogue-actions"></div></div>
            <div id="trade-grid"></div>
        </div>
        <div id="chest-overlay" style="display:none"></div>
        <div id="chest-grid"></div>
        <div id="village-chest-warning" hidden>
            <button id="village-chest-cancel" type="button">Abbrechen</button>
            <button id="village-chest-confirm" type="button">Trotzdem nehmen</button>
        </div>
    `;
    for (let index = 0; index < inventory.inventorySlots.length; index++) {
        inventory.inventorySlots[index] = { type: 0, count: 0 };
    }
    window.addItemToInventory = inventory.addItemToInventory;
    window.updateInventoryUI = () => {};
    delete window.getQuestState;
    delete window.getQuestDayCount;
});

afterEach(() => {
    for (const [type, listener] of installedListeners.splice(0)) {
        window.removeEventListener(type, listener);
    }
    delete window.getQuestState;
    delete window.getQuestDayCount;
});

describe('story end-to-end scenarios', () => {
    it('advances from meeting a villager through a completed village quest and real trust reward', () => {
        const questState = createQuestState(1);
        questState.villages['village:1,2'] = {
            id: 'village:1,2',
            trust: 0,
            offers: [{
                id: 'coal-help',
                villageId: 'village:1,2',
                professionIdx: 0,
                title: 'Kohle für die Werkstatt',
                objective: { type: 'delivery', itemType: 60, required: 4, current: 0 },
                reward: { type: 61, count: 1 },
                trustReward: 2
            }],
            professionChainProgress: {}
        };
        let storyObjectiveIndex = 1;
        const handle = event => {
            const result = applyStoryEvent({
                questState,
                storyObjectiveIndex,
                eventName: event.type,
                detail: event.detail
            });
            storyObjectiveIndex = result.index;
        };
        listen(STORY_EVENTS.VILLAGER_MET, handle);
        listen(STORY_EVENTS.VILLAGE_TRUST_EARNED, handle);
        listen(STORY_EVENTS.QUEST_COMPLETED, handle);
        window.getQuestState = () => questState;
        window.getQuestDayCount = () => 2;
        const npc = {
            villageId: 'village:1,2',
            displayName: 'Hagen',
            professionIdx: 0,
            profession: { name: 'Schmied', quest: null, trades: [] }
        };

        openTradeUI(npc, { unlock() {} });
        expect(storyObjectiveIndex).toBe(2);
        document.querySelector('.quest-offer-row .trade-btn').click();

        inventory.inventorySlots[0] = { type: 60, count: 4 };
        openTradeUI(npc, { unlock() {} });
        document.querySelector('.quest-active-row .trade-btn').click();

        expect(storyObjectiveIndex).toBe(3);
        expect(questState.villages['village:1,2'].trust).toBe(2);
        expect(questState.storyMilestones).toMatchObject({
            [STORY_EVENTS.VILLAGER_MET]: true,
            [STORY_EVENTS.VILLAGE_TRUST_EARNED]: true
        });
        expect(questState.storyMilestones[STORY_EVENTS.QUEST_COMPLETED]).toBeUndefined();
    });

    it('preserves an early dungeon key through save/load and recognizes it after the mine reward', () => {
        let questState = createQuestState(4);
        let storyObjectiveIndex = 4;
        const handle = event => {
            const result = applyStoryEvent({
                questState,
                storyObjectiveIndex,
                eventName: event.type,
                detail: event.detail
            });
            storyObjectiveIndex = result.index;
        };
        listen(STORY_EVENTS.DUNGEON_KEY_FOUND, handle);
        listen(STORY_EVENTS.MINE_COMPLETED, handle);
        const keyChest = {
            structureId: 'dungeon:0,0:v2',
            role: 'dungeon_key',
            lootTable: 'dungeon_catacomb'
        };
        const mineChest = {
            structureId: 'mine:0,0:v2',
            role: 'mine_reward',
            lootTable: 'mine_timber'
        };
        const world = {
            chestContents: {},
            lootedChests: new Set(),
            structureChests: new Map([
                ['chest,1,20,3', keyChest],
                ['chest,5,18,7', mineChest]
            ]),
            structureProgress: {
                [mineChest.structureId]: { bossDefeated: true }
            },
            getBlock: () => 0
        };
        const interaction = new PlayerInteraction(null, null, world, [], {}, {
            addItemToInventory: () => 0,
            updateInventoryUI() {}
        });

        interaction._openChest(1, 20, 3);
        expect(storyObjectiveIndex).toBe(4);
        expect(questState.storyMilestones[STORY_EVENTS.DUNGEON_KEY_FOUND]).toBe(true);

        const loaded = prepareSaveForLoad(JSON.parse(JSON.stringify(validSave(questState, storyObjectiveIndex))));
        questState = loaded.questState;
        storyObjectiveIndex = loaded.questState.mainQuestIndex;
        interaction._openChest(5, 18, 7);

        expect(storyObjectiveIndex).toBe(6);
        expect(questState.questItems.deepCrystal).toBe(1);
        expect(questState.storyMilestones).toMatchObject({
            [STORY_EVENTS.MINE_COMPLETED]: true,
            [STORY_EVENTS.DUNGEON_KEY_FOUND]: true
        });
    });

    it('runs the ordered story events through ritual and boss into the endgame', () => {
        const questState = createQuestState();
        let story = reconcileStoryState({ questState, storyObjectiveIndex: 0, context: { dayCount: 1 } });
        const structureId = 'dungeon:0,0:v2';
        const structures = new Map([[structureId, {
            id: structureId,
            altar: { interaction: { x: 12, y: 18, z: 9 } }
        }]]);
        const sequence = [
            STORY_EVENTS.VILLAGER_MET,
            STORY_EVENTS.VILLAGE_TRUST_EARNED,
            STORY_EVENTS.BLOOD_MOON_SURVIVED,
            STORY_EVENTS.MINE_COMPLETED,
            STORY_EVENTS.DUNGEON_KEY_FOUND,
            STORY_EVENTS.DUNGEON_GATE_OPENED,
            STORY_EVENTS.DUNGEON_COMPLETED,
            STORY_EVENTS.RITUAL_ACTIVATED,
            STORY_EVENTS.BOSS_DEFEATED
        ];

        for (const eventName of sequence) {
            story = applyStoryEvent({
                questState,
                storyObjectiveIndex: story.index,
                eventName,
                detail: eventName === STORY_EVENTS.DUNGEON_COMPLETED
                    ? { structureId, position: { x: 1, y: 2, z: 3 } }
                    : {},
                structures
            });
        }

        expect(story.index).toBe(10);
        expect(questState.mainQuestIndex).toBe(10);
        expect(questState.questItems).toMatchObject({ deepCrystal: 1, bloodSeal: 1 });
        expect(questState.storyFlags).toMatchObject({
            bossDefeated: true,
            ritualSite: {
                structureId,
                position: { x: 12, y: 18, z: 9 }
            }
        });
    });
});
