const BED_TYPES = new Set([38, 39]);
const STRUCTURE_SEARCH_RADIUS = 80;

function collectionValues(collection) {
    if (collection instanceof Map) return [...collection.values()];
    if (Array.isArray(collection)) return collection;
    if (collection && typeof collection === 'object') return Object.values(collection);
    return [];
}

function villageCenter(village) {
    if (Number.isFinite(village?.center?.x) && Number.isFinite(village?.center?.z)) {
        return { x: village.center.x, z: village.center.z };
    }
    const houses = Array.isArray(village?.houses) ? village.houses : [];
    const positions = houses.filter(house => Number.isFinite(house?.x) && Number.isFinite(house?.z));
    if (positions.length === 0) return null;
    return {
        x: positions.reduce((sum, house) => sum + house.x, 0) / positions.length,
        z: positions.reduce((sum, house) => sum + house.z, 0) / positions.length
    };
}

function nearestTarget(playerPosition, candidates) {
    if (!Number.isFinite(playerPosition?.x) || !Number.isFinite(playerPosition?.z)) return candidates[0] || null;
    return [...candidates].sort((first, second) => (
        (first.x - playerPosition.x) ** 2 + (first.z - playerPosition.z) ** 2
    ) - (
        (second.x - playerPosition.x) ** 2 + (second.z - playerPosition.z) ** 2
    ))[0] || null;
}

function navigationPosition(position) {
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.z)) return null;
    return {
        x: position.x,
        ...(Number.isFinite(position.y) ? { y: position.y } : {}),
        z: position.z
    };
}

export function resolveRitualSite(ritualSite, structures) {
    if (!ritualSite || typeof ritualSite !== 'object') return null;
    const structureId = typeof ritualSite.structureId === 'string' ? ritualSite.structureId : null;
    const structure = structureId
        ? collectionValues(structures).find(candidate => candidate?.id === structureId)
        : null;
    const position = navigationPosition(structure?.altar?.interaction) ||
        navigationPosition(ritualSite.position);
    if (!position) return null;
    return {
        ...(structureId ? { structureId } : {}),
        position
    };
}

function resolveStructureTarget({
    structureKind,
    savedTarget,
    playerPosition,
    structures,
    structureProgress,
    assumeDiscovered = false
}) {
    if (
        savedTarget?.structureId &&
        Number.isFinite(savedTarget.x) &&
        Number.isFinite(savedTarget.z)
    ) {
        return { ...savedTarget, discovered: true };
    }
    const candidates = collectionValues(structures)
        .filter(structure => (
            structure?.kind === structureKind &&
            Number.isFinite(structure.x) &&
            Number.isFinite(structure.z)
        ))
        .map(structure => ({ x: structure.x, z: structure.z, structureId: structure.id }));
    const nearest = nearestTarget(playerPosition, candidates);
    if (!nearest) return null;
    const distance = Number.isFinite(playerPosition?.x) && Number.isFinite(playerPosition?.z)
        ? Math.hypot(nearest.x - playerPosition.x, nearest.z - playerPosition.z)
        : Infinity;
    const discovered = assumeDiscovered ||
        Boolean(nearest.structureId && structureProgress?.[nearest.structureId]) ||
        distance <= STRUCTURE_SEARCH_RADIUS;
    return {
        ...nearest,
        discovered,
        searchRadius: STRUCTURE_SEARCH_RADIUS
    };
}

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

export function resolveMainQuestTarget({
    mainQuestIndex,
    playerPosition,
    knownVillages,
    generatedVillages,
    structures,
    structureProgress,
    ritualSite
}) {
    const index = Math.max(0, Math.floor(Number(mainQuestIndex) || 0));
    if (index === 1) {
        const candidates = collectionValues(generatedVillages).map(villageCenter).filter(Boolean);
        const target = nearestTarget(playerPosition, candidates);
        return target ? {
            ...target,
            label: 'Dorf suchen',
            discovered: false,
            searchRadius: STRUCTURE_SEARCH_RADIUS
        } : null;
    }
    if (index === 2) {
        const villages = collectionValues(knownVillages);
        const home = villages.find(village => village?.isHome);
        const target = villageCenter(home) || nearestTarget(playerPosition, villages.map(villageCenter).filter(Boolean));
        return target ? { ...target, label: 'Auftragsdorf', discovered: true } : null;
    }
    if (index === 8 || index === 9) {
        const resolvedRitualSite = resolveRitualSite(ritualSite, structures);
        return resolvedRitualSite ? {
            ...resolvedRitualSite.position,
            ...(resolvedRitualSite.structureId ? { structureId: resolvedRitualSite.structureId } : {}),
            label: index === 8 ? 'Ritualaltar' : 'Blutmondwächter',
            discovered: true
        } : null;
    }
    const structureKind = index === 4 ? 'mine' : (index >= 5 && index <= 7 ? 'dungeon' : null);
    if (!structureKind) return null;
    const target = resolveStructureTarget({
        structureKind,
        playerPosition,
        structures,
        structureProgress,
        assumeDiscovered: index > 5
    });
    return target ? {
        ...target,
        label: structureKind === 'mine' ? 'Große Mine' : 'Dungeon'
    } : null;
}

export function resolveSideQuestTarget({
    quest,
    progressComplete,
    village,
    playerPosition,
    structures,
    structureProgress,
    ritualSite
}) {
    const objective = quest?.objective;
    if (!objective) return null;
    const handInTarget = villageCenter(village) || (
        Number.isFinite(objective.target?.x) && Number.isFinite(objective.target?.z)
            ? { x: objective.target.x, z: objective.target.z }
            : null
    );
    if (progressComplete) {
        return handInTarget ? { ...handInTarget, discovered: true, handIn: true } : null;
    }
    if (objective.type === 'place' || objective.type === 'defend') {
        return handInTarget ? { ...handInTarget, discovered: true } : null;
    }
    if (objective.type === 'structure') {
        return resolveStructureTarget({
            structureKind: objective.structureKind,
            savedTarget: objective.target,
            playerPosition,
            structures,
            structureProgress
        });
    }
    if (objective.type === 'boss') {
        const resolvedRitualSite = resolveRitualSite(ritualSite, structures);
        return resolvedRitualSite ? {
            ...resolvedRitualSite.position,
            ...(resolvedRitualSite.structureId ? { structureId: resolvedRitualSite.structureId } : {}),
            discovered: true
        } : null;
    }
    return null;
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
