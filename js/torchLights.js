import * as THREE from 'three';

export const TORCH_TYPE = 101;
export const TORCH_LIGHT_COLOR = 0xffa34d;

export function getTorchMount(normal) {
    if (!normal) return null;
    if (normal.y > 0.5) return 0;
    if (normal.y < -0.5) return null;
    if (normal.x > 0.5) return 1;
    if (normal.x < -0.5) return 2;
    if (normal.z > 0.5) return 3;
    if (normal.z < -0.5) return 4;
    return null;
}

export function selectNearestTorchPositions(modifiedBlocks, origin, limit = 8, maxDistance = 32) {
    return selectNearestLightPositions(modifiedBlocks, [], origin, limit, maxDistance);
}

export function selectNearestLightPositions(modifiedBlocks, fireLightKeys, origin, limit = 8, maxDistance = 32) {
    const maxDistanceSq = maxDistance * maxDistance;
    const matches = [];
    const torchKeys = modifiedBlocks instanceof Set
        ? modifiedBlocks
        : Object.keys(modifiedBlocks).filter(key => modifiedBlocks[key] === TORCH_TYPE);
    for (const key of torchKeys) {
        const [x, y, z] = key.split(',').map(Number);
        const dx = x + 0.5 - origin.x;
        const dy = y + 0.72 - origin.y;
        const dz = z + 0.5 - origin.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq > maxDistanceSq) continue;
        matches.push({ x: x + 0.5, y: y + 0.72, z: z + 0.5, distanceSq });
    }
    for (const key of fireLightKeys || []) {
        const [x, y, z] = key.split(',').map(Number);
        const dx = x + 0.5 - origin.x;
        const dy = y + 0.55 - origin.y;
        const dz = z + 0.5 - origin.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq > maxDistanceSq) continue;
        matches.push({ x: x + 0.5, y: y + 0.55, z: z + 0.5, distanceSq });
    }
    matches.sort((a, b) => a.distanceSq - b.distanceSq);
    return matches.slice(0, limit).map(({ x, y, z }) => ({ x, y, z }));
}

export function createTorchModel() {
    const group = new THREE.Group();
    const stick = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.62, 0.12),
        new THREE.MeshPhongMaterial({ color: 0x7a4826, shininess: 2 })
    );
    stick.position.y = 0.31;
    const ember = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.14, 0.18),
        new THREE.MeshBasicMaterial({ color: 0xffb02e })
    );
    ember.position.y = 0.68;
    const flame = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.16, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffe066 })
    );
    flame.position.y = 0.82;
    flame.rotation.y = Math.PI / 4;
    group.add(stick, ember, flame);
    return group;
}

export class TorchLightSystem {
    constructor(scene, { poolSize = 4, maxDistance = 24 } = {}) {
        this.scene = scene;
        this.maxDistance = maxDistance;
        this.lights = Array.from({ length: poolSize }, () => {
            const light = new THREE.PointLight(TORCH_LIGHT_COLOR, 3.2, 12, 2);
            light.visible = false;
            light.castShadow = false;
            scene.add(light);
            return light;
        });
        this.updateTimer = 0;
    }

    update(delta, modifiedBlocks, fireLightKeys, playerPosition) {
        this.updateTimer -= delta;
        if (this.updateTimer > 0) return;
        this.updateTimer = 0.2;
        const positions = selectNearestLightPositions(
            modifiedBlocks,
            fireLightKeys,
            playerPosition,
            this.lights.length,
            this.maxDistance
        );
        this.lights.forEach((light, index) => {
            const position = positions[index];
            light.visible = Boolean(position);
            if (position) light.position.set(position.x, position.y, position.z);
        });
    }

    dispose() {
        for (const light of this.lights) this.scene.remove(light);
        this.lights.length = 0;
    }
}
