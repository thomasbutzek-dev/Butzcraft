export function isPlayerTouchingFire(world, playerPosition, fireType) {
    if (!world?.getBlock || !playerPosition) return false;
    const x = Math.floor(playerPosition.x);
    const z = Math.floor(playerPosition.z);
    return [-1.6, -0.9, -0.2].some(offset => (
        world.getBlock(x, Math.floor(playerPosition.y + offset), z) === fireType
    ));
}
