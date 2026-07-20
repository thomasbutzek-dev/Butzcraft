export const STORY_EVENTS = Object.freeze({
    VILLAGER_MET: 'butzcraft:villager-met',
    QUEST_COMPLETED: 'butzcraft:quest-completed',
    BLOOD_MOON_SURVIVED: 'butzcraft:blood-moon-survived',
    MINE_COMPLETED: 'butzcraft:mine-completed',
    DUNGEON_KEY_FOUND: 'butzcraft:dungeon-key-found',
    DUNGEON_GATE_OPENED: 'butzcraft:dungeon-gate-opened',
    DUNGEON_COMPLETED: 'butzcraft:dungeon-completed',
    RITUAL_ACTIVATED: 'butzcraft:ritual-activated',
    BOSS_DEFEATED: 'butzcraft:boss-defeated'
});

const STORY_OBJECTIVES = [
    {
        label: 'Deine Reise',
        text: 'Überstehe deine erste Nacht',
        hint: 'Baue einen sicheren Unterschlupf. Ein Bett lässt dich normale Nächte überspringen.',
        touchHint: 'Baue einen sicheren Unterschlupf. Ein Bett lässt dich normale Nächte überspringen.'
    },
    {
        label: 'Deine Reise',
        text: 'Folge den Spuren zu einem Dorf',
        hint: 'Halte nach Häusern und Wegen Ausschau. Sprich einen Dorfbewohner mit Rechtsklick an.',
        touchHint: 'Halte nach Häusern und Wegen Ausschau. Tippe einen Dorfbewohner an.'
    },
    {
        label: 'Deine Reise',
        text: 'Gewinne das Vertrauen des Dorfes',
        hint: 'Sprich mit einem Dorfbewohner und erfülle seinen Auftrag.',
        touchHint: 'Sprich mit einem Dorfbewohner und erfülle seinen Auftrag.'
    },
    {
        label: 'Deine Reise',
        text: 'Stelle dich dem Blutmond',
        hint: 'Jede dritte Nacht wird gefährlich. Nimm Essen mit und sichere deinen Unterschlupf.',
        touchHint: 'Jede dritte Nacht wird gefährlich. Nimm Essen mit und sichere deinen Unterschlupf.'
    },
    {
        label: 'Spuren in der Tiefe',
        text: 'Durchsuche eine große Mine',
        hint: 'Folge Mineneingängen und Schienen bis zur Belohnungskammer.',
        touchHint: 'Folge Mineneingängen und Schienen bis zur Belohnungskammer.'
    },
    {
        label: 'Die versiegelte Tiefe',
        text: 'Finde den Schlüssel im oberen Dungeon',
        hint: 'Ein verwitterter Steinmarker zeigt einen Dungeonzugang. Durchsuche zuerst die obere Ebene.',
        touchHint: 'Ein verwitterter Steinmarker zeigt einen Dungeonzugang. Durchsuche zuerst die obere Ebene.'
    },
    {
        label: 'Die versiegelte Tiefe',
        text: 'Öffne das Tor zur unteren Ebene',
        hint: 'Kehre mit dem gefundenen Schlüssel zum verschlossenen Dungeon-Tor zurück.',
        touchHint: 'Kehre mit dem gefundenen Schlüssel zum verschlossenen Dungeon-Tor zurück.'
    },
    {
        label: 'Die Blutmondquelle',
        text: 'Erreiche die Endkammer',
        hint: 'Überwinde die Spawner und öffne die Belohnungstruhe hinter dem Tor.',
        touchHint: 'Überwinde die Spawner und öffne die Belohnungstruhe hinter dem Tor.'
    },
    {
        label: 'Die Blutmondquelle',
        text: 'Aktiviere das Blutmondritual',
        hint: 'Aktiviere den leuchtenden Ritualaltar in der Endkammer und bereite dich auf einen schweren Kampf vor.',
        touchHint: 'Aktiviere den leuchtenden Ritualaltar in der Endkammer und bereite dich auf einen schweren Kampf vor.'
    },
    {
        label: 'Wächter der Quelle',
        text: 'Besiege den Blutmondwächter',
        hint: 'Weiche seinen Angriffen aus und beseitige beschworene Gegner. Eisen-Ausrüstung und Nahrung werden empfohlen.',
        touchHint: 'Weiche seinen Angriffen aus und beseitige beschworene Gegner. Eisen-Ausrüstung und Nahrung werden empfohlen.'
    },
    {
        label: 'Neue Gefahren',
        text: 'Stärke die Dörfer und jage Blutmondechos',
        hint: 'Neue Dorfaufträge, stärkere Blutmonde und seltene Boss-Echos erwarten dich.',
        touchHint: 'Neue Dorfaufträge, stärkere Blutmonde und seltene Boss-Echos erwarten dich.'
    }
].map((objective, index, objectives) => ({
    ...objective,
    step: index + 1,
    total: objectives.length
}));

const EXPECTED_EVENT_BY_INDEX = [
    null,
    STORY_EVENTS.VILLAGER_MET,
    STORY_EVENTS.QUEST_COMPLETED,
    STORY_EVENTS.BLOOD_MOON_SURVIVED,
    STORY_EVENTS.MINE_COMPLETED,
    STORY_EVENTS.DUNGEON_KEY_FOUND,
    STORY_EVENTS.DUNGEON_GATE_OPENED,
    STORY_EVENTS.DUNGEON_COMPLETED,
    STORY_EVENTS.RITUAL_ACTIVATED,
    STORY_EVENTS.BOSS_DEFEATED,
    null
];

function getVillageCenter(village) {
    const houses = Array.isArray(village?.houses) ? village.houses : [];
    const positions = houses.filter(house => Number.isFinite(house?.x) && Number.isFinite(house?.z));
    if (positions.length === 0) return null;
    return {
        x: positions.reduce((sum, house) => sum + house.x, 0) / positions.length,
        z: positions.reduce((sum, house) => sum + house.z, 0) / positions.length
    };
}

function getDirectionName(dx, dz) {
    const eastWest = dx >= 0 ? 'östlich' : 'westlich';
    const northSouth = dz >= 0 ? 'südlich' : 'nördlich';
    const diagonalNorthSouth = dz >= 0 ? 'süd' : 'nord';
    const absX = Math.abs(dx);
    const absZ = Math.abs(dz);
    if (absX > absZ * 2) return eastWest;
    if (absZ > absX * 2) return northSouth;
    return `${diagonalNorthSouth}${eastWest}`;
}

function addVillageGuidance(objective, playerPosition, villages) {
    if (!playerPosition || !Number.isFinite(playerPosition.x) || !Number.isFinite(playerPosition.z)) return objective;
    const nearest = (Array.isArray(villages) ? villages : [])
        .map(getVillageCenter)
        .filter(Boolean)
        .map(center => ({
            ...center,
            dx: center.x - playerPosition.x,
            dz: center.z - playerPosition.z
        }))
        .sort((first, second) => (first.dx ** 2 + first.dz ** 2) - (second.dx ** 2 + second.dz ** 2))[0];
    if (!nearest) return objective;

    const distance = Math.max(10, Math.round(Math.hypot(nearest.dx, nearest.dz) / 10) * 10);
    const direction = getDirectionName(nearest.dx, nearest.dz);
    const guidance = `Ein bekanntes Dorf liegt etwa ${distance} Blöcke ${direction}.`;
    return {
        ...objective,
        hint: `${guidance} Sprich dort einen Dorfbewohner mit Rechtsklick an.`,
        touchHint: `${guidance} Tippe dort einen Dorfbewohner an.`
    };
}

function normalizeIndex(index) {
    if (!Number.isFinite(index)) return 0;
    return Math.max(0, Math.min(STORY_OBJECTIVES.length, Math.floor(index)));
}

export function getStoryProgress(restoredIndex = 0, { dayCount = 0, playerPosition = null, villages = [] } = {}) {
    let index = normalizeIndex(restoredIndex);
    if (index === 0 && dayCount >= 1) index = 1;
    let objective = STORY_OBJECTIVES[index] || null;
    if (index === 1 && objective) objective = addVillageGuidance(objective, playerPosition, villages);
    return {
        index,
        objective
    };
}

export function advanceStoryProgress(restoredIndex, eventName) {
    const index = normalizeIndex(restoredIndex);
    if (EXPECTED_EVENT_BY_INDEX[index] !== eventName) return index;
    return Math.min(index + 1, STORY_OBJECTIVES.length);
}
