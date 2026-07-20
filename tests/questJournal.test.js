import { beforeEach, describe, expect, it } from 'vitest';

const gradient = { addColorStop() {} };
const canvasContext = new Proxy({}, {
    get(target, property) {
        if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient;
        if (!(property in target)) target[property] = () => {};
        return target[property];
    }
});
HTMLCanvasElement.prototype.getContext = () => canvasContext;
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

const { initQuestJournal, showInventoryPanel, updateQuestCompass } = await import('../js/questJournal.js');

beforeEach(() => {
    document.body.innerHTML = `
        <div id="inventory-overlay">
            <div id="inventory-view-tab"></div><div id="quest-view-tab"></div>
            <div id="quest-journal" hidden>
                <div id="quest-journal-main"></div>
                <div id="quest-journal-side"></div>
                <div id="quest-journal-villages"></div>
                <div id="quest-journal-home"></div>
            </div>
        </div>
        <div id="quest-compass" hidden>
            <span class="quest-compass-arrow"></span>
            <span class="quest-compass-label"></span>
            <span class="quest-compass-distance"></span>
        </div>
    `;
    const state = {
        mainQuestIndex: 2,
        homeVillageId: 'village:1,2',
        trackedTarget: { kind: 'home' },
        completedQuestIds: [],
        abandonedQuestIds: [],
        activeSideQuests: [{
            id: 'repair', title: 'Zäune reparieren', villageId: 'village:1,2', professionIdx: 1,
            objective: { type: 'place', itemType: 102, current: 2, required: 8, target: { x: 20, z: 20 } }
        }],
        villages: {
            'village:1,2': { id: 'village:1,2', biome: 'Grasland', trust: 7, offers: [{}, {}, {}] }
        }
    };
    window.getQuestState = () => state;
    window.getCurrentStoryObjective = () => ({ text: 'Hilf dem Heimatdorf', hint: 'Sprich mit den Bewohnern.' });
    window.getQuestNavigationContext = () => ({
        playerPosition: { x: 0, z: 0 },
        respawnBed: { x: 30, y: 20, z: -40 },
        world: { getBlock: () => 38 },
        headingDegrees: 0,
        mainTarget: { x: 20, z: 20 }
    });
});

describe('quest journal UI', () => {
    it('shows main quest, side progress, local trust and home tracking', () => {
        initQuestJournal();
        showInventoryPanel('quests');

        expect(document.getElementById('quest-journal').hidden).toBe(false);
        expect(document.getElementById('quest-journal-main').textContent).toContain('Hilf dem Heimatdorf');
        expect(document.getElementById('quest-journal-side').textContent).toContain('2/8');
        expect(document.getElementById('quest-journal-villages').textContent).toContain('Vertraut');
        expect(document.getElementById('quest-journal-home').textContent).toContain('Zuhause wird verfolgt');
    });

    it('renders compass guidance to the valid home bed', () => {
        updateQuestCompass();

        expect(document.getElementById('quest-compass').hidden).toBe(false);
        expect(document.querySelector('.quest-compass-label').textContent).toContain('Zuhause');
        expect(document.querySelector('.quest-compass-distance').textContent).toContain('50 Blöcke');
    });
});
