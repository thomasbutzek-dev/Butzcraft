import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

afterEach(() => {
    window.history.replaceState({}, '', '/');
    delete document.documentElement.dataset.graphicsVariant;
    delete window.Game;
});

describe('production graphics style', () => {
    it('has no runtime variant switch or prototype naming', () => {
        const source = readFileSync('js/graphicsStyle.js', 'utf8');

        expect(source).not.toContain('KeyG');
        expect(source).not.toContain('graphicsPrototype');
        expect(source.toLowerCase()).not.toContain('prototype');
        expect(source).not.toContain('URLSearchParams');
        expect(source).not.toContain('window.location.assign');
    });

    it('keeps only device detail as runtime graphics state', async () => {
        window.history.replaceState({}, '', '/?graphicsPrototype=A');

        const { graphicsStyle } = await import('../js/graphicsStyle.js?test=fixed-painterly');

        expect(Object.keys(graphicsStyle)).toEqual(['reducedDetail']);
        expect(document.documentElement.dataset.graphicsVariant).toBeUndefined();
    });

    it('always applies the painterly production atmosphere', async () => {
        const renderer = {};
        const ambient = new THREE.AmbientLight(0xffffff, 1);
        const sun = new THREE.DirectionalLight(0xffffff, 1);
        window.Game = { renderer, world: { scene: { children: [ambient, sun] } } };

        await import('../js/graphicsStyle.js?test=production-atmosphere');

        expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
        expect(renderer.toneMappingExposure).toBeCloseTo(1.1);
        expect(ambient.intensity).toBeCloseTo(0.88);
        expect(ambient.userData.painterlyDayIntensity).toBeCloseTo(0.88);
        expect(ambient.userData.painterlyNightIntensity).toBeCloseTo(0.18);
        expect(ambient.color.getHex()).toBe(0xdde6d7);
        expect(sun.color.getHex()).toBe(0xffdfb0);
    });
});
