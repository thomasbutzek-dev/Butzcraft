import * as THREE from 'three';

const RAIL_BLOCK = 80;
const MAX_SPEED = 4.5;
const ACCELERATION = 4.0;
const BRAKE = 7.0;
const FRICTION = 1.4;
const DIRECTIONS = [
    { x: 0, z: -1 },
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 }
];

export function getRailNeighbors(getBlock, cell) {
    const neighbors = [];
    for (const direction of DIRECTIONS) {
        for (const dy of [0, 1, -1]) {
            const candidate = {
                x: cell.x + direction.x,
                y: cell.y + dy,
                z: cell.z + direction.z
            };
            if (getBlock(candidate.x, candidate.y, candidate.z) === RAIL_BLOCK) {
                neighbors.push(candidate);
                break;
            }
        }
    }
    return neighbors;
}

function matchesDirection(cell, neighbor, direction) {
    return neighbor.x - cell.x === direction.x && neighbor.z - cell.z === direction.z;
}

export function chooseRailNeighbor(cell, neighbors, direction, branchInput = 0) {
    if (neighbors.length === 0) return null;
    const reverse = { x: -direction.x, z: -direction.z };
    const forwardChoices = neighbors.filter(neighbor => !matchesDirection(cell, neighbor, reverse));
    const choices = forwardChoices.length > 0 ? forwardChoices : neighbors;
    const left = { x: direction.z, z: -direction.x };
    const right = { x: -direction.z, z: direction.x };
    const preferred = branchInput < 0 ? left : (branchInput > 0 ? right : direction);

    return choices.find(neighbor => matchesDirection(cell, neighbor, preferred))
        || choices.find(neighbor => matchesDirection(cell, neighbor, direction))
        || choices[0];
}

function selectNextCell(state, getBlock, branchInput) {
    const neighbors = getRailNeighbors(getBlock, state.cell);
    state.nextCell = chooseRailNeighbor(state.cell, neighbors, state.direction, branchInput);
    return state.nextCell;
}

export function advanceMinecartState(state, distance, getBlock, branchInput = 0) {
    let remaining = Math.max(0, distance);
    let moved = false;
    while (remaining > 0) {
        if (!state.nextCell && !selectNextCell(state, getBlock, branchInput)) break;
        const edgeRemaining = 1 - state.progress;
        if (remaining < edgeRemaining) {
            state.progress += remaining;
            moved = true;
            remaining = 0;
            break;
        }

        remaining -= edgeRemaining;
        const previous = state.cell;
        state.cell = state.nextCell;
        state.direction = {
            x: state.cell.x - previous.x,
            z: state.cell.z - previous.z
        };
        state.nextCell = null;
        state.progress = 0;
        moved = true;
    }
    return moved;
}

function createCartMesh() {
    const group = new THREE.Group();
    const metal = new THREE.MeshPhongMaterial({ color: 0x5a5d60, shininess: 28 });
    const darkMetal = new THREE.MeshPhongMaterial({ color: 0x25282b, shininess: 18 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 0.72), darkMetal);
    base.position.y = 0.2;
    group.add(base);

    const walls = [
        [1.05, 0.42, 0.12, 0, 0.48, -0.3],
        [1.05, 0.42, 0.12, 0, 0.48, 0.3],
        [0.12, 0.42, 0.5, -0.47, 0.48, 0],
        [0.12, 0.42, 0.5, 0.47, 0.48, 0]
    ];
    for (const [width, height, depth, x, y, z] of walls) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), metal);
        wall.position.set(x, y, z);
        group.add(wall);
    }

    for (const x of [-0.34, 0.34]) {
        for (const z of [-0.39, 0.39]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 10), darkMetal);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, 0.12, z);
            group.add(wheel);
        }
    }
    return group;
}

export class Minecart {
    constructor(scene, data) {
        this.id = data.id;
        this.cell = { x: data.x, y: data.y, z: data.z };
        this.nextCell = data.nextCell ? { ...data.nextCell } : null;
        this.direction = data.direction ? { ...data.direction } : { x: 0, z: 1 };
        this.progress = Number.isFinite(data.progress) ? Math.max(0, Math.min(0.999, data.progress)) : 0;
        this.speed = Number.isFinite(data.speed) ? Math.max(0, Math.min(MAX_SPEED, data.speed)) : 0;
        this.hasRider = false;
        this.group = createCartMesh();
        this._applyVisualPosition();
        scene.add(this.group);
    }

    update(delta, input, world) {
        const dt = Math.min(0.1, Math.max(0, delta));
        if (this.hasRider && input.moveF) {
            this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * dt);
        } else {
            const slowdown = this.hasRider && input.moveB ? BRAKE : FRICTION;
            this.speed = Math.max(0, this.speed - slowdown * dt);
        }

        const branchInput = this.hasRider ? (input.moveL ? -1 : (input.moveR ? 1 : 0)) : 0;
        if (this.speed > 0) {
            const moved = advanceMinecartState(
                this,
                this.speed * dt,
                (x, y, z) => world.getBlock(x, y, z),
                branchInput
            );
            if (!moved) this.speed = 0;
        }
        this._applyVisualPosition();
    }

    _applyVisualPosition() {
        const target = this.nextCell || this.cell;
        const t = this.nextCell ? this.progress : 0;
        this.group.position.set(
            this.cell.x + (target.x - this.cell.x) * t + 0.5,
            this.cell.y + (target.y - this.cell.y) * t + 0.18,
            this.cell.z + (target.z - this.cell.z) * t + 0.5
        );
        this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    }

    syncRider(playerPosition) {
        playerPosition.set(this.group.position.x, this.group.position.y + 1.58, this.group.position.z);
    }

    serialize() {
        return {
            id: this.id,
            x: this.cell.x,
            y: this.cell.y,
            z: this.cell.z,
            nextCell: this.nextCell ? { ...this.nextCell } : null,
            direction: { ...this.direction },
            progress: this.progress,
            speed: this.speed
        };
    }

    dispose(scene) {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
