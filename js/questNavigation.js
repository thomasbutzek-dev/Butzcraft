const BED_TYPES = new Set([38, 39]);

function normalizeDegrees(degrees) {
    return ((degrees + 180) % 360 + 360) % 360 - 180;
}

export function getCompassHeadingDegrees(cameraYawRadians) {
    if (!Number.isFinite(cameraYawRadians)) return 0;
    return normalizeDegrees(-cameraYawRadians * 180 / Math.PI);
}

export function getRelativeCompassBearing(bearing, headingDegrees) {
    return normalizeDegrees((Number(bearing) || 0) - (Number(headingDegrees) || 0));
}

function getDirectionName(dx, dz) {
    const eastWest = dx >= 0 ? 'östlich' : 'westlich';
    const northSouth = dz >= 0 ? 'südlich' : 'nördlich';
    const diagonalNorthSouth = dz >= 0 ? 'süd' : 'nord';
    const absX = Math.abs(dx);
    const absZ = Math.abs(dz);
    if (absX > absZ * 2) return eastWest;
    if (absZ > absX * 2) return northSouth;
    return `${diagonalNorthSouth}${eastWest}`;
}

export function getCompassGuidance(origin, target) {
    if (!origin || !target || !Number.isFinite(origin.x) || !Number.isFinite(origin.z) || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
        return null;
    }
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const distance = Math.round(Math.hypot(dx, dz));
    const exact = target.discovered !== false;
    const displayDistance = exact
        ? Math.max(0, Math.round(distance / 10) * 10)
        : Math.max(50, Math.round(distance / 50) * 50);
    return {
        distance,
        displayDistance,
        directionName: getDirectionName(dx, dz),
        bearing: (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360,
        exact,
        searchRadius: exact ? 0 : Math.max(10, Math.round(Number(target.searchRadius) || 50))
    };
}

export function resolveHomeTarget(respawnBed, getBlock) {
    if (!respawnBed || !Number.isFinite(respawnBed.x) || !Number.isFinite(respawnBed.y) || !Number.isFinite(respawnBed.z)) return null;
    if (typeof getBlock !== 'function' || !BED_TYPES.has(getBlock(respawnBed.x, respawnBed.y, respawnBed.z))) return null;
    return {
        x: respawnBed.x + 0.5,
        y: respawnBed.y + 0.5,
        z: respawnBed.z + 0.5,
        kind: 'home',
        discovered: true
    };
}
