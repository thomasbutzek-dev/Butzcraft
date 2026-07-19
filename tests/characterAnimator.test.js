import { describe, expect, it } from 'vitest';
import { CharacterAnimator, interpolateAngle, selectCharacterAnimationState } from '../js/characterAnimator.js';

describe('character animation state selection', () => {
    it.each([
        [{}, 'idle'],
        [{ speed: 2 }, 'walk'],
        [{ speed: 5, sprinting: true }, 'sprint'],
        [{ grounded: false, verticalSpeed: 2 }, 'jump'],
        [{ grounded: false, verticalSpeed: -2 }, 'fall'],
        [{ crouching: true, speed: 1 }, 'crouch'],
        [{ inWater: true, grounded: false }, 'swim']
    ])('selects %s as %s', (input, expected) => {
        expect(selectCharacterAnimationState(input)).toBe(expected);
    });

    it('interpolates across the shortest angle without a rotation jump', () => {
        const result = interpolateAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
        expect(Math.abs(result - Math.PI)).toBeLessThan(0.01);
    });
});

describe('CharacterAnimator', () => {
    it('returns from an attack overlay to locomotion', () => {
        const part = () => ({ rotation: { x: 0, y: 0, z: 0 } });
        const rig = {
            bodyRoot: { position: { y: 0 } },
            torso: part(), headPivot: part(), leftArmPivot: part(), rightArmPivot: part(),
            leftLegPivot: part(), rightLegPivot: part(), capePivot: part()
        };
        const animator = new CharacterAnimator(rig);

        animator.triggerAction('melee', 0.2);
        expect(animator.update(0.05, { speed: 2 })).toBe('melee');
        animator.update(0.1, { speed: 2 });
        expect(animator.update(0.1, { speed: 2 })).toBe('walk');
    });
});
