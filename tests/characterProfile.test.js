import { describe, it, expect } from 'vitest';
import {
    DEFAULT_CHARACTER_PROFILE,
    createCharacterProfile,
    normalizeCharacterProfile,
    parseCharacterProfile,
    serializeCharacterProfile
} from '../js/characterProfile.js';

describe('characterProfile', () => {
    it('creates the default profile shape for later multiplayer use', () => {
        expect(createCharacterProfile()).toEqual(DEFAULT_CHARACTER_PROFILE);
    });

    it('keeps valid player choices', () => {
        const profile = normalizeCharacterProfile({
            id: 'player_123',
            displayName: '  Ada   Craft  ',
            gender: 'female',
            bodyType: 'slim',
            hairStyle: 'ponytail',
            accessory: 'cape',
            colors: {
                skin: '#AABBCC',
                hair: '#111111',
                eyes: '#222222',
                shirt: '#333333',
                pants: '#444444',
                boots: '#555555',
                accent: '#ABCDEF'
            },
            textures: {
                skinDetail: 'freckles',
                fabric: 'leather',
                outfitPattern: 'checker'
            }
        });

        expect(profile).toEqual({
            version: 1,
            id: 'player_123',
            displayName: 'Ada Craft',
            gender: 'female',
            bodyType: 'slim',
            hairStyle: 'ponytail',
            accessory: 'cape',
            colors: {
                skin: '#aabbcc',
                hair: '#111111',
                eyes: '#222222',
                shirt: '#333333',
                pants: '#444444',
                boots: '#555555',
                accent: '#abcdef'
            },
            textures: {
                skinDetail: 'freckles',
                fabric: 'leather',
                outfitPattern: 'checker'
            }
        });
    });

    it('falls back for invalid imported values', () => {
        const profile = normalizeCharacterProfile({
            id: '../bad',
            displayName: '',
            gender: 'robot',
            bodyType: 'giant',
            hairStyle: 'wizard',
            accessory: 'rocket',
            colors: {
                skin: 'red'
            },
            textures: {
                skinDetail: 'mud',
                fabric: 'paper',
                outfitPattern: 'noise'
            }
        });

        expect(profile).toEqual(DEFAULT_CHARACTER_PROFILE);
    });

    it('round-trips serialized profile JSON', () => {
        const profile = createCharacterProfile({
            displayName: 'Nora',
            gender: 'female',
            bodyType: 'sturdy',
            colors: { shirt: '#b24b3f' },
            textures: { outfitPattern: 'stripes' }
        });

        expect(parseCharacterProfile(serializeCharacterProfile(profile))).toEqual(profile);
    });
});
