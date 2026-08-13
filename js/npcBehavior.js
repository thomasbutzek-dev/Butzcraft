const DAY_PHASES = [
    { until: 0.23, id: 'sleep', action: 'sleeping', target: 'home' },
    { until: 0.30, id: 'morning', action: 'preparing', target: 'porch' },
    { until: 0.56, id: 'morning-work', action: 'work', target: 'work' },
    { until: 0.63, id: 'midday', action: 'socializing', target: 'gathering' },
    { until: 0.74, id: 'afternoon-work', action: 'work', target: 'work' },
    { until: 0.83, id: 'evening', action: 'socializing', target: 'community' },
    { until: 1, id: 'night', action: 'sleeping', target: 'home' }
];

const PROFESSION_WORK_ACTIONS = ['forging', 'tending', 'trading', 'studying'];

function normalizedDayRatio(dayRatio) {
    const value = Number.isFinite(dayRatio) ? dayRatio : 0.5;
    return ((value % 1) + 1) % 1;
}

function fallbackTarget(schedule) {
    return schedule.work || schedule.porch || schedule.home || null;
}

export function getNpcRoutine(dayRatio, professionIdx, schedule = {}) {
    const phase = DAY_PHASES.find(candidate => normalizedDayRatio(dayRatio) < candidate.until) || DAY_PHASES[0];
    const target = schedule[phase.target] || fallbackTarget(schedule);
    let action = phase.action;
    if (phase.action === 'work') {
        action = PROFESSION_WORK_ACTIONS[professionIdx] || 'working';
    } else if (phase.id === 'evening' && professionIdx === 2) {
        action = 'serving';
    }
    return { phase: phase.id, action, target };
}

export function getProfessionWorkplace(houses, professionIdx, fallback = null) {
    if (!Array.isArray(houses)) return fallback;
    return houses.find(house => house.professionIdx === professionIdx)?.work || fallback;
}

function nodeKey(x, z) {
    return `${x},${z}`;
}

function nearestOpenNode(open) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index++) {
        if (open[index].score < open[bestIndex].score) bestIndex = index;
    }
    return open.splice(bestIndex, 1)[0];
}

function rebuildPath(nodes, finalKey) {
    const path = [];
    let current = nodes.get(finalKey);
    while (current) {
        path.push({ x: current.x, y: current.y, z: current.z });
        current = current.parent ? nodes.get(current.parent) : null;
    }
    path.reverse();
    return path;
}

export function findNpcPath({
    start,
    target,
    getFootY,
    isBlocked = () => false,
    maxNodes = 700,
    maxDistance = 64,
    goalRadius = 1
}) {
    if (!start || !target || typeof getFootY !== 'function') return [];

    const startX = Math.round(start.x);
    const startZ = Math.round(start.z);
    const targetX = Math.round(target.x);
    const targetZ = Math.round(target.z);
    const startY = getFootY(startX, startZ, start.y);
    if (startY === null || startY === undefined) return [];

    const startKey = nodeKey(startX, startZ);
    const nodes = new Map();
    const open = [];
    const startNode = {
        x: startX,
        y: startY,
        z: startZ,
        cost: 0,
        score: Math.abs(targetX - startX) + Math.abs(targetZ - startZ),
        parent: null
    };
    nodes.set(startKey, startNode);
    open.push(startNode);

    let visited = 0;
    while (open.length > 0 && visited < maxNodes) {
        const current = nearestOpenNode(open);
        const currentKey = nodeKey(current.x, current.z);
        visited++;

        const targetDistance = Math.abs(targetX - current.x) + Math.abs(targetZ - current.z);
        if (targetDistance <= goalRadius) return rebuildPath(nodes, currentKey);

        for (const [stepX, stepZ] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = current.x + stepX;
            const z = current.z + stepZ;
            if (Math.abs(x - startX) + Math.abs(z - startZ) > maxDistance) continue;
            if (isBlocked(x, z) && Math.abs(targetX - x) + Math.abs(targetZ - z) > goalRadius) continue;

            const y = getFootY(x, z, current.y);
            if (y === null || y === undefined || Math.abs(y - current.y) > 1) continue;

            const key = nodeKey(x, z);
            const nextCost = current.cost + 1 + Math.abs(y - current.y) * 0.25;
            const known = nodes.get(key);
            if (known && known.cost <= nextCost) continue;

            const next = {
                x,
                y,
                z,
                cost: nextCost,
                score: nextCost + Math.abs(targetX - x) + Math.abs(targetZ - z),
                parent: currentKey
            };
            nodes.set(key, next);
            const openIndex = open.findIndex(candidate => candidate.x === x && candidate.z === z);
            if (openIndex >= 0) open.splice(openIndex, 1);
            open.push(next);
        }
    }

    return [];
}
