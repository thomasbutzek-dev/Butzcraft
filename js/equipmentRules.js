import { BLOCK_TYPES } from './blockTypes.js?v=20260723a';

export const EQUIPMENT_SLOTS = Object.freeze([
    Object.freeze({ id: 'head', label: 'Kopf', inventoryIndex: 8, weight: 0.2 }),
    Object.freeze({ id: 'body', label: 'Körper', inventoryIndex: 9, weight: 0.3 }),
    Object.freeze({ id: 'arms', label: 'Arme', inventoryIndex: 10, weight: 0.15 }),
    Object.freeze({ id: 'legs', label: 'Beine', inventoryIndex: 11, weight: 0.2 }),
    Object.freeze({ id: 'feet', label: 'Füße', inventoryIndex: 12, weight: 0.15 })
]);

const ARMOR_TIERS = Object.freeze([
    Object.freeze({
        id: 'brush', label: 'Leichte Rüstung',
        types: Object.freeze([
            BLOCK_TYPES.BRUSH_HELMET, BLOCK_TYPES.BRUSH_CHEST, BLOCK_TYPES.BRUSH_ARMS,
            BLOCK_TYPES.BRUSH_LEGS, BLOCK_TYPES.BRUSH_BOOTS
        ]),
        protection: 0.1,
        maxDurability: 90, color: '#587d39', accent: '#8b6b3d', material: 'brush'
    }),
    Object.freeze({
        id: 'fur', label: 'Fellrüstung',
        types: Object.freeze([
            BLOCK_TYPES.FUR_HELMET, BLOCK_TYPES.FUR_CHEST, BLOCK_TYPES.FUR_ARMS,
            BLOCK_TYPES.FUR_LEGS, BLOCK_TYPES.FUR_BOOTS
        ]),
        protection: 0.17,
        maxDurability: 160, color: '#d8d1bd', accent: '#8c765d', material: 'fur'
    }),
    Object.freeze({
        id: 'wood', label: 'Holzrüstung',
        types: Object.freeze([
            BLOCK_TYPES.WOOD_ARMOR_HELMET, BLOCK_TYPES.WOOD_ARMOR_CHEST, BLOCK_TYPES.WOOD_ARMOR_ARMS,
            BLOCK_TYPES.WOOD_ARMOR_LEGS, BLOCK_TYPES.WOOD_ARMOR_BOOTS
        ]),
        protection: 0.25,
        maxDurability: 260, color: '#7a4f2b', accent: '#c09555', material: 'wood'
    }),
    Object.freeze({
        id: 'iron', label: 'Eisenrüstung',
        types: Object.freeze([
            BLOCK_TYPES.IRON_HELMET, BLOCK_TYPES.IRON_CHEST, BLOCK_TYPES.IRON_ARMS,
            BLOCK_TYPES.IRON_LEGS, BLOCK_TYPES.IRON_BOOTS
        ]),
        protection: 0.36,
        maxDurability: 520, color: '#aeb8bf', accent: '#5d6972', material: 'iron'
    }),
    Object.freeze({
        id: 'reinforcedIron', label: 'Verstärkte Eisenrüstung',
        types: Object.freeze([
            BLOCK_TYPES.REINFORCED_IRON_HELMET, BLOCK_TYPES.REINFORCED_IRON_CHEST, BLOCK_TYPES.REINFORCED_IRON_ARMS,
            BLOCK_TYPES.REINFORCED_IRON_LEGS, BLOCK_TYPES.REINFORCED_IRON_BOOTS
        ]),
        protection: 0.5,
        maxDurability: 900, color: '#697780', accent: '#d0a93f', material: 'reinforcedIron'
    }),
    Object.freeze({
        id: 'bloodMoon', label: 'Blutmondrüstung',
        types: Object.freeze([
            BLOCK_TYPES.BLOOD_MOON_HELMET, BLOCK_TYPES.BLOOD_MOON_CHEST, BLOCK_TYPES.BLOOD_MOON_ARMS,
            BLOCK_TYPES.BLOOD_MOON_LEGS, BLOCK_TYPES.BLOOD_MOON_BOOTS
        ]),
        protection: 0.6,
        maxDurability: 1200, color: '#5b1524', accent: '#ef4968', material: 'bloodMoon',
        questOnly: true
    })
]);

const PIECE_NAMES = Object.freeze({
    head: 'Helm',
    body: 'Harnisch',
    arms: 'Armschutz',
    legs: 'Beinschutz',
    feet: 'Stiefel'
});

const ARMOR_BY_TYPE = new Map();
for (const tier of ARMOR_TIERS) {
    EQUIPMENT_SLOTS.forEach((slot, offset) => {
        const type = tier.types[offset];
        ARMOR_BY_TYPE.set(type, Object.freeze({
            type,
            tier: tier.id,
            setLabel: tier.label,
            name: `${tier.label} – ${PIECE_NAMES[slot.id]}`,
            slot: slot.id,
            inventoryIndex: slot.inventoryIndex,
            protection: tier.protection * slot.weight,
            maxDurability: tier.maxDurability,
            color: tier.color,
            accent: tier.accent,
            material: tier.material,
            questOnly: Boolean(tier.questOnly)
        }));
    });
}

export function getArmorInfo(type) {
    return ARMOR_BY_TYPE.get(Number(type)) || null;
}

export function isArmorType(type) {
    return getArmorInfo(type) !== null;
}

export function getArmorSetItems(tierId) {
    const tier = ARMOR_TIERS.find(candidate => candidate.id === tierId);
    if (!tier) return [];
    return tier.types.map(type => ({
        type,
        count: 1
    }));
}

export function getEquippedArmor(inventorySlots) {
    return EQUIPMENT_SLOTS.map(slot => inventorySlots?.[slot.inventoryIndex])
        .filter(item => item && item.count > 0 && getArmorInfo(item.type));
}

export function getArmorProtection(inventorySlots) {
    const protection = getEquippedArmor(inventorySlots)
        .reduce((total, item) => total + getArmorInfo(item.type).protection, 0);
    return Math.max(0, Math.min(0.65, protection));
}

export function applyArmorDamage(inventorySlots, incomingDamage) {
    const rawDamage = Math.max(0, Number(incomingDamage) || 0);
    const protection = getArmorProtection(inventorySlots);
    const broken = [];

    if (rawDamage > 0) {
        const wear = rawDamage * 0.35;
        for (const slot of EQUIPMENT_SLOTS) {
            const item = inventorySlots?.[slot.inventoryIndex];
            const armor = item && item.count > 0 ? getArmorInfo(item.type) : null;
            if (!armor) continue;
            const current = Number.isFinite(item.durability) ? item.durability : armor.maxDurability;
            item.durability = Math.max(0, current - wear);
            if (item.durability === 0) {
                broken.push({ slot: slot.id, type: item.type, name: armor.name });
                inventorySlots[slot.inventoryIndex] = { type: 0, count: 0 };
            }
        }
    }

    return {
        damage: rawDamage * (1 - protection),
        absorbed: rawDamage * protection,
        protection,
        broken
    };
}

export function equipArmorFromInventory(inventorySlots, inventoryIndex) {
    const source = inventorySlots?.[inventoryIndex];
    const armor = source && source.count > 0 ? getArmorInfo(source.type) : null;
    if (!armor || EQUIPMENT_SLOTS.some(slot => slot.inventoryIndex === inventoryIndex)) {
        return { equipped: false, reason: 'not-equippable' };
    }

    const targetIndex = armor.inventoryIndex;
    const equipped = inventorySlots[targetIndex] || { type: 0, count: 0 };
    inventorySlots[targetIndex] = { ...source, count: 1 };
    inventorySlots[inventoryIndex] = equipped.count > 0 ? { ...equipped, count: 1 } : { type: 0, count: 0 };
    return { equipped: true, slot: armor.slot, replaced: equipped.count > 0 };
}

export function unequipArmorToInventory(inventorySlots, slotId) {
    const slot = EQUIPMENT_SLOTS.find(candidate => candidate.id === slotId);
    const equipped = slot ? inventorySlots?.[slot.inventoryIndex] : null;
    if (!slot || !equipped || equipped.count <= 0) return { unequipped: false, reason: 'empty' };

    const freeIndex = inventorySlots.findIndex((item, index) => (
        !EQUIPMENT_SLOTS.some(equipmentSlot => equipmentSlot.inventoryIndex === index) &&
        (!item || item.type === 0 || item.count <= 0)
    ));
    if (freeIndex < 0) return { unequipped: false, reason: 'inventory-full' };

    inventorySlots[freeIndex] = { ...equipped, count: 1 };
    inventorySlots[slot.inventoryIndex] = { type: 0, count: 0 };
    return { unequipped: true, inventoryIndex: freeIndex };
}

export function getArmorIconHTML(type, mini = false) {
    const armor = getArmorInfo(type);
    if (!armor) return '';
    const sizeClass = mini ? ' armor-icon-mini' : '';
    return `<span class="armor-item-icon${sizeClass}" data-armor-slot="${armor.slot}" style="--armor-color:${armor.color};--armor-accent:${armor.accent}" aria-hidden="true"></span>`;
}

export const ARMOR_ITEM_TYPES = Object.freeze([...ARMOR_BY_TYPE.keys()]);
