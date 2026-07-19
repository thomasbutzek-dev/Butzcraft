const LOCOMOTION_STATES = new Set(['idle', 'walk', 'sprint', 'jump', 'fall', 'crouch', 'swim']);

export function selectCharacterAnimationState({ speed = 0, verticalSpeed = 0, grounded = true, inWater = false, crouching = false, sprinting = false } = {}) {
    if (inWater) return 'swim';
    if (!grounded) return verticalSpeed > 0.15 ? 'jump' : 'fall';
    if (crouching) return 'crouch';
    if (speed > 0.12) return sprinting ? 'sprint' : 'walk';
    return 'idle';
}

export function interpolateAngle(current, target, amount) {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + delta * Math.max(0, Math.min(1, amount));
}

export class CharacterAnimator {
    constructor(rig) {
        this.rig = rig;
        this.state = 'idle';
        this.elapsed = 0;
        this.action = null;
        this.actionElapsed = 0;
        this.actionDuration = 0;
        this.reset();
    }

    reset() {
        this.state = 'idle';
        this.elapsed = 0;
        this.action = null;
        this.actionElapsed = 0;
        this.actionDuration = 0;
        this._applyPose(neutralPose(), 1);
    }

    triggerAction(type, duration = 0.45) {
        if (type !== 'melee' && type !== 'bow') return;
        this.action = type;
        this.actionElapsed = 0;
        this.actionDuration = Math.max(0.1, duration);
    }

    update(delta, input = {}) {
        const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
        const nextState = selectCharacterAnimationState(input);
        this.state = LOCOMOTION_STATES.has(nextState) ? nextState : 'idle';
        this.elapsed += dt * Math.max(0.5, Math.min(8, input.speed || 0) + 1.5);

        const pose = locomotionPose(this.state, this.elapsed, input.speed || 0);
        if (this.action) {
            this.actionElapsed += dt;
            const progress = Math.min(1, this.actionElapsed / this.actionDuration);
            applyActionPose(pose, this.action, progress);
            if (progress >= 1) this.action = null;
        }

        const blend = 1 - Math.exp(-dt * 12);
        this._applyPose(pose, blend);
        this._updateSecondaryMotion(input, dt);
        return this.action || this.state;
    }

    _applyPose(pose, amount) {
        const { rig } = this;
        setRotation(rig.torso, pose.torso, amount);
        setRotation(rig.headPivot, pose.head, amount);
        setRotation(rig.leftArmPivot, pose.leftArm, amount);
        setRotation(rig.rightArmPivot, pose.rightArm, amount);
        setRotation(rig.leftLegPivot, pose.leftLeg, amount);
        setRotation(rig.rightLegPivot, pose.rightLeg, amount);
        if (rig.bodyRoot?.position) {
            rig.bodyRoot.position.y += (pose.bodyY - rig.bodyRoot.position.y) * amount;
        }
    }

    _updateSecondaryMotion(input, delta) {
        const lag = 1 - Math.exp(-delta * 7);
        const speed = Math.min(1, (input.speed || 0) / 6);
        const vertical = Math.max(-1, Math.min(1, (input.verticalSpeed || 0) / 7));
        const turn = Math.max(-1, Math.min(1, input.turnSpeed || 0));
        rotateSecondary(this.rig.capePivot, -0.08 - speed * 0.35 + vertical * 0.12, turn * 0.12, lag);
        rotateSecondary(this.rig.scarfPivot, -0.04 - speed * 0.22 + vertical * 0.08, turn * 0.16, lag);
        rotateSecondary(this.rig.ponytailPivot, -0.06 - speed * 0.28 + vertical * 0.1, turn * 0.18, lag);
    }
}

function neutralPose() {
    return {
        bodyY: 0,
        torso: [0, 0, 0],
        head: [0, 0, 0],
        leftArm: [0, 0, 0.04],
        rightArm: [0, 0, -0.04],
        leftLeg: [0, 0, 0],
        rightLeg: [0, 0, 0]
    };
}

function locomotionPose(state, phase, speed) {
    const pose = neutralPose();
    if (state === 'idle') {
        pose.bodyY = Math.sin(phase * 0.8) * 0.012;
        pose.head[1] = Math.sin(phase * 0.35) * 0.025;
        return pose;
    }

    const cycle = Math.sin(phase * (state === 'sprint' ? 1.3 : 1));
    if (state === 'walk' || state === 'sprint') {
        const amplitude = state === 'sprint' ? 0.95 : Math.min(0.72, 0.28 + speed * 0.09);
        pose.leftArm[0] = cycle * amplitude;
        pose.rightArm[0] = -cycle * amplitude;
        pose.leftLeg[0] = -cycle * amplitude;
        pose.rightLeg[0] = cycle * amplitude;
        pose.torso[0] = state === 'sprint' ? 0.14 : 0.03;
        pose.torso[2] = cycle * 0.035;
        pose.bodyY = Math.abs(cycle) * 0.035;
        return pose;
    }

    if (state === 'jump') {
        pose.torso[0] = -0.08;
        pose.leftArm[0] = -0.45;
        pose.rightArm[0] = -0.45;
        pose.leftLeg[0] = 0.38;
        pose.rightLeg[0] = -0.18;
        return pose;
    }

    if (state === 'fall') {
        pose.torso[0] = 0.08;
        pose.leftArm[0] = 0.65;
        pose.rightArm[0] = 0.65;
        pose.leftLeg[0] = -0.12;
        pose.rightLeg[0] = 0.22;
        return pose;
    }

    if (state === 'crouch') {
        pose.bodyY = -0.2;
        pose.torso[0] = 0.24;
        pose.leftLeg[0] = 0.42;
        pose.rightLeg[0] = 0.42;
        pose.leftArm[0] = cycle * 0.28;
        pose.rightArm[0] = -cycle * 0.28;
        return pose;
    }

    pose.torso[0] = 0.78;
    pose.leftArm[0] = cycle * 1.05;
    pose.rightArm[0] = -cycle * 1.05;
    pose.leftLeg[0] = -cycle * 0.42;
    pose.rightLeg[0] = cycle * 0.42;
    return pose;
}

function applyActionPose(pose, action, progress) {
    const arc = Math.sin(progress * Math.PI);
    if (action === 'melee') {
        pose.torso[1] -= arc * 0.35;
        pose.rightArm[0] = -1.15 + progress * 1.8;
        pose.rightArm[2] = -0.45 - arc * 0.55;
        return;
    }
    pose.torso[1] += arc * 0.18;
    pose.leftArm[0] = -1.25;
    pose.leftArm[1] = 0.22;
    pose.rightArm[0] = -1.1;
    pose.rightArm[1] = -0.55;
}

function setRotation(part, values, amount) {
    if (!part?.rotation) return;
    part.rotation.x = interpolateAngle(part.rotation.x || 0, values[0], amount);
    part.rotation.y = interpolateAngle(part.rotation.y || 0, values[1], amount);
    part.rotation.z = interpolateAngle(part.rotation.z || 0, values[2], amount);
}

function rotateSecondary(part, x, z, amount) {
    if (!part?.rotation) return;
    part.rotation.x = interpolateAngle(part.rotation.x || 0, x, amount);
    part.rotation.z = interpolateAngle(part.rotation.z || 0, z, amount);
}
