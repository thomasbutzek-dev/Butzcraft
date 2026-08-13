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
const { getQuestObjectiveText } = await import('../js/questObjectiveText.js');

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
        cameraYawRadians: 0,
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
        expect(document.getElementById('quest-journal-side').textContent).toContain('Platziere 8× Holzzaun im Auftragsdorf');
        expect(document.getElementById('quest-journal-villages').textContent).toContain('Vertraut');
        expect(document.getElementById('quest-journal-home').textContent).toContain('Zuhause wird verfolgt');
    });

    it('renders compass guidance to the valid home bed', () => {
        updateQuestCompass();

        expect(document.getElementById('quest-compass').hidden).toBe(false);
        expect(document.querySelector('.quest-compass-label').textContent).toContain('Zuhause');
        expect(document.querySelector('.quest-compass-distance').textContent).toContain('50 Blöcke');
    });

    it('points straight up while looking directly at the target', () => {
        window.getQuestState().trackedTarget = { kind: 'main' };
        window.getQuestState().villages['village:1,2'].center = { x: 10, z: 0 };
        window.getQuestNavigationContext = () => ({
            playerPosition: { x: 0, z: 0 },
            cameraYawRadians: -Math.PI / 2,
            world: {}
        });

        updateQuestCompass();

        expect(document.querySelector('.quest-compass-arrow').style.transform).toBe('rotate(0deg)');
    });

    it('shows concrete actions for every side quest type', () => {
        expect(getQuestObjectiveText(
            { type: 'delivery', itemType: 60, required: 12 },
            0
        )).toBe('Bringe 12× Kohle zum Schmied');
        expect(getQuestObjectiveText(
            { type: 'craft', itemType: 65, required: 1 },
            0
        )).toBe('Stelle 1× Eisen-Spitzhacke her');
        expect(getQuestObjectiveText(
            { type: 'hunt', mobType: 'skeleton', required: 6 },
            0
        )).toBe('Besiege 6 Skelette');
        expect(getQuestObjectiveText(
            { type: 'structure', structureKind: 'mine', required: 1 },
            2
        )).toBe('Erreiche die Belohnungskammer einer großen Mine');
        expect(getQuestObjectiveText(
            { type: 'boss', bossType: 'bloodMoonEcho', required: 1 },
            3
        )).toBe('Besiege das Blutmondecho am Ritualaltar');
    });

    it('keeps an activity without a meaningful location tracked but hides the compass', () => {
        const state = window.getQuestState();
        state.activeSideQuests[0].objective = {
            type: 'hunt',
            mobType: 'skeleton',
            current: 0,
            required: 6
        };
        state.trackedTarget = { kind: 'side', questId: 'repair' };

        updateQuestCompass();

        expect(state.trackedTarget).toEqual({ kind: 'side', questId: 'repair' });
        expect(document.getElementById('quest-compass').hidden).toBe(true);
    });

    it('remembers an approached structure as the exact quest target', () => {
        const state = window.getQuestState();
        state.activeSideQuests[0].objective = {
            type: 'structure',
            structureKind: 'mine',
            current: 0,
            required: 1,
            target: { x: 20, z: 20 }
        };
        state.trackedTarget = { kind: 'side', questId: 'repair' };
        window.getQuestNavigationContext = () => ({
            playerPosition: { x: 30, z: 0 },
            cameraYawRadians: 0,
            world: {
                structures: new Map([
                    ['mine:1', { id: 'mine:1', kind: 'mine', x: 100, z: 0 }]
                ]),
                structureProgress: {}
            }
        });

        updateQuestCompass();

        expect(state.activeSideQuests[0].objective.target).toEqual({
            x: 100,
            z: 0,
            structureId: 'mine:1'
        });
        expect(document.querySelector('.quest-compass-distance').textContent).toBe('70 Blöcke');

        window.getQuestNavigationContext = () => ({
            playerPosition: { x: 0, z: 0 },
            cameraYawRadians: 0,
            world: { structures: new Map(), structureProgress: {} }
        });
        updateQuestCompass();

        expect(document.querySelector('.quest-compass-distance').textContent).toBe('100 Blöcke');
    });

    it('corrects and follows the saved ritual altar instead of a nearer dungeon', () => {
        const state = window.getQuestState();
        state.mainQuestIndex = 8;
        state.trackedTarget = { kind: 'main' };
        state.storyFlags = {
            ritualSite: {
                structureId: 'dungeon:ritual',
                position: { x: 204, y: 13, z: -4 }
            }
        };
        window.getQuestNavigationContext = () => ({
            playerPosition: { x: 0, z: 0 },
            cameraYawRadians: 0,
            world: {
                structures: new Map([
                    ['dungeon:near', {
                        id: 'dungeon:near',
                        kind: 'dungeon',
                        x: 20,
                        z: 0,
                        altar: { interaction: { x: 24, y: 18, z: 6 } }
                    }],
                    ['dungeon:ritual', {
                        id: 'dungeon:ritual',
                        kind: 'dungeon',
                        x: 200,
                        z: 0,
                        altar: { interaction: { x: 212, y: 14, z: -8 } }
                    }]
                ])
            }
        });

        updateQuestCompass();

        expect(state.storyFlags.ritualSite).toEqual({
            structureId: 'dungeon:ritual',
            position: { x: 212, y: 14, z: -8 }
        });
        expect(document.querySelector('.quest-compass-label').textContent).toContain('Ritualaltar');
        expect(document.querySelector('.quest-compass-distance').textContent).toBe('210 Blöcke');
    });
});
