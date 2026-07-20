export function getItemTotal(inventorySlots, type) {
    if (!Array.isArray(inventorySlots)) return 0;
    return inventorySlots.reduce((total, slot) => total + (slot && slot.type === type ? slot.count : 0), 0);
}

export function canCompleteQuest(inventorySlots, quest) {
    return Boolean(quest && quest.give && getItemTotal(inventorySlots, quest.give.type) >= quest.give.count);
}

export function getQuestProgress(inventorySlots, quest) {
    if (!quest || !quest.give) return { current: 0, required: 0, missing: 0, complete: false };
    const current = getItemTotal(inventorySlots, quest.give.type);
    const required = quest.give.count;
    return {
        current,
        required,
        missing: Math.max(0, required - current),
        complete: current >= required
    };
}

export function removeQuestItems(inventorySlots, quest) {
    if (!canCompleteQuest(inventorySlots, quest)) return false;

    let toRemove = quest.give.count;
    for (const slot of inventorySlots) {
        if (toRemove <= 0) break;
        if (slot.type !== quest.give.type) continue;

        const remove = Math.min(slot.count, toRemove);
        slot.count -= remove;
        toRemove -= remove;
        if (slot.count <= 0) {
            slot.type = 0;
            slot.count = 0;
        }
    }

    return true;
}

export const MAX_ACTIVE_SIDE_QUESTS = 3;

const PROBLEM_PROFILES = ['food-shortage', 'monster-pressure', 'damaged-buildings', 'missing-resources', 'lost-expedition'];

const TRUST_TIERS = [
    { id: 'stranger', label: 'Fremd', minimum: 0, priceMultiplier: 1.1 },
    { id: 'known', label: 'Bekannt', minimum: 3, priceMultiplier: 0.9 },
    { id: 'trusted', label: 'Vertraut', minimum: 7, priceMultiplier: 0.8 },
    { id: 'allied', label: 'Verbündet', minimum: 12, priceMultiplier: 0.7 }
];

const NPC_NAMES = [
    ['Hagen', 'Runa', 'Konrad', 'Mara'],
    ['Alma', 'Falk', 'Hedi', 'Bruno'],
    ['Tilda', 'Joris', 'Enna', 'Levin'],
    ['Elin', 'Arvid', 'Lina', 'Theodor']
];

const PROFESSION_QUEST_CHAINS = [
    [
        {
            title: 'Die kalte Esse', requiredTrust: 0,
            objective: { type: 'delivery', itemType: 60, required: 12 },
            reward: { type: 61, count: 2 }, trustReward: 2,
            dialogue: {
                offer: 'Ohne Kohle bleibt meine Esse kalt. Bring mir genug Brennstoff, dann kann ich wieder arbeiten.',
                details: 'Zwölf Stück Kohle reichen für die nächste Schicht. Kohle aus deinem Vorrat zählt ebenfalls.',
                progress: 'Die Glut hält nicht mehr lange. Hast du die Kohle dabei?',
                complete: 'Das Feuer lebt wieder. Nimm dieses Eisen – du hast es dir verdient.'
            }
        },
        {
            title: 'Werkzeug für die Tiefe', requiredTrust: 3,
            objective: { type: 'craft', itemType: 65, required: 1 },
            reward: { type: 62, count: 2 }, trustReward: 3,
            dialogue: {
                offer: 'Ein guter Schmied erkennt sein Werk am Werkzeug. Fertige eine Eisen-Spitzhacke.',
                details: 'Stelle sie nach Annahme dieses Auftrags an einer Werkbank her.',
                progress: 'Eine saubere Spitze und ein fester Schaft – daran erkenne ich gute Arbeit.',
                complete: 'Saubere Arbeit. Jetzt vertraue ich dir auch bei schwierigen Aufträgen.'
            }
        },
        {
            title: 'Klingen gegen Knochen', requiredTrust: 7,
            objective: { type: 'hunt', mobType: 'skeleton', required: 6 },
            reward: { type: 91, count: 1 }, trustReward: 4,
            dialogue: {
                offer: 'Skelette streifen nachts über unsere Wege. Zeig ihnen, was eine gute Klinge vermag.',
                details: 'Besiege sechs Skelette, nachdem du den Auftrag angenommen hast.',
                progress: 'Solange die Knochen klappern, sind unsere Wege nicht sicher.',
                complete: 'Das Dorf schläft ruhiger. Diese Klinge gehört jetzt dir.'
            }
        }
    ],
    [
        {
            title: 'Leere Vorratskörbe', requiredTrust: 0,
            objective: { type: 'delivery', itemType: 51, required: 12 },
            reward: { type: 88, count: 4 }, trustReward: 2,
            dialogue: {
                offer: 'Die Vorratskörbe sind fast leer. Ein paar Beeren würden uns über die nächsten Tage helfen.',
                details: 'Bring zwölf Beeren. Bereits gesammelte Vorräte kannst du direkt abgeben.',
                progress: 'Die Kinder fragen schon nach dem Abendessen. Hast du etwas gefunden?',
                complete: 'Das reicht für viele Mahlzeiten. Danke – hier ist Futter für deine Tiere.'
            }
        },
        {
            title: 'Ein sicherer Hof', requiredTrust: 3,
            objective: { type: 'place', itemType: 102, required: 8, villageRadius: 34 },
            reward: { type: 19, count: 4 }, trustReward: 3,
            dialogue: {
                offer: 'Nachts dringen Tiere und Monster auf die Felder. Hilfst du mir mit einem neuen Zaun?',
                details: 'Setze acht Zaunelemente innerhalb des Dorfes, nachdem du den Auftrag angenommen hast.',
                progress: 'Die offene Stelle liegt noch immer im Wind.',
                complete: 'Der Hof ist wieder sicher. Diese Wolle soll dich warm halten.'
            }
        },
        {
            title: 'Vorrat für den Winter', requiredTrust: 7,
            objective: { type: 'delivery', itemType: 19, required: 10 },
            reward: { type: 97, count: 4 }, trustReward: 4,
            dialogue: {
                offer: 'Der nächste Winter kommt bestimmt. Wir brauchen Wolle für Decken und Kleidung.',
                details: 'Zehn Stück Wolle füllen unser Lager für eine Weile.',
                progress: 'Jede weitere Decke kann in einer kalten Nacht entscheidend sein.',
                complete: 'Jetzt sind wir vorbereitet. Teile diese Vorräte mit deinen Gefährten.'
            }
        }
    ],
    [
        {
            title: 'Ware aus der Ferne', requiredTrust: 0,
            objective: { type: 'delivery', itemType: 30, required: 12 },
            reward: { type: 62, count: 2 }, trustReward: 2,
            dialogue: {
                offer: 'Meine Kunden wollen Stein aus fernen Gegenden. Sandstein wäre ein guter Anfang.',
                details: 'Bring zwölf Sandsteinblöcke. Woher sie stammen, überlasse ich dir.',
                progress: 'Ein Händler ohne Ware ist nur jemand mit einem leeren Wagen.',
                complete: 'Genau diese Qualität habe ich gesucht. Wir werden noch gute Geschäfte machen.'
            }
        },
        {
            title: 'Die verschollene Lieferung', requiredTrust: 3,
            objective: { type: 'structure', structureKind: 'mine', required: 1 },
            reward: { type: 66, count: 1 }, trustReward: 3,
            dialogue: {
                offer: 'Eine Lieferung aus einer großen Mine ist nie angekommen. Finde heraus, was dort geschah.',
                details: 'Erreiche die Belohnungskammer einer großen Mine.',
                progress: 'Ohne Nachricht von der Mine kann ich keine neue Route planen.',
                complete: 'Du hast mehr gefunden als nur eine verlorene Spur. Diese Spitzhacke hilft dir auf der nächsten Reise.'
            }
        },
        {
            title: 'Ein Handel mit dem Frost', requiredTrust: 7,
            objective: { type: 'delivery', itemType: 78, required: 12 },
            reward: { type: 62, count: 5 }, trustReward: 4,
            dialogue: {
                offer: 'Im Süden zahlen sie gut für klares Eis. Beschaffe mir eine Lieferung, bevor der Markt kippt.',
                details: 'Zwölf Blöcke Eis genügen für meinen besten Kunden.',
                progress: 'Der Käufer wartet nicht ewig – aber ich breche unser Wort nicht.',
                complete: 'Pünktlich und unversehrt. Du bist längst mehr Partner als Laufbursche.'
            }
        }
    ],
    [
        {
            title: 'Zeichen der Vergangenheit', requiredTrust: 0,
            objective: { type: 'delivery', itemType: 31, required: 10 },
            reward: { type: 95, count: 8 }, trustReward: 2,
            dialogue: {
                offer: 'In alten Knochen bleiben Spuren vergangener Nächte. Bring mir einige für meine Aufzeichnungen.',
                details: 'Zehn Knochen sollten genügen. Bereits gefundene Exemplare zählen.',
                progress: 'Die Chronik wartet auf ihre fehlenden Seiten.',
                complete: 'Diese Spuren bestätigen meine Sorge: Der Blutmond folgt einem alten Muster.'
            }
        },
        {
            title: 'Die versiegelte Chronik', requiredTrust: 3,
            objective: { type: 'structure', structureKind: 'dungeon', required: 1 },
            reward: { type: 94, count: 1 }, trustReward: 3,
            dialogue: {
                offer: 'Unter der Erde liegt eine versiegelte Chronik. Suche die Endkammer eines Dungeons.',
                details: 'Öffne die Belohnungstruhe hinter dem unteren Dungeon-Tor.',
                progress: 'Das Siegel kann nur dort gebrochen werden, wo die Quelle einst verehrt wurde.',
                complete: 'Die Chronik nennt einen Wächter – und ein Ritual, das ihn bindet.'
            }
        },
        {
            title: 'Echo der Quelle', requiredTrust: 7, requiredStoryIndex: 10,
            objective: { type: 'boss', bossType: 'bloodMoonEcho', required: 1 },
            reward: { type: 92, count: 1 }, trustReward: 5,
            dialogue: {
                offer: 'Der Wächter ist gefallen, doch sein Echo kehrt zurück. Stelle dich ihm noch einmal am Altar.',
                details: 'Aktiviere den Ritualaltar nach Abschluss der Hauptgeschichte und besiege das Blutmondecho.',
                progress: 'Das Echo ist noch nicht verstummt. Der Altar wartet in der Endkammer.',
                complete: 'Jetzt ist selbst der Nachhall gebrochen. Diese Klinge trägt die Geschichte deines Sieges.'
            }
        }
    ]
];

const QUEST_TEMPLATES = [
    {
        id: 'food-berries', title: 'Vorräte für das Dorf', professionIdx: 1,
        problems: ['food-shortage'], biomes: ['Grasland', 'Urwald'],
        objective: { type: 'delivery', itemType: 51, required: 16 },
        reward: { type: 88, count: 4 }, trustReward: 2
    },
    {
        id: 'food-wool', title: 'Warme Vorräte', professionIdx: 1,
        problems: ['food-shortage'], biomes: ['Schneefeld', 'Grasland'],
        objective: { type: 'delivery', itemType: 19, required: 8 },
        reward: { type: 61, count: 2 }, trustReward: 2
    },
    {
        id: 'defend-zombies', title: 'Gefahr vor den Toren', professionIdx: 0,
        problems: ['monster-pressure'], biomes: [],
        objective: { type: 'hunt', mobType: 'zombie', required: 6 },
        reward: { type: 61, count: 2 }, trustReward: 2
    },
    {
        id: 'defend-skeletons', title: 'Knochen in der Nacht', professionIdx: 3,
        problems: ['monster-pressure'], biomes: [],
        objective: { type: 'hunt', mobType: 'skeleton', required: 4 },
        reward: { type: 82, count: 3 }, trustReward: 2
    },
    {
        id: 'repair-fences', title: 'Die Einfriedung erneuern', professionIdx: 1,
        problems: ['damaged-buildings'], biomes: [],
        objective: { type: 'place', itemType: 102, required: 8, villageRadius: 34 },
        reward: { type: 26, count: 16 }, trustReward: 2
    },
    {
        id: 'repair-torches', title: 'Licht für die Wege', professionIdx: 0,
        problems: ['damaged-buildings'], biomes: [],
        objective: { type: 'place', itemType: 101, required: 6, villageRadius: 34 },
        reward: { type: 60, count: 8 }, trustReward: 2
    },
    {
        id: 'resources-coal', title: 'Kohle für die Werkstatt', professionIdx: 0,
        problems: ['missing-resources'], biomes: [],
        objective: { type: 'delivery', itemType: 60, required: 18 },
        reward: { type: 61, count: 3 }, trustReward: 2
    },
    {
        id: 'resources-sandstone', title: 'Stein aus der Wüste', professionIdx: 2,
        problems: ['missing-resources'], biomes: ['Wüste'],
        objective: { type: 'craft', itemType: 30, required: 12 },
        reward: { type: 62, count: 2 }, trustReward: 2
    },
    {
        id: 'resources-ice', title: 'Klares Eis', professionIdx: 2,
        problems: ['missing-resources'], biomes: ['Schneefeld'],
        objective: { type: 'delivery', itemType: 78, required: 10 },
        reward: { type: 61, count: 2 }, trustReward: 2
    },
    {
        id: 'expedition-mine', title: 'Die verlorene Mine', professionIdx: 0,
        problems: ['lost-expedition'], biomes: ['Grasland', 'Urwald', 'Schneefeld'],
        objective: { type: 'structure', structureKind: 'mine', required: 1 },
        reward: { type: 62, count: 2 }, trustReward: 3
    },
    {
        id: 'expedition-dungeon', title: 'Spuren in der Tiefe', professionIdx: 3,
        problems: ['lost-expedition'], biomes: [],
        objective: { type: 'structure', structureKind: 'dungeon', required: 1 },
        reward: { type: 65, count: 1 }, trustReward: 3
    },
    {
        id: 'supplies-bones', title: 'Zeichen vergangener Kämpfe', professionIdx: 3,
        problems: ['monster-pressure', 'lost-expedition'], biomes: ['Wüste', 'Grasland'],
        objective: { type: 'delivery', itemType: 31, required: 10 },
        reward: { type: 82, count: 5 }, trustReward: 2
    }
];

function hashString(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
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

export function getVillageId(village) {
    if (typeof village?.id === 'string' && village.id.startsWith('village:')) return village.id;
    if (Number.isFinite(village?.cx) && Number.isFinite(village?.cz)) {
        return `village:${Math.trunc(village.cx)},${Math.trunc(village.cz)}`;
    }
    const center = villageCenter(village);
    if (!center) return null;
    return `village:at:${Math.round(center.x)},${Math.round(center.z)}`;
}

export function getNpcIdentity(villageId, professionIdx, residentIndex = 0) {
    const normalizedProfession = Math.abs(Math.trunc(professionIdx || 0)) % NPC_NAMES.length;
    const names = NPC_NAMES[normalizedProfession];
    const seed = hashString(`${villageId}:${normalizedProfession}:${residentIndex}`);
    return {
        id: `npc:${villageId}:${normalizedProfession}:${Math.max(0, Math.trunc(residentIndex || 0))}`,
        name: names[seed % names.length]
    };
}

export function createQuestState(legacyStoryIndex = 0) {
    return {
        mainQuestIndex: Number.isFinite(legacyStoryIndex) ? Math.max(0, Math.floor(legacyStoryIndex)) : 0,
        homeVillageId: null,
        trackedTarget: { kind: 'main' },
        activeSideQuests: [],
        completedQuestIds: [],
        abandonedQuestIds: [],
        villages: {},
        questItems: {},
        storyFlags: {}
    };
}

export function normalizeQuestState(rawState, legacyStoryIndex = 0) {
    const fallback = createQuestState(legacyStoryIndex);
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return fallback;
    const mainQuestIndex = Number.isFinite(rawState.mainQuestIndex)
        ? Math.max(0, Math.floor(rawState.mainQuestIndex))
        : fallback.mainQuestIndex;
    return {
        mainQuestIndex,
        homeVillageId: typeof rawState.homeVillageId === 'string' ? rawState.homeVillageId : null,
        trackedTarget: rawState.trackedTarget && typeof rawState.trackedTarget === 'object'
            ? { ...rawState.trackedTarget }
            : { kind: 'main' },
        activeSideQuests: Array.isArray(rawState.activeSideQuests) ? rawState.activeSideQuests : [],
        completedQuestIds: Array.isArray(rawState.completedQuestIds) ? rawState.completedQuestIds : [],
        abandonedQuestIds: Array.isArray(rawState.abandonedQuestIds) ? rawState.abandonedQuestIds : [],
        villages: rawState.villages && typeof rawState.villages === 'object' && !Array.isArray(rawState.villages)
            ? rawState.villages
            : {},
        questItems: rawState.questItems && typeof rawState.questItems === 'object' && !Array.isArray(rawState.questItems)
            ? rawState.questItems
            : {},
        storyFlags: rawState.storyFlags && typeof rawState.storyFlags === 'object' && !Array.isArray(rawState.storyFlags)
            ? rawState.storyFlags
            : {}
    };
}

export function grantQuestItem(questState, itemId, count = 1) {
    if (!questState || typeof itemId !== 'string' || !itemId) return 0;
    if (!questState.questItems || typeof questState.questItems !== 'object') questState.questItems = {};
    const current = Math.max(0, Math.floor(Number(questState.questItems[itemId]) || 0));
    const added = Math.max(0, Math.floor(Number(count) || 0));
    questState.questItems[itemId] = current + added;
    return questState.questItems[itemId];
}

export function hasQuestItems(questState, requirements) {
    if (!requirements || typeof requirements !== 'object') return true;
    return Object.entries(requirements).every(([itemId, count]) => (
        Math.max(0, Math.floor(Number(questState?.questItems?.[itemId]) || 0)) >= Math.max(0, Math.floor(Number(count) || 0))
    ));
}

function getProblemProfile(villageId) {
    return PROBLEM_PROFILES[hashString(villageId) % PROBLEM_PROFILES.length];
}

export function generateVillageOffers(village, dayCount = 0, problemProfile = null) {
    const villageId = getVillageId(village);
    if (!villageId) return [];
    const biome = village?.biome || 'Grasland';
    const problem = problemProfile || getProblemProfile(villageId);
    const cycle = Math.max(0, Math.floor(Number(dayCount) || 0) / 3);
    const center = villageCenter(village);
    const ranked = QUEST_TEMPLATES
        .map(template => {
            const problemMatch = template.problems.includes(problem) ? 0 : 1;
            const biomeMatch = template.biomes.length === 0 || template.biomes.includes(biome) ? 0 : 1;
            return {
                template,
                rank: problemMatch * 1000000000 + biomeMatch * 100000000 + hashString(`${villageId}:${cycle}:${template.id}`)
            };
        })
        .sort((first, second) => first.rank - second.rank)
        .slice(0, 3);

    return ranked.map(({ template }, slot) => ({
        id: `${villageId}:offer:${cycle}:${slot}:${template.id}`,
        templateId: template.id,
        villageId,
        professionIdx: template.professionIdx,
        title: template.title,
        objective: {
            ...template.objective,
            current: 0,
            ...(center ? { target: center } : {})
        },
        reward: { ...template.reward },
        trustReward: template.trustReward,
        offeredDay: Math.max(0, Math.floor(Number(dayCount) || 0))
    }));
}

export function ensureVillageState(questState, village, dayCount = 0) {
    const villageId = getVillageId(village);
    if (!villageId) return null;
    if (!questState.villages || typeof questState.villages !== 'object') questState.villages = {};
    let stored = questState.villages[villageId];
    if (!stored || typeof stored !== 'object') {
        const problemProfile = getProblemProfile(villageId);
        stored = {
            id: villageId,
            biome: village?.biome || 'Grasland',
            center: villageCenter(village),
            problemProfile,
            trust: 0,
            offers: generateVillageOffers(village, dayCount, problemProfile),
            nextOfferRefreshDay: Math.max(0, Math.floor(Number(dayCount) || 0)) + 3,
            nextReplacementDay: null,
            professionChainProgress: {}
        };
        questState.villages[villageId] = stored;
    } else {
        if (!Array.isArray(stored.offers)) stored.offers = [];
        if (!stored.professionChainProgress || typeof stored.professionChainProgress !== 'object') {
            stored.professionChainProgress = {};
        }
        if (!Number.isFinite(stored.nextOfferRefreshDay)) {
            stored.nextOfferRefreshDay = Math.max(0, Math.floor(Number(dayCount) || 0));
        }
    }
    return stored;
}

export function getProfessionChainStatus(questState, villageId, professionIdx, mainQuestIndex = 0) {
    const village = questState?.villages?.[villageId];
    const normalizedProfession = Math.max(0, Math.min(PROFESSION_QUEST_CHAINS.length - 1, Math.floor(Number(professionIdx) || 0)));
    if (!village) return { state: 'unavailable', quest: null, reason: 'Dorf nicht bekannt.' };
    if (!village.professionChainProgress || typeof village.professionChainProgress !== 'object') {
        village.professionChainProgress = {};
    }
    const stage = Math.max(0, Math.floor(Number(village.professionChainProgress[normalizedProfession]) || 0));
    const template = PROFESSION_QUEST_CHAINS[normalizedProfession]?.[stage];
    if (!template) return { state: 'complete', quest: null, reason: 'Questreihe abgeschlossen.' };

    const questId = `${villageId}:profession:${normalizedProfession}:${stage}`;
    const activeQuest = (questState.activeSideQuests || []).find(quest => quest.id === questId);
    if (activeQuest) return { state: 'active', quest: activeQuest, reason: null };

    const requiredTrust = Math.max(0, Number(template.requiredTrust) || 0);
    if ((Number(village.trust) || 0) < requiredTrust) {
        return {
            state: 'locked', quest: null,
            reason: `${requiredTrust} Vertrauen in diesem Dorf erforderlich.`
        };
    }
    const requiredStoryIndex = Math.max(0, Number(template.requiredStoryIndex) || 0);
    if ((Number(mainQuestIndex) || 0) < requiredStoryIndex) {
        return {
            state: 'locked', quest: null,
            reason: 'Diese Aufgabe wird erst nach der Hauptgeschichte verfügbar.'
        };
    }

    return {
        state: 'available',
        reason: null,
        quest: {
            id: questId,
            templateId: `profession:${normalizedProfession}:${stage}`,
            villageId,
            professionIdx: normalizedProfession,
            title: template.title,
            objective: {
                ...template.objective,
                current: 0,
                ...(village.center ? { target: { ...village.center } } : {})
            },
            reward: { ...template.reward },
            trustReward: template.trustReward,
            dialogue: { ...template.dialogue },
            chain: { professionIdx: normalizedProfession, stage }
        }
    };
}

export function addVillageTrust(questState, villageId, amount) {
    const village = questState?.villages?.[villageId];
    if (!village) return 0;
    village.trust = Math.max(0, Math.floor(Number(village.trust) || 0) + Math.max(0, Math.floor(Number(amount) || 0)));
    return village.trust;
}

export function getTrustTier(trust) {
    const points = Math.max(0, Math.floor(Number(trust) || 0));
    return [...TRUST_TIERS].reverse().find(tier => points >= tier.minimum) || TRUST_TIERS[0];
}

export function getAdjustedTrade(trade, trust = 0) {
    if (!trade?.give || !trade?.receive) return trade;
    const tier = getTrustTier(trust);
    return {
        ...trade,
        give: {
            ...trade.give,
            count: Math.max(1, Math.ceil(Math.max(1, trade.give.count) * tier.priceMultiplier))
        },
        receive: { ...trade.receive }
    };
}

export function acceptSideQuest(questState, offer) {
    if (!questState || !offer?.id) return { accepted: false, reason: 'invalid-quest' };
    if (!Array.isArray(questState.activeSideQuests)) questState.activeSideQuests = [];
    if (questState.activeSideQuests.some(quest => quest.id === offer.id)) {
        return { accepted: false, reason: 'already-active' };
    }
    if (questState.activeSideQuests.length >= MAX_ACTIVE_SIDE_QUESTS) {
        return { accepted: false, reason: 'quest-limit' };
    }
    questState.activeSideQuests.push({
        ...offer,
        objective: { ...offer.objective, current: Math.max(0, Number(offer.objective?.current) || 0) },
        reward: offer.reward ? { ...offer.reward } : null,
        status: 'active'
    });
    questState.trackedTarget = { kind: 'side', questId: offer.id };
    return { accepted: true, reason: null };
}

export function abandonSideQuest(questState, questId) {
    if (!Array.isArray(questState?.activeSideQuests)) return false;
    const index = questState.activeSideQuests.findIndex(quest => quest.id === questId);
    if (index < 0) return false;
    questState.activeSideQuests.splice(index, 1);
    if (!Array.isArray(questState.abandonedQuestIds)) questState.abandonedQuestIds = [];
    if (!questState.abandonedQuestIds.includes(questId)) questState.abandonedQuestIds.push(questId);
    if (questState.trackedTarget?.questId === questId) questState.trackedTarget = { kind: 'main' };
    return true;
}

function isInsideObjectiveArea(objective, position) {
    if (!objective?.target || !Number.isFinite(objective.target.x) || !Number.isFinite(objective.target.z)) return true;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const radius = Math.max(1, Number(objective.villageRadius || objective.radius) || 30);
    return Math.hypot(position.x - objective.target.x, position.z - objective.target.z) <= radius;
}

function eventMatchesObjective(objective, event) {
    if (!objective || !event || objective.type !== event.type) return false;
    if (objective.itemType && objective.itemType !== event.itemType) return false;
    if (objective.mobType && objective.mobType !== event.mobType) return false;
    if (objective.structureKind && objective.structureKind !== event.structureKind) return false;
    if (objective.bossType && objective.bossType !== event.bossType) return false;
    if ((objective.type === 'place' || objective.type === 'defend') && !isInsideObjectiveArea(objective, event.position)) return false;
    return true;
}

export function applyQuestEvent(questState, event) {
    const updated = [];
    for (const quest of questState?.activeSideQuests || []) {
        if (!eventMatchesObjective(quest.objective, event)) continue;
        const required = Math.max(1, Math.floor(Number(quest.objective.required) || 1));
        const current = Math.max(0, Math.floor(Number(quest.objective.current) || 0));
        quest.objective.current = Math.min(required, current + Math.max(1, Math.floor(Number(event.count) || 1)));
        updated.push(quest.id);
    }
    return updated;
}

export function getSideQuestProgress(quest, inventorySlots = []) {
    const required = Math.max(1, Math.floor(Number(quest?.objective?.required) || 1));
    const current = quest?.objective?.type === 'delivery'
        ? getItemTotal(inventorySlots, quest.objective.itemType)
        : Math.max(0, Math.floor(Number(quest?.objective?.current) || 0));
    return {
        current: Math.min(current, required),
        required,
        complete: current >= required
    };
}

export function completeSideQuest(questState, questId, dayCount = 0) {
    if (!Array.isArray(questState?.activeSideQuests)) return null;
    const index = questState.activeSideQuests.findIndex(quest => quest.id === questId);
    if (index < 0) return null;
    const [quest] = questState.activeSideQuests.splice(index, 1);
    if (!Array.isArray(questState.completedQuestIds)) questState.completedQuestIds = [];
    if (!questState.completedQuestIds.includes(quest.id)) questState.completedQuestIds.push(quest.id);
    addVillageTrust(questState, quest.villageId, quest.trustReward || 0);
    const village = questState.villages?.[quest.villageId];
    if (village) {
        village.nextReplacementDay = Math.max(0, Math.floor(Number(dayCount) || 0)) + 1;
        if (quest.chain && Number.isInteger(quest.chain.professionIdx) && Number.isInteger(quest.chain.stage)) {
            if (!village.professionChainProgress || typeof village.professionChainProgress !== 'object') {
                village.professionChainProgress = {};
            }
            const currentStage = Math.max(0, Math.floor(Number(village.professionChainProgress[quest.chain.professionIdx]) || 0));
            village.professionChainProgress[quest.chain.professionIdx] = Math.max(currentStage, quest.chain.stage + 1);
        }
    }
    if (questState.trackedTarget?.questId === quest.id) questState.trackedTarget = { kind: 'main' };
    return quest;
}

export function refreshVillageOffers(questState, village, dayCount = 0) {
    const stored = ensureVillageState(questState, village, dayCount);
    if (!stored) return null;
    const currentDay = Math.max(0, Math.floor(Number(dayCount) || 0));
    if (currentDay >= (Number(stored.nextOfferRefreshDay) || 0)) {
        stored.offers = generateVillageOffers({ ...village, id: stored.id, center: stored.center }, currentDay, stored.problemProfile);
        stored.nextOfferRefreshDay = currentDay + 3;
        stored.nextReplacementDay = null;
        return stored;
    }
    if (stored.offers.length < 3 && Number.isFinite(stored.nextReplacementDay) && currentDay >= stored.nextReplacementDay) {
        const blockedIds = new Set([
            ...(questState.completedQuestIds || []),
            ...(questState.abandonedQuestIds || []),
            ...(questState.activeSideQuests || []).map(quest => quest.id)
        ]);
        const templateIds = new Set(stored.offers.map(offer => offer.templateId));
        for (let offset = 1; offset <= 4 && stored.offers.length < 3; offset++) {
            const candidates = generateVillageOffers(
                { ...village, id: stored.id, center: stored.center },
                currentDay + offset * 3,
                stored.problemProfile
            );
            for (const candidate of candidates) {
                if (blockedIds.has(candidate.id) || templateIds.has(candidate.templateId)) continue;
                stored.offers.push(candidate);
                templateIds.add(candidate.templateId);
                if (stored.offers.length >= 3) break;
            }
        }
        stored.nextReplacementDay = null;
    }
    return stored;
}
