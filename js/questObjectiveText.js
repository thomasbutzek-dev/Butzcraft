import { getItemName } from './inventory.js?v=20260801c';

const PROFESSION_NAMES = ['Schmied', 'Bauer', 'Händler', 'Bibliothekar'];
const MOB_NAMES = {
    zombie: 'Zombies',
    skeleton: 'Skelette'
};

export function getQuestProfessionName(professionIdx) {
    return PROFESSION_NAMES[professionIdx] || 'Auftraggeber';
}

export function getQuestObjectiveText(objective, professionIdx = null) {
    if (!objective) return 'Unbekanntes Ziel';
    const required = Math.max(1, Math.floor(Number(objective.required) || 1));
    const recipient = Number.isInteger(professionIdx)
        ? `zum ${getQuestProfessionName(professionIdx)}`
        : 'zum Auftraggeber';

    if (objective.type === 'delivery') {
        return `Bringe ${required}× ${getItemName(objective.itemType)} ${recipient}`;
    }
    if (objective.type === 'craft') {
        return `Stelle ${required}× ${getItemName(objective.itemType)} her`;
    }
    if (objective.type === 'place') {
        return `Platziere ${required}× ${getItemName(objective.itemType)} im Auftragsdorf`;
    }
    if (objective.type === 'hunt') {
        return `Besiege ${required} ${MOB_NAMES[objective.mobType] || objective.mobType}`;
    }
    if (objective.type === 'structure') {
        return objective.structureKind === 'mine'
            ? 'Erreiche die Belohnungskammer einer großen Mine'
            : 'Erreiche die Belohnungskammer eines Dungeons';
    }
    if (objective.type === 'boss') {
        return 'Besiege das Blutmondecho am Ritualaltar';
    }
    return String(objective.type || 'Unbekanntes Ziel');
}
