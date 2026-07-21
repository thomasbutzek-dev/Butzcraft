import { describe, expect, it } from 'vitest';
import { createCharacterProfile } from '../js/characterProfile.js';
import {
    createCharacterPlayUrl,
    decodeCharacterTransfer,
    encodeCharacterTransfer,
    readCharacterTransfer,
    removeCharacterTransferFromUrl
} from '../js/characterTransfer.js';

describe('character transfer', () => {
    it('round-trips a validated profile with unicode text', () => {
        const profile = createCharacterProfile({ displayName: 'Jörg Craft', hairStyle: 'mohawk' });
        expect(decodeCharacterTransfer(encodeCharacterTransfer(profile))).toEqual(profile);
    });

    it('creates a fragment URL that does not expose the profile to the server', () => {
        const profile = createCharacterProfile({ displayName: 'Ada' });
        const url = new URL(createCharacterPlayUrl(profile, 'https://play.butzcraft.de/'));

        expect(url.origin).toBe('https://play.butzcraft.de');
        expect(url.search).toBe('');
        expect(readCharacterTransfer(url.hash)).toEqual(profile);
    });

    it('rejects malformed and oversized payloads', () => {
        expect(() => decodeCharacterTransfer('not-a-profile')).toThrow();
        expect(() => decodeCharacterTransfer('a'.repeat(8193))).toThrow('Invalid character transfer payload');
    });

    it('removes only the character data from the visible URL', () => {
        const calls = [];
        removeCharacterTransferFromUrl(
            { pathname: '/index.html', search: '?mode=test', hash: '#character=profile&debug=1' },
            { replaceState: (...args) => calls.push(args) }
        );

        expect(calls).toEqual([[null, '', '/index.html?mode=test#debug=1']]);
    });
});
