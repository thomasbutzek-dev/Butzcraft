/* js/particles.js — Butzcraft Partikel-System (Tier 3: Wetter)
 *
 * Leichtgewichtiges InstancedMesh-basiertes Partikel-System für Regen und Schnee.
 * Nutzt THREE.InstancedMesh für minimalen Draw-Call-Overhead.
 *
 * Einsatz:
 *   const rain = new ParticleSystem(scene, 'rain', 1500);
 *   rain.update(delta, playerPos, intensity);  // intensity 0..1
 *   rain.dispose();
 */

import * as THREE from 'three';
import { isTouchDevice } from './touch.js?v=20260717b';
import { graphicsPrototype } from './graphicsPrototype.js?v=20260718c';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const PRECIPITATION_PASSTHROUGH_IDS = new Set([0, 4, 8]);

export function getPrecipitationVisualProfile(type, painterly = graphicsPrototype.usesPainterlyTextures) {
    if (type === 'rain') {
        return painterly
            ? { width: 0.035, height: 0.42, opacity: 0.42, colors: [0x9aadb5, 0xb7c7c7, 0x8198a4], scaleMin: 0.72, scaleRange: 0.58 }
            : { width: 0.05, height: 0.3, opacity: 0.5, colors: [0x8899cc], scaleMin: 1, scaleRange: 0 };
    }
    return painterly
        ? { width: 0.1, height: 0.1, opacity: 0.82, colors: [0xfff4dc, 0xe9f1e8, 0xdde9ec], scaleMin: 0.68, scaleRange: 0.72 }
        : { width: 0.08, height: 0.08, opacity: 0.75, colors: [0xffffff], scaleMin: 1, scaleRange: 0 };
}

function stableVariation(index, salt) {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
}

export function blocksPrecipitation(blockType) {
    return blockType > 0 && !PRECIPITATION_PASSTHROUGH_IDS.has(blockType);
}

export function findPrecipitationImpactY(world, x, fromY, toY, z) {
    if (!world || typeof world.getBlock !== 'function') return null;
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const startY = Math.floor(Math.max(fromY, toY));
    const endY = Math.floor(Math.min(fromY, toY));
    for (let y = startY; y >= endY; y--) {
        if (blocksPrecipitation(world.getBlock(bx, y, bz))) return y;
    }
    return null;
}

export class ParticleSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {'rain'|'snow'} type
     * @param {number} maxCount — Desktop-Partikelzahl (Mobile = ×0.5)
     */
    constructor(scene, type, maxCount, world = null) {
        this.scene = scene;
        this.type = type;
        this.world = world;
        this.painterly = graphicsPrototype.usesPainterlyTextures;
        this.visualProfile = getPrecipitationVisualProfile(type, this.painterly);
        this.elapsed = 0;
        const mobile = isTouchDevice();
        this.count = mobile ? Math.floor(maxCount * 0.5) : maxCount;
        this.spawnRadius = 20;  // Partikel-Radius um Spieler

        // Geometrie je nach Typ
        let geo;
        if (type === 'rain') {
            geo = new THREE.PlaneGeometry(this.visualProfile.width, this.visualProfile.height);
        } else {
            geo = new THREE.PlaneGeometry(this.visualProfile.width, this.visualProfile.height);
        }

        // Material
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: this.visualProfile.opacity,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        // Start: alle Instanzen unsichtbar (Scale 0)
        for (let i = 0; i < this.count; i++) {
            _dummy.position.set(0, -1000, 0);
            _dummy.scale.set(0, 0, 0);
            _dummy.updateMatrix();
            this.mesh.setMatrixAt(i, _dummy.matrix);
            this.mesh.setColorAt(i, _color.set(this.visualProfile.colors[i % this.visualProfile.colors.length]));
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        scene.add(this.mesh);

        // Partikel-State
        this.particles = new Array(this.count);
        for (let i = 0; i < this.count; i++) {
            this.particles[i] = {
                x: 0, y: -1000, z: 0,
                vx: 0, vy: 0, vz: 0,
                scale: this.visualProfile.scaleMin + stableVariation(i, 1) * this.visualProfile.scaleRange,
                phase: stableVariation(i, 2) * Math.PI * 2,
                driftRate: 0.55 + stableVariation(i, 3) * 0.65,
                alive: false
            };
        }

        this.intensity = 0;
    }

    /**
     * Aktualisiert alle Partikel.
     * @param {number} delta — Sekunden seit letztem Frame
     * @param {THREE.Vector3} playerPos — aktuelle Spieler-Position
     * @param {number} intensity — 0..1, steuert wie viele Partikel aktiv sind
     */
    update(delta, playerPos, intensity) {
        this.intensity = intensity;
        this.elapsed += delta;
        const activeCount = Math.floor(this.count * intensity);
        const r = this.spawnRadius;

        for (let i = 0; i < this.count; i++) {
            const p = this.particles[i];

            if (i >= activeCount) {
                // Überschüssige Partikel deaktivieren
                if (p.alive) {
                    p.alive = false;
                    this._hideParticle(i, p);
                }
                continue;
            }

            if (!p.alive) {
                // Partikel neu spawnen
                p.x = playerPos.x + (Math.random() - 0.5) * r * 2;
                p.y = playerPos.y + 10 + Math.random() * 15;
                p.z = playerPos.z + (Math.random() - 0.5) * r * 2;
                p.alive = true;

                if (this.type === 'rain') {
                    p.vy = -(8 + Math.random() * 4);
                    p.vx = (Math.random() - 0.5) * 1.5;
                    p.vz = (Math.random() - 0.5) * 1.5;
                } else {
                    p.vy = -(1 + Math.random() * 1);
                    p.vx = this.painterly ? 0 : (Math.random() - 0.5) * 2;
                    p.vz = this.painterly ? 0 : (Math.random() - 0.5) * 2;
                }
            }

            // Bewegen
            const prevY = p.y;
            p.x += p.vx * delta;
            p.y += p.vy * delta;
            p.z += p.vz * delta;

            if (findPrecipitationImpactY(this.world, p.x, prevY, p.y, p.z) !== null) {
                this._hideParticle(i, p);
                continue;
            }

            // Schneeflocken: leichtes Driften
            if (this.type === 'snow') {
                if (this.painterly) {
                    p.vx = Math.sin(this.elapsed * p.driftRate + p.phase) * (0.35 + p.scale * 0.28);
                    p.vz = Math.cos(this.elapsed * p.driftRate * 0.83 + p.phase) * (0.3 + p.scale * 0.24);
                } else {
                    p.vx += (Math.random() - 0.5) * 3 * delta;
                    p.vz += (Math.random() - 0.5) * 3 * delta;
                    p.vx = Math.max(-2, Math.min(2, p.vx));
                    p.vz = Math.max(-2, Math.min(2, p.vz));
                }
            }

            // Recycling: unter Spieler oder zu weit weg
            const dy = p.y - playerPos.y;
            const dx = p.x - playerPos.x;
            const dz = p.z - playerPos.z;
            if (dy < -20 || Math.abs(dx) > r + 5 || Math.abs(dz) > r + 5) {
                p.alive = false;
                this._hideParticle(i, p);
                continue;
            }

            // Matrix aktualisieren
            _dummy.position.set(p.x, p.y, p.z);
            if (this.type === 'rain') {
                _dummy.scale.set(this.painterly ? 0.82 + p.scale * 0.18 : 1, p.scale, 1);
                _dummy.rotation.set(0, this.painterly ? p.phase * 0.08 : 0, this.painterly ? p.vx * -0.035 : 0);
            } else {
                _dummy.scale.setScalar(p.scale);
                _dummy.rotation.set(0, this.painterly ? p.phase : 0, (this.painterly ? this.elapsed * 0.55 : performance.now() * 0.001) + p.phase);
            }
            _dummy.updateMatrix();
            this.mesh.setMatrixAt(i, _dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    _hideParticle(index, particle) {
        particle.alive = false;
        _dummy.position.set(0, -1000, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(index, _dummy.matrix);
    }

    /**
     * Aufräumen (z.B. bei State-Wechsel)
     */
    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh.dispose();
        this.particles = [];
    }
}
