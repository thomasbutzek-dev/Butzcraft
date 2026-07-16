import { getToolInfo } from './miningRules.js?v=20260716a';

const SWORDS = Object.freeze({
    89: Object.freeze({ material: 'Holz', damage: 5, cooldown: 0.65, maxDurability: 100, color: 0xCD853F }),
    90: Object.freeze({ material: 'Stein', damage: 7, cooldown: 0.58, maxDurability: 200, color: 0x888888 }),
    91: Object.freeze({ material: 'Eisen', damage: 9, cooldown: 0.50, maxDurability: 450, color: 0xC0C0C0 }),
    92: Object.freeze({ material: 'Gold', damage: 11, cooldown: 0.38, maxDurability: 180, color: 0xFFD700 })
});

const BOW = Object.freeze({ damage: 6, cooldown: 0.75, maxDurability: 180, color: 0x8B6B3D });

export function getSwordInfo(type) {
    return SWORDS[type] || null;
}

export function isSwordType(type) {
    return getSwordInfo(type) !== null;
}

export function getBowInfo(type) {
    return type === 94 ? BOW : null;
}

export function isBowType(type) {
    return getBowInfo(type) !== null;
}

export function getAttackProfile(type) {
    const sword = getSwordInfo(type);
    if (sword) return { kind: 'sword', usesDurability: true, ...sword };
    if (getToolInfo(type)) return { kind: 'tool', damage: 3, cooldown: 0.7, usesDurability: false };
    return { kind: 'hand', damage: 2, cooldown: 0.8, usesDurability: false };
}
