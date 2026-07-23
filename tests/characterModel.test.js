import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createCharacterModel, updateCharacterEquipment } from '../js/characterModel.js';
import { createCharacterProfile } from '../js/characterProfile.js';

beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
        fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
        fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() {},
        createLinearGradient() { return { addColorStop() {} }; }
    }));
});

describe('character rig', () => {
    it('exposes stable named joints and keeps outlines attached to meshes', () => {
        const model = createCharacterModel(createCharacterProfile({ hairStyle: 'ponytail', accessory: 'cape' }));

        expect(model.name).toBe('characterRoot');
        expect(model.rig.bodyRoot.name).toBe('bodyRoot');
        expect(model.rig.headPivot.name).toBe('headPivot');
        expect(model.rig.leftArmPivot.name).toBe('leftArmPivot');
        expect(model.rig.rightLegPivot.name).toBe('rightLegPivot');
        expect(model.rig.ponytailPivot.name).toBe('ponytailPivot');
        expect(model.rig.capePivot.name).toBe('capePivot');

        let detachedOutline = false;
        model.traverse((child) => {
            if (child.type === 'LineSegments' && child.parent?.type !== 'Mesh') detachedOutline = true;
        });
        expect(detachedOutline).toBe(false);
    });

    it('can omit per-part outlines for the runtime player model', () => {
        const model = createCharacterModel(createCharacterProfile(), { outlines: false });
        let outlineCount = 0;
        model.traverse((child) => {
            if (child.type === 'LineSegments') outlineCount++;
        });
        expect(outlineCount).toBe(0);
    });

    it.each(['classic', 'slim', 'sturdy'])('creates a neutral %s body', (bodyType) => {
        const model = createCharacterModel(createCharacterProfile({ bodyType }));
        expect(model.rig.leftArmPivot.rotation.x).toBe(0);
        expect(model.rig.rightLegPivot.rotation.x).toBe(0);
    });

    it('uses the painterly character silhouette and separates clothes from skin', () => {
        const model = createCharacterModel(createCharacterProfile());
        const names = [];
        model.traverse(child => names.push(child.name));

        expect(model.getObjectByName('head')?.geometry.constructor.name).toBe('RoundedBoxGeometry');
        expect(names).toContain('sleeve');
        expect(names).toContain('hand');
        expect(names).toContain('eyeWhite');
        expect(names).toContain('iris');
    });

    it('renders all five equipped armor regions including both arms', () => {
        const model = createCharacterModel(createCharacterProfile(), { outlines: false });
        const inventory = Array.from({ length: 64 }, () => ({ type: 0, count: 0 }));
        [121, 122, 123, 124, 125].forEach((type, index) => {
            inventory[8 + index] = { type, count: 1 };
        });

        updateCharacterEquipment(model, inventory);

        expect(model.getObjectByName('equippedHelmet')).toBeTruthy();
        expect(model.getObjectByName('equippedBodyArmor')).toBeTruthy();
        expect(model.rig.armorLayers.filter(layer => layer.name === 'equippedArmArmor')).toHaveLength(2);
        expect(model.rig.armorLayers.filter(layer => layer.name === 'equippedLegArmor')).toHaveLength(2);
        expect(model.rig.armorLayers.filter(layer => layer.name === 'equippedBootArmor')).toHaveLength(2);
    });
});
