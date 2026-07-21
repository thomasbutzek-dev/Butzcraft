import { normalizeCharacterProfile, serializeCharacterProfile } from './characterProfile.js';

export const CHARACTER_TRANSFER_KEY = 'character';
export const CHARACTER_TRANSFER_STORAGE_KEY = 'butzcraft.characterProfile';

export function encodeCharacterTransfer(profile) {
    const bytes = new TextEncoder().encode(serializeCharacterProfile(normalizeCharacterProfile(profile)));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function decodeCharacterTransfer(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 8192) {
        throw new Error('Invalid character transfer payload');
    }

    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return normalizeCharacterProfile(JSON.parse(new TextDecoder().decode(bytes)));
}

export function readCharacterTransfer(hash) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/u, ''));
    const payload = params.get(CHARACTER_TRANSFER_KEY);
    if (!payload) return null;
    return decodeCharacterTransfer(payload);
}

export function createCharacterPlayUrl(profile, target = 'https://play.butzcraft.de/') {
    const url = new URL(target, globalThis.location?.href || 'https://butzcraft.de/');
    url.hash = new URLSearchParams({
        [CHARACTER_TRANSFER_KEY]: encodeCharacterTransfer(profile)
    }).toString();
    return url.toString();
}

export function getCharacterPlayTarget(location = globalThis.location) {
    if (location?.hostname === 'localhost' || location?.hostname === '127.0.0.1') {
        return new URL('index.html', location.href).toString();
    }
    return 'https://play.butzcraft.de/';
}

export function removeCharacterTransferFromUrl(location = globalThis.location, history = globalThis.history) {
    if (!location || !history) return;
    const params = new URLSearchParams(String(location.hash || '').replace(/^#/u, ''));
    if (!params.has(CHARACTER_TRANSFER_KEY)) return;
    params.delete(CHARACTER_TRANSFER_KEY);
    const cleanHash = params.toString();
    history.replaceState(null, '', `${location.pathname}${location.search}${cleanHash ? `#${cleanHash}` : ''}`);
}
