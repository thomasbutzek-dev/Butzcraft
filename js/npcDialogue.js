import { getProfessionChainStatus, getSideQuestProgress } from './quests.js?v=20260723e';

const GREETINGS = [
    'Die Esse verrät mir mehr über ein Dorf als jedes Gerücht.',
    'Ein gutes Dorf wächst mit jeder helfenden Hand.',
    'Willkommen. Gute Wege bringen gute Geschäfte.',
    'Jede Ruine erzählt eine Geschichte – wenn man richtig zuhört.'
];

const STORY_LORE = [
    'Die ersten Nächte prüfen jeden Reisenden. Ein Bett und ein sicherer Unterstand sind mehr wert als Gold.',
    'Unser Dorf vergisst weder Hilfe noch leere Versprechen. Vertrauen musst du dir hier verdienen.',
    'Beim Blutmond werden alte Dinge wach. Bleib im Licht und unterschätze die Nacht nicht.',
    'Große Minen reichen tiefer als gewöhnliche Stollen. Manche enden dort, wo ältere Wege beginnen.',
    'Die Dungeons wurden nicht gebaut, um Schätze zu schützen. Sie sollten etwas darunter einsperren.',
    'Tiefenkristall und Blutsiegel gehören zu demselben Ritual. In der Endkammer steht der Altar noch immer.',
    'Der Wächter ist nur die Gestalt der Quelle. Selbst nach seinem Fall können Blutmondechos zurückkehren.'
];

function loreIndex(mainQuestIndex) {
    if (mainQuestIndex >= 10) return 6;
    if (mainQuestIndex >= 8) return 5;
    if (mainQuestIndex >= 5) return 4;
    if (mainQuestIndex >= 4) return 3;
    if (mainQuestIndex >= 3) return 2;
    if (mainQuestIndex >= 1) return 1;
    return 0;
}

export function getNpcConversation({ npc, questState, villageState, inventorySlots = [] }) {
    const professionIdx = Math.max(0, Math.min(3, Math.floor(Number(npc?.professionIdx) || 0)));
    const speaker = npc?.displayName || npc?.profession?.name || 'Dorfbewohner';
    const greeting = GREETINGS[professionIdx];
    const lore = STORY_LORE[loreIndex(questState?.mainQuestIndex || 0)];
    const chainStatus = npc?.villageId
        ? getProfessionChainStatus(questState, npc.villageId, professionIdx, questState?.mainQuestIndex || 0)
        : { state: 'unavailable', quest: null, reason: null };
    const dynamicOffer = (villageState?.offers || []).find(offer => (
        offer.professionIdx === professionIdx
        && !(questState?.activeSideQuests || []).some(quest => quest.id === offer.id)
        && !(questState?.completedQuestIds || []).includes(offer.id)
        && !(questState?.abandonedQuestIds || []).includes(offer.id)
    ));
    const quest = chainStatus.quest || dynamicOffer || null;
    let phase = chainStatus.state;
    if (!chainStatus.quest && dynamicOffer) phase = 'available';
    const progress = quest ? getSideQuestProgress(quest, inventorySlots) : null;
    if (phase === 'active' && progress?.complete) phase = 'complete';

    let text = greeting;
    if (quest && phase === 'available') text = quest.dialogue?.offer || `Ich könnte deine Hilfe bei „${quest.title}“ gebrauchen.`;
    else if (quest && phase === 'active') text = quest.dialogue?.progress || `Der Auftrag „${quest.title}“ ist noch nicht erledigt.`;
    else if (quest && phase === 'complete') text = quest.dialogue?.complete || `Du hast „${quest.title}“ erfüllt. Lass uns abrechnen.`;
    else if (chainStatus.state === 'locked') text = `${greeting} ${chainStatus.reason}`;
    else if (chainStatus.state === 'complete') text = `${greeting} Du hast bereits alles getan, worum ich dich bitten konnte.`;

    return {
        speaker,
        text,
        lore,
        phase,
        quest,
        progress,
        details: quest?.dialogue?.details || (quest ? `Auftrag: ${quest.title}` : lore),
        actions: [
            ...(phase === 'available' && quest ? [{ id: 'accept', label: `Annehmen: ${quest.title}` }] : []),
            ...(phase === 'complete' && quest ? [{ id: 'turn-in', label: `Abgeben: ${quest.title}` }] : []),
            ...(phase === 'active' && quest ? [{ id: 'progress', label: 'Zum Auftrag nachfragen' }] : []),
            { id: 'ask', label: 'Nachfragen' },
            { id: 'trade', label: 'Handeln' },
            { id: 'decline', label: 'Vielleicht später' }
        ]
    };
}
