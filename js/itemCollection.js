import { addItemToInventory } from './inventory.js?v=20260721b';

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

export function updateDroppedItemVisual(item, delta, painterly) {
    if (!painterly || !item?.mesh?.rotation) return;
    if (!Number.isFinite(item.visualPhase)) {
        item.visualPhase = ((item.blockType || 0) * 0.73) % (Math.PI * 2);
    }

    const age = Number.isFinite(item.age) ? item.age : 0;
    const speed = 0.62 + ((item.blockType || 0) % 5) * 0.07;
    item.mesh.rotation.y += delta * speed;
    item.mesh.rotation.z = Math.sin(age * 1.7 + item.visualPhase) * 0.085;
}
