export function getItemTotal(inventorySlots, type) {
    if (!Array.isArray(inventorySlots)) return 0;
    return inventorySlots.reduce((total, slot) => total + (slot && slot.type === type ? slot.count : 0), 0);
}

export function canCompleteQuest(inventorySlots, quest) {
    return Boolean(quest && quest.give && getItemTotal(inventorySlots, quest.give.type) >= quest.give.count);
}

export function getQuestProgress(inventorySlots, quest) {
    if (!quest || !quest.give) return { current: 0, required: 0, missing: 0, complete: false };
    const current = getItemTotal(inventorySlots, quest.give.type);
    const required = quest.give.count;
    return {
        current,
        required,
        missing: Math.max(0, required - current),
        complete: current >= required
    };
}

export function removeQuestItems(inventorySlots, quest) {
    if (!canCompleteQuest(inventorySlots, quest)) return false;

    let toRemove = quest.give.count;
    for (const slot of inventorySlots) {
        if (toRemove <= 0) break;
        if (slot.type !== quest.give.type) continue;

        const remove = Math.min(slot.count, toRemove);
        slot.count -= remove;
        toRemove -= remove;
        if (slot.count <= 0) {
            slot.type = 0;
            slot.count = 0;
        }
    }

    return true;
}
