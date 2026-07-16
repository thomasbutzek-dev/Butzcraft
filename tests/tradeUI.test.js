import { beforeEach, describe, expect, it } from 'vitest';

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
            <div id="trade-grid"></div>
        </div>
    `;
    for (let i = 0; i < inventory.inventorySlots.length; i++) {
        inventory.inventorySlots[i] = { type: 0, count: 0 };
    }
    window.addItemToInventory = inventory.addItemToInventory;
    window.updateInventoryUI = () => {};
});

describe('NPC trade transactions', () => {
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
});
