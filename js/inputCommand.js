const UI_KEYS = new Set(['Tab', 'Escape', 'KeyE']);

export function resolveUiInputCommand({
    code,
    inventoryOpen = false,
    furnaceOpen = false,
    chestOpen = false,
    tradeOpen = false,
    paused = false
}) {
    if (!UI_KEYS.has(code)) return null;
    if (inventoryOpen) return 'close-inventory';
    if (furnaceOpen) return 'close-furnace';
    if (chestOpen) return 'close-chest';
    if (tradeOpen) return 'close-trade';
    if (code === 'KeyE') return 'toggle-inventory';
    return paused ? 'resume' : 'pause';
}
