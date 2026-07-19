export const THIRD_PERSON_MIN_DISTANCE = 2;
export const THIRD_PERSON_MAX_DISTANCE = 6;
export const THIRD_PERSON_DEFAULT_DISTANCE = 4.2;
export const THIRD_PERSON_MIN_PITCH = -Math.PI * 0.42;
export const THIRD_PERSON_MAX_PITCH = Math.PI * 0.35;

export function clampThirdPersonDistance(value) {
    const distance = Number(value);
    if (!Number.isFinite(distance)) return THIRD_PERSON_DEFAULT_DISTANCE;
    return Math.max(THIRD_PERSON_MIN_DISTANCE, Math.min(THIRD_PERSON_MAX_DISTANCE, distance));
}

export function clampThirdPersonPitch(value) {
    const pitch = Number(value);
    if (!Number.isFinite(pitch)) return 0;
    return Math.max(THIRD_PERSON_MIN_PITCH, Math.min(THIRD_PERSON_MAX_PITCH, pitch));
}

export function orbitDirection(yaw, pitch) {
    const limitedPitch = clampThirdPersonPitch(pitch);
    const cosPitch = Math.cos(limitedPitch);
    return {
        x: -Math.sin(yaw) * cosPitch,
        y: Math.sin(limitedPitch),
        z: -Math.cos(yaw) * cosPitch
    };
}
