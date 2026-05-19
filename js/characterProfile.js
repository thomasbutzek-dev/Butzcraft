export const CHARACTER_PROFILE_VERSION = 1;

export const DEFAULT_CHARACTER_PROFILE = Object.freeze({
    version: CHARACTER_PROFILE_VERSION,
    id: 'local-player',
    displayName: 'Butz',
    gender: 'male',
    bodyType: 'classic',
    hairStyle: 'short',
    accessory: 'none',
    colors: Object.freeze({
        skin: '#c98f64',
        hair: '#2f2219',
        eyes: '#4aa3df',
        shirt: '#3f8f5f',
        pants: '#2f5f9f',
        boots: '#2b2420',
        accent: '#d4a94f'
    }),
    textures: Object.freeze({
        skinDetail: 'soft',
        fabric: 'woven',
        outfitPattern: 'trim'
    })
});

const GENDERS = new Set(['male', 'female']);
const BODY_TYPES = new Set(['classic', 'slim', 'sturdy']);
const HAIR_STYLES = new Set(['short', 'flat', 'mohawk', 'curly', 'long', 'ponytail', 'cap', 'none']);
const ACCESSORIES = new Set(['none', 'cape', 'pack', 'scarf', 'goggles']);
const SKIN_DETAILS = new Set(['soft', 'freckles', 'scar', 'sunmark']);
const FABRICS = new Set(['plain', 'woven', 'leather', 'iron']);
const OUTFIT_PATTERNS = new Set(['none', 'trim', 'stripes', 'checker', 'panel']);
const COLOR_KEYS = Object.keys(DEFAULT_CHARACTER_PROFILE.colors);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function createCharacterProfile(overrides = {}) {
    return normalizeCharacterProfile({
        ...DEFAULT_CHARACTER_PROFILE,
        ...overrides,
        colors: {
            ...DEFAULT_CHARACTER_PROFILE.colors,
            ...(overrides.colors || {})
        },
        textures: {
            ...DEFAULT_CHARACTER_PROFILE.textures,
            ...(overrides.textures || {})
        }
    });
}

export function normalizeCharacterProfile(raw = {}) {
    const fallback = DEFAULT_CHARACTER_PROFILE;
    const colors = {};

    for (const key of COLOR_KEYS) {
        const value = raw.colors?.[key];
        colors[key] = HEX_COLOR.test(value || '') ? value.toLowerCase() : fallback.colors[key];
    }

    return {
        version: CHARACTER_PROFILE_VERSION,
        id: normalizeId(raw.id, fallback.id),
        displayName: normalizeName(raw.displayName, fallback.displayName),
        gender: GENDERS.has(raw.gender) ? raw.gender : fallback.gender,
        bodyType: BODY_TYPES.has(raw.bodyType) ? raw.bodyType : fallback.bodyType,
        hairStyle: HAIR_STYLES.has(raw.hairStyle) ? raw.hairStyle : fallback.hairStyle,
        accessory: ACCESSORIES.has(raw.accessory) ? raw.accessory : fallback.accessory,
        colors,
        textures: {
            skinDetail: SKIN_DETAILS.has(raw.textures?.skinDetail) ? raw.textures.skinDetail : fallback.textures.skinDetail,
            fabric: FABRICS.has(raw.textures?.fabric) ? raw.textures.fabric : fallback.textures.fabric,
            outfitPattern: OUTFIT_PATTERNS.has(raw.textures?.outfitPattern) ? raw.textures.outfitPattern : fallback.textures.outfitPattern
        }
    };
}

export function serializeCharacterProfile(profile) {
    return JSON.stringify(normalizeCharacterProfile(profile), null, 2);
}

export function parseCharacterProfile(text) {
    return normalizeCharacterProfile(JSON.parse(text));
}

function normalizeName(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim().replace(/\s+/g, ' ');
    return trimmed ? trimmed.slice(0, 20) : fallback;
}

function normalizeId(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return /^[a-z0-9_-]{3,40}$/i.test(trimmed) ? trimmed : fallback;
}
