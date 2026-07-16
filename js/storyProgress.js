export const STORY_EVENTS = Object.freeze({
    VILLAGER_MET: 'butzcraft:villager-met',
    QUEST_COMPLETED: 'butzcraft:quest-completed',
    BLOOD_MOON_SURVIVED: 'butzcraft:blood-moon-survived'
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
        text: 'Finde ein Dorf',
        hint: 'Halte nach Häusern und Wegen Ausschau. Sprich einen Dorfbewohner mit Rechtsklick an.',
        touchHint: 'Halte nach Häusern und Wegen Ausschau. Tippe einen Dorfbewohner an.'
    },
    {
        label: 'Deine Reise',
        text: 'Erledige einen Dorfauftrag',
        hint: 'Öffne einen Dorfbewohner und bringe die Gegenstände aus seinem Auftrag.',
        touchHint: 'Öffne einen Dorfbewohner und bringe die Gegenstände aus seinem Auftrag.'
    },
    {
        label: 'Deine Reise',
        text: 'Überstehe einen Blutmond',
        hint: 'Jede dritte Nacht wird gefährlich. Nimm Essen mit und sichere deinen Unterschlupf.',
        touchHint: 'Jede dritte Nacht wird gefährlich. Nimm Essen mit und sichere deinen Unterschlupf.'
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
    STORY_EVENTS.BLOOD_MOON_SURVIVED
];

function normalizeIndex(index) {
    if (!Number.isFinite(index)) return 0;
    return Math.max(0, Math.min(STORY_OBJECTIVES.length, Math.floor(index)));
}

export function getStoryProgress(restoredIndex = 0, { dayCount = 0 } = {}) {
    let index = normalizeIndex(restoredIndex);
    if (index === 0 && dayCount >= 1) index = 1;
    return {
        index,
        objective: STORY_OBJECTIVES[index] || null
    };
}

export function advanceStoryProgress(restoredIndex, eventName) {
    const index = normalizeIndex(restoredIndex);
    if (EXPECTED_EVENT_BY_INDEX[index] !== eventName) return index;
    return Math.min(index + 1, STORY_OBJECTIVES.length);
}
