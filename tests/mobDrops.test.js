import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Game } from '../js/Game.js';

beforeAll(() => {
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property === 'createLinearGradient' || property === 'createRadialGradient') {
                return () => gradient;
            }
            if (!(property in target)) target[property] = () => {};
            return target[property];
        }
    });
    HTMLCanvasElement.prototype.getContext = () => context;
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
});

describe('Mob drops through the Game seam', () => {
    afterEach(() => Game.reset());

    it('adds defeated mob loot to the central dropped-item collection', async () => {
        const { Mob } = await import('../js/mobs.js');
        const scene = new THREE.Scene();
        Game.droppedItems = [];
        const pig = new Mob(scene, 'pig', 2, 4, 6);

        pig.takeDamage(100);

        expect(Game.droppedItems).toHaveLength(1);
        expect(Game.droppedItems[0]).toMatchObject({ blockType: 22, velocityY: 2 });
        expect(scene.children).toContain(Game.droppedItems[0].mesh);
    }, 15000);

    it('recreates a missing dropped-item collection before adding loot', async () => {
        const { Mob } = await import('../js/mobs.js');
        Game.droppedItems = undefined;
        const cow = new Mob(new THREE.Scene(), 'cow', 0, 0, 0);

        cow.takeDamage(100);

        expect(Game.droppedItems).toHaveLength(1);
        expect(Game.droppedItems[0].blockType).toBe(22);
    }, 15000);

    it('drops string when a spider is defeated', async () => {
        const { Mob } = await import('../js/mobs.js');
        Game.droppedItems = [];
        const spider = new Mob(new THREE.Scene(), 'spider', 0, 0, 0);

        spider.takeDamage(100);

        expect(Game.droppedItems).toHaveLength(1);
        expect(Game.droppedItems[0].blockType).toBe(93);
    }, 15000);

    it('rewards defeating a polar bear with plenty of meat and fur', async () => {
        const { Mob } = await import('../js/mobs.js');
        const { BLOCK_TYPES } = await import('../js/blocks.js');
        Game.droppedItems = [];
        const polarBear = new Mob(new THREE.Scene(), 'polarBear', 0, 0, 0);

        expect(polarBear.health).toBeGreaterThan(20);
        polarBear.takeDamage(100);

        expect(Game.droppedItems.map(item => item.blockType)).toEqual([
            BLOCK_TYPES.RAW_MEAT,
            BLOCK_TYPES.RAW_MEAT,
            BLOCK_TYPES.RAW_MEAT,
            BLOCK_TYPES.POLAR_BEAR_FUR
        ]);
    }, 15000);

    it('drops an arrow tip when a scorpion is defeated', async () => {
        const { Mob } = await import('../js/mobs.js');
        const { BLOCK_TYPES } = await import('../js/blocks.js');
        Game.droppedItems = [];
        const scorpion = new Mob(new THREE.Scene(), 'scorpion', 0, 0, 0);

        scorpion.takeDamage(100);

        expect(Game.droppedItems).toHaveLength(1);
        expect(Game.droppedItems[0].blockType).toBe(BLOCK_TYPES.ARROW);
    }, 15000);
});

describe('biome mob behavior', () => {
    afterEach(() => vi.restoreAllMocks());

    it.each(['penguin', 'seal'])('%s survives and moves on land and in water', async type => {
        const { Mob } = await import('../js/mobs.js');
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const mob = new Mob(new THREE.Scene(), type, 0, 1, 0);
        const initialHealth = mob.health;
        const playerPos = new THREE.Vector3(2, 1, 2);
        const landWorld = { getBlock: (_x, y) => y <= 0 ? 1 : 0 };

        mob.velocity.set(1, 0, 0);
        for (let i = 0; i < 10; i++) mob.update(0.1, playerPos, landWorld, () => {});

        expect(mob.health).toBe(initialHealth);
        expect(mob.isDead).toBe(false);

        const waterWorld = { getBlock: (_x, y) => y >= 0 && y <= 3 ? 4 : 0 };
        mob.group.position.set(0, 2, 0);
        mob.velocity.set(1, 0, 0);
        mob.update(0.25, playerPos, waterWorld, () => {});

        expect(mob.group.position.x).toBeGreaterThan(0);
        expect(mob.isDead).toBe(false);
    }, 15000);

    it('makes the polar bear pursue and hurt nearby players', async () => {
        const { Mob } = await import('../js/mobs.js');
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const polarBear = new Mob(new THREE.Scene(), 'polarBear', 0, 1, 0);
        const world = { getBlock: (_x, y) => y <= 0 ? 1 : 0 };
        let receivedDamage = 0;

        polarBear.update(0.5, new THREE.Vector3(1, 1, 0), world, amount => {
            receivedDamage += amount;
        });

        expect(Math.hypot(polarBear.velocity.x, polarBear.velocity.z)).toBeGreaterThan(0);
        expect(receivedDamage).toBeGreaterThan(0);
    }, 15000);

    it.each([
        ['camel', 30],
        ['fennec', 6]
    ])('builds a passive %s with fitting toughness', async (type, expectedHealth) => {
        const { Mob } = await import('../js/mobs.js');
        const mob = new Mob(new THREE.Scene(), type, 0, 1, 0);

        expect(mob.health).toBe(expectedHealth);
        expect(mob.group.children.length).toBeGreaterThan(2);
    }, 15000);

    it('makes scorpions pursue and sting nearby players', async () => {
        const { Mob } = await import('../js/mobs.js');
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const scorpion = new Mob(new THREE.Scene(), 'scorpion', 0, 1, 0);
        const world = { getBlock: (_x, y) => y <= 0 ? 1 : 0 };
        let receivedDamage = 0;

        scorpion.update(0.1, new THREE.Vector3(0.2, 1, 0), world, amount => {
            receivedDamage += amount;
        });

        expect(Math.hypot(scorpion.velocity.x, scorpion.velocity.z)).toBeGreaterThan(0);
        expect(receivedDamage).toBeGreaterThan(0);
    }, 15000);
});
