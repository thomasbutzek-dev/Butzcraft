import { addItemToInventory } from './inventory.js?v=20260716i';

export function addItemOrCreateDrop(type, count, createDrop) {
    const result = addItemToInventory(type, count);
    if (result.remaining <= 0 || typeof createDrop !== 'function') {
        return { ...result, dropped: 0 };
    }

    createDrop(type, result.remaining);
    return { added: result.added, remaining: 0, dropped: result.remaining };
}

export function tryCollectDroppedItem(items, index, disposeDrop) {
    const item = items[index];
    if (!item) return false;

    const result = addItemToInventory(item.blockType, item.count || 1);
    if (result.remaining > 0) return false;

    disposeDrop(item);
    items.splice(index, 1);
    return true;
}
