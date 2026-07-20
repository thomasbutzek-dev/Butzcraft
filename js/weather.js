/* js/weather.js — Butzcraft Wetter-System (Tier 3)
 *
 * State-Machine mit den Zuständen: clear → rain/snow → thunderstorm → clear
 * Steuert Partikel, Sky-Verdunkelung, Fog-Dichte, Blitze und Feuer.
 *
 * Einsatz in GameMain.js:
 *   const weather = new WeatherSystem(scene, world, CONFIG);
 *   weather.update(delta, playerPos, biome);
 *   // Im Render-Loop: weather.getState(), weather.getIntensity()
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js?v=20260507b';
import { ParticleSystem } from './particles.js?v=20260719a';
import { BIOMES } from './world.js?v=20260721b';
import { SoundManager } from './sound.js?v=20260507b';
import { graphicsPrototype } from './graphicsPrototype.js?v=20260718c';

const W = CONFIG.WEATHER;

// Brennbare Block-Typen (Holz, Blätter, Planken, Wolle etc.)
const FLAMMABLE_IDS = new Set([5, 6, 13, 14, 15, 16, 19, 26, 43, 44, 46, 49, 50, 52, 81, 88]);

export function getWeatherVisualProfile(painterly = graphicsPrototype.usesPainterlyTextures) {
    return painterly
        ? { rainSkyDarkening: 0.2, stormSkyDarkening: 0.36, rainFog: 0.014, stormFog: 0.022, snowFog: 0.017, lightningFlash: 1.35 }
        : { rainSkyDarkening: 0.3, stormSkyDarkening: 0.5, rainFog: 0.02, stormFog: 0.03, snowFog: 0.025, lightningFlash: 1.5 };
}

export class WeatherSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {import('./world.js').World} world
     */
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.painterly = graphicsPrototype.usesPainterlyTextures;
        this.visualProfile = getWeatherVisualProfile(this.painterly);

        // State
        this.state = 'clear';       // 'clear' | 'rain' | 'snow' | 'thunderstorm'
        this.stateTimer = this._randomDuration('clear');
        this.intensity = 0;         // 0..1, faded rein/raus
        this.targetIntensity = 0;

        // Partikel-Systeme (lazy init)
        this.rainParticles = null;
        this.snowParticles = null;

        // Blitz
        this.lightningTimer = 0;
        this.lightningVisualTimer = 0;
        this.lightningBolt = null;
        this.lightningFlash = 0;    // Countdown für weißen Flash (Sekunden)
        this.lightningActive = false;
        this.rainCyclesWithoutStorm = 0;

        // Regen-Sound
        this.rainSoundPlaying = false;

        // Feuer-Tracking
        this.fireUpdateTimer = 0;
    }

    /**
     * Hauptupdate — einmal pro Frame aufrufen.
     * @param {number} delta — Sekunden
     * @param {THREE.Vector3} playerPos
     * @param {string} biome — aktuelles Biom des Spielers
     */
    update(delta, playerPos, biome) {
        // State-Timer runterzählen
        this.stateTimer -= delta;
        if (this.stateTimer <= 0) {
            this._transitionState(biome);
        }

        // Intensität faden
        const fadeSpeed = 0.3; // Pro Sekunde
        if (this.intensity < this.targetIntensity) {
            this.intensity = Math.min(this.targetIntensity, this.intensity + fadeSpeed * delta);
        } else if (this.intensity > this.targetIntensity) {
            this.intensity = Math.max(this.targetIntensity, this.intensity - fadeSpeed * delta);
        }

        // Partikel-Updates
        if (this.state === 'rain' || this.state === 'thunderstorm') {
            if (!this.rainParticles) {
                this.rainParticles = new ParticleSystem(this.scene, 'rain', W.RAIN_PARTICLES, this.world);
            }
            this.rainParticles.update(delta, playerPos, this.intensity);

            // Regen-Sound
            if (!this.rainSoundPlaying && this.intensity > 0.1) {
                SoundManager.playRainLoop(true);
                this.rainSoundPlaying = true;
            }
        } else {
            if (this.rainParticles && this.intensity <= 0.01) {
                this.rainParticles.dispose();
                this.rainParticles = null;
            } else if (this.rainParticles) {
                this.rainParticles.update(delta, playerPos, this.intensity);
            }
            if (this.rainSoundPlaying && this.intensity <= 0.05) {
                SoundManager.playRainLoop(false);
                this.rainSoundPlaying = false;
            }
        }

        if (this.state === 'snow') {
            if (!this.snowParticles) {
                this.snowParticles = new ParticleSystem(this.scene, 'snow', W.SNOW_PARTICLES, this.world);
            }
            this.snowParticles.update(delta, playerPos, this.intensity);
        } else {
            if (this.snowParticles && this.intensity <= 0.01) {
                this.snowParticles.dispose();
                this.snowParticles = null;
            } else if (this.snowParticles) {
                this.snowParticles.update(delta, playerPos, this.intensity);
            }
        }

        // Gewitter: Blitze
        if (this.state === 'thunderstorm') {
            this.lightningTimer -= delta;
            if (this.lightningTimer <= 0) {
                this._strikeLightning(playerPos);
                this.lightningTimer = W.LIGHTNING_MIN + Math.random() * (W.LIGHTNING_MAX - W.LIGHTNING_MIN);
            }
        }

        // Blitz-Flash abklingen
        if (this.lightningFlash > 0) {
            this.lightningFlash -= delta;
            if (this.lightningFlash < 0) this.lightningFlash = 0;
        }
        if (this.lightningVisualTimer > 0) {
            this.lightningVisualTimer -= delta;
            if (this.lightningVisualTimer <= 0) this._clearLightningBolt();
        }

        // Feuer-Updates (alle 0.5s für Performance)
        this.fireUpdateTimer -= delta;
        if (this.fireUpdateTimer <= 0) {
            this._updateFires(0.5);
            this.fireUpdateTimer = 0.5;
        }
    }

    // --- State-Abfragen ---

    getState() { return this.state; }
    getIntensity() { return this.intensity; }
    isLightningFlash() { return this.lightningFlash > 0; }

    /**
     * Sky-Verdunkelungs-Multiplikator (0..1, 1 = normal, 0 = komplett dunkel)
     */
    getSkyMultiplier() {
        if (this.state === 'thunderstorm') {
            return this.lightningFlash > 0
                ? this.visualProfile.lightningFlash
                : (1.0 - this.intensity * this.visualProfile.stormSkyDarkening);
        }
        return 1.0 - this.intensity * this.visualProfile.rainSkyDarkening;
    }

    /**
     * Zusätzliche Fog-Dichte für Wetter
     */
    getExtraFogDensity() {
        if (this.state === 'thunderstorm') return this.intensity * this.visualProfile.stormFog;
        if (this.state === 'rain') return this.intensity * this.visualProfile.rainFog;
        if (this.state === 'snow') return this.intensity * this.visualProfile.snowFog;
        return 0;
    }

    // --- State-Übergänge ---

    _transitionState(biome) {
        const prev = this.state;

        if (prev === 'clear') {
            // Klares Wetter → Niederschlag
            if (biome === BIOMES.SNOW) {
                this.state = 'snow';
                this.stateTimer = this._randomDuration('snow');
                this.targetIntensity = 0.5 + Math.random() * 0.5;
            } else if (biome === BIOMES.DESERT) {
                // Wüste: kein Regen, bleibt klar
                this.state = 'clear';
                this.stateTimer = this._randomDuration('clear');
                this.targetIntensity = 0;
            } else {
                this.state = 'rain';
                this.stateTimer = this._randomDuration('rain');
                this.targetIntensity = 0.5 + Math.random() * 0.5;
            }
        } else if (prev === 'rain') {
            // Regen → Gewitter oder Klar
            if (Math.random() < this._getStormChance()) {
                this.state = 'thunderstorm';
                this.stateTimer = this._randomDuration('storm');
                this.targetIntensity = 0.8 + Math.random() * 0.2;
                this.lightningTimer = 0.5 + Math.random() * 2.0;
                this.rainCyclesWithoutStorm = 0;
            } else {
                this.state = 'clear';
                this.stateTimer = this._randomDuration('clear');
                this.targetIntensity = 0;
                this.rainCyclesWithoutStorm += 1;
            }
        } else if (prev === 'thunderstorm') {
            // Gewitter → Klar
            this.state = 'clear';
            this.stateTimer = this._randomDuration('clear');
            this.targetIntensity = 0;
            this.lightningActive = false;
        } else if (prev === 'snow') {
            // Schnee → Klar
            this.state = 'clear';
            this.stateTimer = this._randomDuration('clear');
            this.targetIntensity = 0;
        }
    }

    _getStormChance() {
        const increment = W.STORM_CHANCE_INCREMENT ?? 0;
        const maxChance = W.STORM_CHANCE_MAX ?? 1;
        return Math.min(maxChance, W.STORM_CHANCE + this.rainCyclesWithoutStorm * increment);
    }

    _randomDuration(type) {
        switch (type) {
            case 'clear': return W.CLEAR_MIN + Math.random() * (W.CLEAR_MAX - W.CLEAR_MIN);
            case 'rain':  return W.RAIN_MIN + Math.random() * (W.RAIN_MAX - W.RAIN_MIN);
            case 'storm': return W.STORM_MIN + Math.random() * (W.STORM_MAX - W.STORM_MIN);
            case 'snow':  return W.SNOW_MIN + Math.random() * (W.SNOW_MAX - W.SNOW_MIN);
            default: return 120;
        }
    }

    // --- Blitz ---

    _strikeLightning(playerPos) {
        this.lightningFlash = 0.15; // 150ms weißer Flash

        // Donner-Sound (leicht verzögert für Realismus)
        setTimeout(() => {
            SoundManager.playThunder();
        }, 200 + Math.random() * 800);

        // Höchsten Block im Radius finden
        const radius = W.LIGHTNING_RADIUS;
        const cx = Math.floor(playerPos.x) + Math.floor((Math.random() - 0.5) * radius * 2);
        const cz = Math.floor(playerPos.z) + Math.floor((Math.random() - 0.5) * radius * 2);

        // Höchsten Block finden
        let topY = -1;
        for (let y = 63; y >= 0; y--) {
            const block = this.world.getBlock(cx, y, cz);
            if (block !== 0 && block !== 4 && block !== 8) { // Nicht Luft, Wasser, Wolke
                topY = y;
                break;
            }
        }

        if (topY < 0) return;
        this._showLightningBolt(cx, topY + 1, cz);

        // Feuer setzen wenn brennbar
        const hitBlock = this.world.getBlock(cx, topY, cz);
        if (FLAMMABLE_IDS.has(hitBlock) && this.world.fireBlocks.size < W.MAX_FIRES) {
            const fireY = topY + 1;
            const aboveBlock = this.world.getBlock(cx, fireY, cz);
            if (aboveBlock === 0) { // Luft darüber
                const key = `${cx},${fireY},${cz}`;
                this.world.setBlock(cx, fireY, cz, 86); // FIRE
                this.world.fireBlocks.set(key, { remaining: W.FIRE_DURATION, x: cx, y: fireY, z: cz });
            }
        }
    }

    _showLightningBolt(x, y, z) {
        if (!this.scene || typeof this.scene.add !== 'function') return;
        this._clearLightningBolt();

        const topY = Math.max(63, y + 18);
        const points = [];
        const segmentCount = 9;
        for (let i = 0; i <= segmentCount; i++) {
            const t = i / segmentCount;
            const jitter = i === 0 || i === segmentCount ? 0 : 0.7;
            points.push(new THREE.Vector3(
                x + (Math.random() - 0.5) * jitter,
                topY + (y - topY) * t,
                z + (Math.random() - 0.5) * jitter
            ));
        }

        const material = new THREE.LineBasicMaterial({
            color: this.painterly ? 0xfff4d6 : 0xeef6ff,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        });
        let boltPoints = points;
        if (this.painterly) {
            boltPoints = [];
            for (let i = 1; i < points.length; i++) boltPoints.push(points[i - 1], points[i]);
            for (const index of [2, 5, 7]) {
                const start = points[index];
                const direction = index % 2 === 0 ? 1 : -1;
                boltPoints.push(
                    start,
                    new THREE.Vector3(start.x + direction * (0.8 + index * 0.06), start.y - 1.4, start.z + direction * 0.45)
                );
            }
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(boltPoints);
        const bolt = this.painterly ? new THREE.LineSegments(geometry, material) : new THREE.Line(geometry, material);
        bolt.frustumCulled = false;

        this.lightningBolt = bolt;
        this.lightningVisualTimer = 0.22;
        this.scene.add(bolt);
    }

    _clearLightningBolt() {
        if (!this.lightningBolt) return;
        if (this.scene && typeof this.scene.remove === 'function') this.scene.remove(this.lightningBolt);
        this.lightningBolt.geometry.dispose();
        this.lightningBolt.material.dispose();
        this.lightningBolt = null;
        this.lightningVisualTimer = 0;
    }

    // --- Feuer-Mechanik ---

    _updateFires(dt) {
        const toRemove = [];

        for (const [key, fire] of this.world.fireBlocks) {
            fire.remaining -= dt;

            if (fire.remaining <= 0) {
                toRemove.push(key);
                continue;
            }

            // Ausbreitung (selten)
            if (Math.random() < W.FIRE_SPREAD_CHANCE && this.world.fireBlocks.size < W.MAX_FIRES) {
                const dirs = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
                const dir = dirs[Math.floor(Math.random() * dirs.length)];
                const nx = fire.x + dir[0], ny = fire.y + dir[1], nz = fire.z + dir[2];
                const neighborBlock = this.world.getBlock(nx, ny, nz);

                if (FLAMMABLE_IDS.has(neighborBlock)) {
                    // Nachbar-Block anzünden: Block wird zu Luft, Feuer darüber
                    const fireAboveY = ny + 1;
                    const aboveNeighbor = this.world.getBlock(nx, fireAboveY, nz);
                    if (aboveNeighbor === 0) {
                        const nKey = `${nx},${fireAboveY},${nz}`;
                        if (!this.world.fireBlocks.has(nKey)) {
                            this.world.setBlock(nx, fireAboveY, nz, 86);
                            this.world.fireBlocks.set(nKey, { remaining: W.FIRE_DURATION * 0.7, x: nx, y: fireAboveY, z: nz });
                        }
                    }
                }
            }

            // Block unter dem Feuer verbrennen (zu Luft)
            const underBlock = this.world.getBlock(fire.x, fire.y - 1, fire.z);
            if (FLAMMABLE_IDS.has(underBlock) && Math.random() < 0.02) {
                this.world.setBlock(fire.x, fire.y - 1, fire.z, 0);
            }
        }

        // Abgelaufene Feuer löschen
        for (const key of toRemove) {
            const fire = this.world.fireBlocks.get(key);
            if (fire) {
                this.world.setBlock(fire.x, fire.y, fire.z, 0); // Feuer → Luft
                this.world.fireBlocks.delete(key);
            }
        }
    }

    // --- Serialisierung ---

    serialize() {
        return {
            state: this.state,
            stateTimer: this.stateTimer,
            intensity: this.intensity,
            targetIntensity: this.targetIntensity,
            lightningTimer: this.lightningTimer,
            rainCyclesWithoutStorm: this.rainCyclesWithoutStorm
        };
    }

    deserialize(data) {
        if (!data) return;
        this.state = data.state || 'clear';
        this.stateTimer = data.stateTimer ?? this._randomDuration('clear');
        this.intensity = data.intensity ?? 0;
        this.targetIntensity = data.targetIntensity ?? 0;
        this.lightningTimer = data.lightningTimer ?? 10;
        this.rainCyclesWithoutStorm = data.rainCyclesWithoutStorm ?? 0;
    }

    /**
     * Lädt Feuer-Blöcke aus Save-Daten
     */
    loadFireBlocks(fireData) {
        if (!fireData || typeof fireData !== 'object') return;
        for (const [key, val] of Object.entries(fireData)) {
            const parts = key.split(',').map(Number);
            if (parts.length === 3) {
                this.world.fireBlocks.set(key, {
                    remaining: val.remaining || W.FIRE_DURATION,
                    x: parts[0], y: parts[1], z: parts[2]
                });
            }
        }
    }

    /**
     * Serialisiert Feuer-Blöcke für Save
     */
    saveFireBlocks() {
        const obj = {};
        for (const [key, val] of this.world.fireBlocks) {
            obj[key] = { remaining: val.remaining };
        }
        return obj;
    }

    dispose() {
        this._clearLightningBolt();
        if (this.rainParticles) { this.rainParticles.dispose(); this.rainParticles = null; }
        if (this.snowParticles) { this.snowParticles.dispose(); this.snowParticles = null; }
        if (this.rainSoundPlaying) { SoundManager.playRainLoop(false); this.rainSoundPlaying = false; }
    }
}
