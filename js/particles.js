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
import { isTouchDevice } from './touch.js';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class ParticleSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {'rain'|'snow'} type
     * @param {number} maxCount — Desktop-Partikelzahl (Mobile = ×0.5)
     */
    constructor(scene, type, maxCount) {
        this.scene = scene;
        this.type = type;
        const mobile = isTouchDevice();
        this.count = mobile ? Math.floor(maxCount * 0.5) : maxCount;
        this.spawnRadius = 20;  // Partikel-Radius um Spieler

        // Geometrie je nach Typ
        let geo;
        if (type === 'rain') {
            geo = new THREE.PlaneGeometry(0.05, 0.3);
        } else {
            geo = new THREE.PlaneGeometry(0.08, 0.08);
        }

        // Material
        const mat = new THREE.MeshBasicMaterial({
            color: type === 'rain' ? 0x8899CC : 0xFFFFFF,
            transparent: true,
            opacity: type === 'rain' ? 0.5 : 0.75,
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
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        scene.add(this.mesh);

        // Partikel-State
        this.particles = new Array(this.count);
        for (let i = 0; i < this.count; i++) {
            this.particles[i] = {
                x: 0, y: -1000, z: 0,
                vx: 0, vy: 0, vz: 0,
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
        const activeCount = Math.floor(this.count * intensity);
        const r = this.spawnRadius;

        for (let i = 0; i < this.count; i++) {
            const p = this.particles[i];

            if (i >= activeCount) {
                // Überschüssige Partikel deaktivieren
                if (p.alive) {
                    p.alive = false;
                    _dummy.position.set(0, -1000, 0);
                    _dummy.scale.set(0, 0, 0);
                    _dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, _dummy.matrix);
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
                    p.vx = (Math.random() - 0.5) * 2;
                    p.vz = (Math.random() - 0.5) * 2;
                }
            }

            // Bewegen
            p.x += p.vx * delta;
            p.y += p.vy * delta;
            p.z += p.vz * delta;

            // Schneeflocken: leichtes Driften
            if (this.type === 'snow') {
                p.vx += (Math.random() - 0.5) * 3 * delta;
                p.vz += (Math.random() - 0.5) * 3 * delta;
                p.vx = Math.max(-2, Math.min(2, p.vx));
                p.vz = Math.max(-2, Math.min(2, p.vz));
            }

            // Recycling: unter Spieler oder zu weit weg
            const dy = p.y - playerPos.y;
            const dx = p.x - playerPos.x;
            const dz = p.z - playerPos.z;
            if (dy < -20 || Math.abs(dx) > r + 5 || Math.abs(dz) > r + 5) {
                p.alive = false;
                _dummy.position.set(0, -1000, 0);
                _dummy.scale.set(0, 0, 0);
                _dummy.updateMatrix();
                this.mesh.setMatrixAt(i, _dummy.matrix);
                continue;
            }

            // Matrix aktualisieren
            _dummy.position.set(p.x, p.y, p.z);
            _dummy.scale.set(1, 1, 1);
            if (this.type === 'rain') {
                _dummy.rotation.set(0, 0, 0);
            } else {
                // Schneeflocken drehen sich leicht
                _dummy.rotation.z = performance.now() * 0.001 + i;
            }
            _dummy.updateMatrix();
            this.mesh.setMatrixAt(i, _dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
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
