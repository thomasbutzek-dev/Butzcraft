import * as THREE from 'three';
import { graphicsPrototype } from './graphicsPrototype.js?v=20260718c';

const atlasUrls = [
    new URL('../assets/graphics-prototype/entity-material-tiles-a.png', import.meta.url).href,
    new URL('../assets/graphics-prototype/entity-material-tiles-b.png', import.meta.url).href
];
const atlasLoads = [];
const atlases = graphicsPrototype.usesPainterlyTextures
    ? atlasUrls.map((url) => {
        let finishLoad;
        const loaded = new Promise(resolve => { finishLoad = resolve; });
        atlasLoads.push(loaded);
        const texture = new THREE.TextureLoader().load(url, finishLoad, undefined, finishLoad);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        return texture;
    })
    : [];
const textureCache = new Map();

export function preloadEntityMaterials() {
    return Promise.all(atlasLoads);
}

export function selectEntityTextureVariant(x, z, salt = 0) {
    const hash = Math.imul(Math.floor(x), 374761393) + Math.imul(Math.floor(z), 668265263) + Math.imul(salt, 1274126177);
    return ((hash ^ (hash >>> 13)) >>> 0) % 2;
}

export function getPainterlyEntityTexture(tileIndex, variant = 0) {
    if (!graphicsPrototype.usesPainterlyTextures) return null;
    const normalizedVariant = Math.abs(variant) % atlases.length;
    const key = `${normalizedVariant}:${tileIndex}`;
    let texture = textureCache.get(key);
    if (texture) return texture;

    texture = atlases[normalizedVariant].clone();
    const tileSize = 1 / 4;
    texture.repeat.set(tileSize, tileSize);
    texture.offset.set((tileIndex % 4) * tileSize, 1 - (Math.floor(tileIndex / 4) + 1) * tileSize);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    textureCache.set(key, texture);
    return texture;
}
