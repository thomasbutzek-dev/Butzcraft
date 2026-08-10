const DOOR_BOTTOM = 33;
const DOOR_TOP = 34;
const GATE = 103;
const PANEL_HALF_THICKNESS = 0.075;
const HIT_TOLERANCE = 0.02;

function isInteractiveBlock(block) {
    return block === DOOR_BOTTOM || block === DOOR_TOP || block === GATE;
}

function pointInBox(point, x0, y0, z0, x1, y1, z1) {
    return point.x >= x0 - HIT_TOLERANCE && point.x <= x1 + HIT_TOLERANCE
        && point.y >= y0 - HIT_TOLERANCE && point.y <= y1 + HIT_TOLERANCE
        && point.z >= z0 - HIT_TOLERANCE && point.z <= z1 + HIT_TOLERANCE;
}

function pointOnDoor(point, x, y, z, metadata) {
    const alongX = (metadata & 1) === 0;
    const isOpen = (metadata & 4) !== 0;
    const panelAlongZ = alongX === isOpen;
    if (panelAlongZ) {
        const centerX = isOpen ? x : x + 0.5;
        const startZ = isOpen ? z + 0.5 : z;
        return pointInBox(
            point,
            centerX - PANEL_HALF_THICKNESS, y, startZ,
            centerX + PANEL_HALF_THICKNESS, y + 1, startZ + 1
        );
    }
    const startX = isOpen ? x + 0.5 : x;
    const centerZ = isOpen ? z : z + 0.5;
    return pointInBox(
        point,
        startX, y, centerZ - PANEL_HALF_THICKNESS,
        startX + 1, y + 1, centerZ + PANEL_HALF_THICKNESS
    );
}

function pointOnGate(point, x, y, z, metadata) {
    const alongX = (metadata & 1) === 0;
    const isOpen = (metadata & 4) !== 0;
    const boxes = alongX
        ? [
            [x + 0.04, y, z + 0.38, x + 0.18, y + 1, z + 0.62],
            [x + 0.82, y, z + 0.38, x + 0.96, y + 1, z + 0.62],
            ...(isOpen
                ? [
                    [x + 0.09, y + 0.3, z + 0.5, x + 0.23, y + 0.44, z + 1.18],
                    [x + 0.09, y + 0.68, z + 0.5, x + 0.23, y + 0.82, z + 1.18]
                ]
                : [
                    [x + 0.16, y + 0.3, z + 0.43, x + 0.84, y + 0.44, z + 0.57],
                    [x + 0.16, y + 0.68, z + 0.43, x + 0.84, y + 0.82, z + 0.57]
                ])
        ]
        : [
            [x + 0.38, y, z + 0.04, x + 0.62, y + 1, z + 0.18],
            [x + 0.38, y, z + 0.82, x + 0.62, y + 1, z + 0.96],
            ...(isOpen
                ? [
                    [x + 0.5, y + 0.3, z + 0.09, x + 1.18, y + 0.44, z + 0.23],
                    [x + 0.5, y + 0.68, z + 0.09, x + 1.18, y + 0.82, z + 0.23]
                ]
                : [
                    [x + 0.43, y + 0.3, z + 0.16, x + 0.57, y + 0.44, z + 0.84],
                    [x + 0.43, y + 0.68, z + 0.16, x + 0.57, y + 0.82, z + 0.84]
                ])
        ];
    return boxes.some(box => pointInBox(point, ...box));
}

function findThinInteractiveBlock(world, point) {
    const baseX = Math.floor(point.x);
    const baseY = Math.floor(point.y);
    const baseZ = Math.floor(point.z);
    for (let y = baseY - 1; y <= baseY + 1; y++) {
        for (let x = baseX - 1; x <= baseX + 1; x++) {
            for (let z = baseZ - 1; z <= baseZ + 1; z++) {
                const block = world.getBlock(x, y, z);
                if (!isInteractiveBlock(block)) continue;
                const metadata = world.getBlockMeta(x, y, z);
                const matches = block === GATE
                    ? pointOnGate(point, x, y, z, metadata)
                    : pointOnDoor(point, x, y, z, metadata);
                if (matches) return { x, y, z, block };
            }
        }
    }
    return null;
}

export function resolveBlockInteractionTarget(world, point, faceNormal) {
    const x = Math.floor(point.x - faceNormal.x * 0.5);
    const y = Math.floor(point.y - faceNormal.y * 0.5);
    const z = Math.floor(point.z - faceNormal.z * 0.5);
    const block = world.getBlock(x, y, z);
    if (isInteractiveBlock(block)) return { x, y, z, block };
    return findThinInteractiveBlock(world, point) || { x, y, z, block };
}
