import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

afterEach(() => {
    window.history.replaceState({}, '', '/');
    delete document.documentElement.dataset.graphicsVariant;
    document.getElementById('graphics-variant-notice')?.remove();
    delete window.Game;
});

describe('graphics prototype default', () => {
    it('keeps the graphics switcher invisible and binds it to G', () => {
        const source = readFileSync('js/graphicsPrototype.js', 'utf8');

        expect(source).toContain("event.code !== 'KeyG'");
        expect(source).not.toContain("graphics-prototype-switcher");
    });

    it('uses the selected painterly style without requiring a URL parameter', async () => {
        window.history.replaceState({}, '', '/');

        const { graphicsPrototype } = await import('../js/graphicsPrototype.js?test=default-painterly');

        expect(graphicsPrototype.variant).toBe('B');
        expect(graphicsPrototype.usesPainterlyTextures).toBe(true);
        expect(document.documentElement.dataset.graphicsVariant).toBe('B');
    });

    it('keeps the original style available through an explicit comparison URL', async () => {
        window.history.replaceState({}, '', '/?graphicsPrototype=A');

        const { graphicsPrototype } = await import('../js/graphicsPrototype.js?test=explicit-original');

        expect(graphicsPrototype.variant).toBe('A');
        expect(graphicsPrototype.usesPainterlyTextures).toBe(false);
        expect(document.getElementById('graphics-prototype-switcher')).toBeNull();
        expect(document.getElementById('graphics-variant-notice')?.textContent).toBe('Grafikversion A — Original');
    });

    it('applies the painterly atmosphere without the development switcher', async () => {
        window.history.replaceState({}, '', '/');
        const renderer = {};
        const ambient = new THREE.AmbientLight(0xffffff, 1);
        const sun = new THREE.DirectionalLight(0xffffff, 1);
        window.Game = { renderer, world: { scene: { children: [ambient, sun] } } };

        await import('../js/graphicsPrototype.js?test=production-atmosphere');

        expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
        expect(renderer.toneMappingExposure).toBeCloseTo(1.1);
        expect(ambient.intensity).toBeCloseTo(0.88);
        expect(ambient.userData.painterlyDayIntensity).toBeCloseTo(0.88);
        expect(ambient.userData.painterlyNightIntensity).toBeCloseTo(0.18);
        expect(ambient.color.getHex()).toBe(0xdde6d7);
        expect(sun.color.getHex()).toBe(0xffdfb0);
    });
});
