import { beforeEach, describe, expect, it, vi } from 'vitest';

const gradient = { addColorStop() {} };
const canvasContext = new Proxy({}, {
    get(target, property) {
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
            return () => gradient;
        }
        if (!(property in target)) target[property] = () => {};
        return target[property];
    },
    set(target, property, value) {
        target[property] = value;
        return true;
    }
});
HTMLCanvasElement.prototype.getContext = () => canvasContext;
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

const inventory = await import('../js/inventory.js');
const { openTradeUI } = await import('../js/tradeUI.js');

beforeEach(() => {
    document.body.innerHTML = `
        <div id="trade-overlay" style="display:none">
            <div id="trade-title"></div>
            <div id="npc-dialogue"><p id="npc-dialogue-text"></p><div id="npc-dialogue-actions"></div></div>
            <div id="trade-grid"></div>
        </div>
    `;
    for (let i = 0; i < inventory.inventorySlots.length; i++) {
        inventory.inventorySlots[i] = { type: 0, count: 0 };
    }
    window.addItemToInventory = inventory.addItemToInventory;
    window.updateInventoryUI = () => {};
    delete window.getQuestState;
    delete window.getQuestDayCount;
});

describe('NPC trade transactions', () => {
    it('announces when the player meets a villager', () => {
        const listener = vi.fn();
        window.addEventListener('butzcraft:villager-met', listener, { once: true });
        const npc = {
            profession: {
                name: 'Bauer',
                quest: null,
                trades: []
            }
        };

        openTradeUI(npc, { unlock() {} });

        expect(listener).toHaveBeenCalledOnce();
    });

    it('keeps the payment when the reward does not fit', () => {
        for (let i = 0; i < inventory.inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventory.inventorySlots[i] = { type: 1, count: 64 };
        }
        inventory.inventorySlots[0] = { type: 60, count: 64 };
        const npc = {
            profession: {
                name: 'Schmied',
                quest: null,
                trades: [{ give: { type: 60, count: 10 }, receive: { type: 61, count: 1 } }]
            }
        };

        openTradeUI(npc, { unlock() {} });
        document.querySelector('.trade-btn').click();

        expect(inventory.inventorySlots[0]).toEqual({ type: 60, count: 64 });
        expect(inventory.inventorySlots.some(slot => slot.type === 61)).toBe(false);
    });

    it('keeps quest items when the reward does not fit', () => {
        for (let i = 0; i < inventory.inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventory.inventorySlots[i] = { type: 1, count: 64 };
        }
        inventory.inventorySlots[0] = { type: 60, count: 64 };
        const npc = {
            profession: {
                name: 'Schmied',
                quest: { give: { type: 60, count: 10 }, receive: { type: 61, count: 1 } },
                trades: []
            }
        };

        openTradeUI(npc, { unlock() {} });
        document.querySelector('.quest-row .trade-btn').click();

        expect(inventory.inventorySlots[0]).toEqual({ type: 60, count: 64 });
        expect(inventory.inventorySlots.some(slot => slot.type === 61)).toBe(false);
    });

    it('announces a successfully completed village quest', () => {
        inventory.inventorySlots[0] = { type: 60, count: 10 };
        const listener = vi.fn();
        window.addEventListener('butzcraft:quest-completed', listener, { once: true });
        const npc = {
            profession: {
                name: 'Schmied',
                quest: { give: { type: 60, count: 10 }, receive: { type: 61, count: 1 } },
                trades: []
            }
        };

        openTradeUI(npc, { unlock() {} });
        document.querySelector('.quest-row .trade-btn').click();

        expect(listener).toHaveBeenCalledOnce();
        expect(inventory.inventorySlots.some(slot => slot.type === 61 && slot.count === 1)).toBe(true);
    });

    it('uses the local village trust price for normal trades', () => {
        inventory.inventorySlots[0] = { type: 60, count: 10 };
        window.getQuestState = () => ({
            activeSideQuests: [],
            villages: { 'village:1,2': { trust: 3, offers: [] } }
        });
        const npc = {
            villageId: 'village:1,2',
            displayName: 'Hagen',
            professionIdx: 0,
            profession: {
                name: 'Schmied', quest: null,
                trades: [{ give: { type: 60, count: 10 }, receive: { type: 61, count: 1 } }]
            }
        };

        openTradeUI(npc, { unlock() {} });
        expect(document.getElementById('trade-title').textContent).toContain('Vertrauen 3 · Bekannt');
        expect(document.querySelector('#trade-row-0 .trade-label').textContent).toContain('9×');
        document.querySelector('#trade-row-0 .trade-btn').click();

        expect(inventory.inventorySlots[0]).toEqual({ type: 60, count: 1 });
        expect(inventory.inventorySlots.some(slot => slot.type === 61 && slot.count === 1)).toBe(true);
    });

    it('buys a complete armor set as one smith transaction', () => {
        inventory.inventorySlots[0] = { type: 61, count: 12 };
        const npc = {
            profession: {
                name: 'Schmied',
                quest: null,
                trades: [{
                    give: { type: 61, count: 12 },
                    receive: {
                        label: 'Holzrüstungsset',
                        items: [116, 117, 118, 119, 120].map(type => ({ type, count: 1 }))
                    }
                }]
            }
        };

        openTradeUI(npc, { unlock() {} });
        document.querySelector('.trade-btn').click();

        expect(inventory.inventorySlots.filter(slot => slot.type >= 116 && slot.type <= 120)).toHaveLength(5);
        expect(document.querySelector('#trade-row-0').textContent).toContain('Holzrüstungsset');
    });

    it('accepts and turns in a generated village delivery quest', () => {
        const questState = {
            trackedTarget: { kind: 'main' },
            completedQuestIds: [],
            abandonedQuestIds: [],
            activeSideQuests: [],
            villages: {
                'village:1,2': {
                    id: 'village:1,2', trust: 0, nextOfferRefreshDay: 3,
                    offers: [{
                        id: 'coal-help', villageId: 'village:1,2', professionIdx: 0,
                        title: 'Kohle für die Werkstatt',
                        objective: { type: 'delivery', itemType: 60, required: 4, current: 0 },
                        reward: { type: 61, count: 1 }, trustReward: 2
                    }]
                }
            }
        };
        window.getQuestState = () => questState;
        window.getQuestDayCount = () => 2;
        const npc = {
            villageId: 'village:1,2', displayName: 'Hagen', professionIdx: 0,
            profession: { name: 'Schmied', quest: null, trades: [] }
        };

        openTradeUI(npc, { unlock() {} });
        document.querySelector('.quest-offer-row .trade-btn').click();
        expect(questState.activeSideQuests).toHaveLength(1);

        const trustListener = vi.fn();
        window.addEventListener('butzcraft:village-trust-earned', trustListener, { once: true });
        inventory.inventorySlots[0] = { type: 60, count: 4 };
        openTradeUI(npc, { unlock() {} });
        document.querySelector('.quest-active-row .trade-btn').click();

        expect(questState.activeSideQuests).toEqual([]);
        expect(questState.villages['village:1,2'].trust).toBe(2);
        expect(trustListener).toHaveBeenCalledWith(expect.objectContaining({
            detail: expect.objectContaining({
                villageId: 'village:1,2',
                trustEarned: 2,
                trust: 2
            })
        }));
        expect(inventory.inventorySlots.some(slot => slot.type === 61 && slot.count === 1)).toBe(true);
    });

    it('offers a profession chain through an NPC conversation', () => {
        const questState = {
            mainQuestIndex: 2,
            trackedTarget: { kind: 'main' },
            completedQuestIds: [], abandonedQuestIds: [], activeSideQuests: [],
            villages: {
                'village:1,2': {
                    id: 'village:1,2', trust: 0, center: { x: 10, z: 10 },
                    offers: [], professionChainProgress: {}, nextOfferRefreshDay: 3
                }
            }
        };
        window.getQuestState = () => questState;
        const npc = {
            villageId: 'village:1,2', displayName: 'Hagen', professionIdx: 0,
            profession: { name: 'Schmied', quest: null, trades: [] }
        };

        openTradeUI(npc, { unlock() {} });
        expect(document.getElementById('npc-dialogue-text').textContent).toContain('Esse');
        expect([...document.querySelectorAll('.dialogue-choice')].map(button => button.dataset.dialogueAction))
            .toEqual(['accept', 'ask', 'trade', 'decline']);

        document.querySelector('[data-dialogue-action="accept"]').click();
        expect(questState.activeSideQuests[0]).toMatchObject({
            title: 'Die kalte Esse', chain: { professionIdx: 0, stage: 0 }
        });
    });
});
