/**
 * Butzcraft - Spiel-Konfiguration
 * Hier kannst du alle wichtigen Parameter anpassen, ohne den Programmcode ändern zu müssen.
 */
export const CONFIG = {
    // Welt-Dimensionen
    WORLD: {
        CHUNK_SIZE: 16,
        CHUNK_HEIGHT: 64,
        RENDER_DIST: 4,
        WATER_LEVEL: 32,
        CLOUD_HEIGHT: 58
    },

    // Spiel-Balance & Zeit
    GAMEPLAY: {
        DAY_DURATION: 300, // Dauer eines Tages in Sekunden (5 Min)
        BLOOD_MOON_INTERVAL: 3, // Alle N Nächte kommt der Blutmond (Zombie-Angriffswelle)
        MAX_HEALTH: 100,
        MAX_HUNGER: 100,
        HUNGER_LOSS_PASSIVE: 0.02, // Passiv pro Sekunde
        HUNGER_LOSS_MOVE: 0.1,    // Beim Bewegen
        HUNGER_GAIN_PIG: 20,
        HUNGER_GAIN_EGG: 5,
        HUNGER_GAIN_MILK: 15,
        REGEN_RATE: 2.0,           // Gesundheit pro Sekunde bei vollem Hunger
        REGEN_THRESHOLD: 90,       // Hunger-Level ab dem man heilt
        FALL_DAMAGE_THRESHOLD: -35, // Ab dieser Fallgeschwindigkeit gibt es Schaden
        FALL_DAMAGE_MULT: 0.5      // Schaden = Fallgeschwindigkeit * Multiplikator
    },

    // Mobs (Wesen)
    MOBS: {
        MAX_COUNT: 20,
        SPAWN_CHANCE: 0.005,
        SPAWN_DIST_MIN: 15,
        SPAWN_DIST_MAX: 35,
        WEIGHT_COW: 30,
        WEIGHT_PIG: 30,
        WEIGHT_SHEEP: 20,
        WEIGHT_CHICKEN: 20,
        WEIGHT_FISH: 40,
        WEIGHT_OCTOPUS: 5,
        WEIGHT_TURTLE: 15,
        ZOMBIE_DETECTION_RANGE: 20,
        ZOMBIE_SPEED: 1.5,
        ZOMBIE_DAMAGE: 5,           // Schaden pro Sekunde (Basiswert)
        WANDER_SPEED: 1.0,
        MOB_JUMP_FORCE: 5,
        CHICKEN_EGG_TIME_MIN: 15000, // ms
        CHICKEN_EGG_TIME_MAX: 35000, // ms
        SHEEP_WOOL_TIME_MIN: 30000,  // ms
        SHEEP_WOOL_TIME_MAX: 50000,   // ms
        COW_MILK_TIME_MIN: 20000,    // ms (Zeit bis man wieder melken kann)
        COW_MILK_TIME_MAX: 40000,    // ms
        WATER_AVOIDANCE_RADIUS: 2    // Mindest-Abstand zum Wasser
    },

    // Physik
    PHYSICS: {
        GRAVITY: 9.8,
        GRAVITY_MULTIPLIER: 4.0,
        WATER_DRAG: 8.0,
        JUMP_FORCE: 30, // Für Welt-Spawn
        PLAYER_JUMP_FORCE: 15.0, // Manuelles Springen (Optimiert für g=4.0)
        WALK_SPEED: 150.0,
        FRICTION: 10.0,
        PLAYER_WIDTH: 0.3,
        // Player AABB-Hitbox (relativ zu Augen-Position):
        PLAYER_HITBOX_Y_MIN: -1.60, // Füße
        PLAYER_HITBOX_Y_MAX: 0.10,  // Kopf
        // Sub-Stepping: max. Distanz pro Mikro-Schritt (Wall-Phasing-Schutz). Hitbox=0.3 → 0.4 sicher.
        SUB_STEP_MAX: 0.4,
        // Sprint/Crouch Modifiers (Multiplikator auf WALK_SPEED & Sound-Schritt-Frequenz)
        SPRINT_SPEED_MULT: 1.6,
        CROUCH_SPEED_MULT: 0.4,
        // Hunger-Verbrauch beim Sprinten (Multiplikator auf HUNGER_LOSS_MOVE)
        SPRINT_HUNGER_MULT: 1.8
    },

    // Entities (Mobs, Projektile, Drops)
    ENTITIES: {
        ARROW_SPEED: 22.0,
        ARROW_DAMAGE: 10,
        ARROW_MAX_LIFETIME: 5.0,      // Sek bis Auto-Despawn (auch ohne Treffer)
        PROJECTILE_HARD_CAP: 200,     // Globaler Sicherheits-Cap gegen Spam
        MOB_DESPAWN_DISTANCE: 50      // Blöcke vom Spieler entfernt → Mob despawnt
    }
};
