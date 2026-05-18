import { describe, expect, it } from 'vitest';
import { canCompleteQuest, getItemTotal, getQuestProgress, removeQuestItems } from '../js/quests.js';

describe('quest inventory helpers', () => {
    it('zaehlt Items ueber mehrere Slots', () => {
        const inventory = [
            { type: 51, count: 4 },
            { type: 3, count: 20 },
            { type: 51, count: 9 }
        ];

        expect(getItemTotal(inventory, 51)).toBe(13);
    });

    it('erkennt erfuellbare Auftraege', () => {
        const inventory = [{ type: 60, count: 12 }];
        const quest = { give: { type: 60, count: 12 }, receive: { type: 61, count: 2 } };

        expect(canCompleteQuest(inventory, quest)).toBe(true);
    });

    it('liefert Fortschritt und fehlende Items', () => {
        const inventory = [{ type: 60, count: 5 }];
        const quest = { give: { type: 60, count: 12 }, receive: { type: 61, count: 2 } };

        expect(getQuestProgress(inventory, quest)).toEqual({
            current: 5,
            required: 12,
            missing: 7,
            complete: false
        });
    });

    it('entfernt Quest-Items aus mehreren Slots', () => {
        const inventory = [
            { type: 31, count: 2 },
            { type: 31, count: 5 },
            { type: 60, count: 4 }
        ];
        const quest = { give: { type: 31, count: 6 }, receive: { type: 82, count: 4 } };

        expect(removeQuestItems(inventory, quest)).toBe(true);
        expect(inventory).toEqual([
            { type: 0, count: 0 },
            { type: 31, count: 1 },
            { type: 60, count: 4 }
        ]);
    });

    it('laesst Inventory unveraendert wenn Items fehlen', () => {
        const inventory = [{ type: 62, count: 1 }];
        const quest = { give: { type: 62, count: 2 }, receive: { type: 65, count: 1 } };

        expect(removeQuestItems(inventory, quest)).toBe(false);
        expect(inventory).toEqual([{ type: 62, count: 1 }]);
    });
});
