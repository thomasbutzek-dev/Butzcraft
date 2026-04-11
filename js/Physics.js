// Physics.js
// Zentrale Kollisions- und Physikabfragen für Player, Mobs und andere Entities.

// Statisches Set für O(1)-Lookup statt O(n) Array.includes() pro Aufruf
// Betten (38, 39) sind begehbar/nicht-solid
// Vegetation (43-50, 52) ist nicht-solid (durchlaufbar)
const NON_SOLID = new Set([0, 8, 9, 10, 13, 14, 15, 16, 38, 39, 43, 44, 46, 47, 48, 49, 50, 52]);

// Türen (33, 34) sind NUR für den Spieler durchlässig
const DOOR_BLOCKS = new Set([33, 34]);

export class Physics {
    /**
     * Prüft, ob ein Block an einer gegebenen Koordinate existiert und kollidierbar ("solid") ist.
     * @param {Object} world - Das World-Objekt
     * @param {number} x - Absolute x Koordinate
     * @param {number} y - Absolute y Koordinate
     * @param {number} z - Absolute z Koordinate
     * @param {boolean} treatWaterAsSolid - Wenn true, wird Wasser UND Türen als fester Block behandelt (Mobs)
     * @returns {boolean} True, wenn der Block eine Feststoffkollision ist.
     */
    static isSolid(world, x, y, z, treatWaterAsSolid = false) {
        const b = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        
        // Block -1 (unloaded Chunk) wirkt wie eine unsichtbare Wand
        if (b === -1) return true;
        
        // Nicht solide Blöcke (O(1) Set-Lookup)
        if (NON_SOLID.has(b)) return false;

        // Wasser-Behandlung (Typ 4)
        if (b === 4 && !treatWaterAsSolid) return false;

        // Tür-Behandlung: Für Spieler (treatWaterAsSolid=false) durchlässig,
        // für Mobs (treatWaterAsSolid=true) solid
        if (DOOR_BLOCKS.has(b) && !treatWaterAsSolid) return false;

        return true;
    }

    /**
     * Präziser Axis-Aligned Bounding Box (AABB) Test.
     * Prüft alle Blöcke, die sich innerhalb oder auf der Begrenzung der Hitbox befinden.
     * @param {Object} world - Das World-Objekt
     * @param {THREE.Vector3} pos - Position der Entity
     * @param {number} halfWidth - Die halbe Breite/Tiefe der Hitbox
     * @param {number} yOffsetMin - Unterste Grenze der Hitbox relativ zu `pos.y` (z.B. Player-Füße: -1.6)
     * @param {number} yOffsetMax - Oberste Grenze der Hitbox relativ zu `pos.y` (z.B. Player-Kopf: +0.1)
     * @param {boolean} treatWaterAsSolid - Ob Wasser wie eine Mauer wirkt
     * @returns {boolean} True, wenn die Entity in einem soliden Block steckt.
     */
    static checkAABBCollision(world, pos, halfWidth, yOffsetMin, yOffsetMax, treatWaterAsSolid = false) {
        const minX = Math.floor(pos.x - halfWidth);
        const maxX = Math.floor(pos.x + halfWidth);
        const minZ = Math.floor(pos.z - halfWidth);
        const maxZ = Math.floor(pos.z + halfWidth);
        const minY = Math.floor(pos.y + yOffsetMin);
        const maxY = Math.floor(pos.y + yOffsetMax);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (Physics.isSolid(world, x, y, z, treatWaterAsSolid)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
