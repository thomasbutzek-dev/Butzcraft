import { inventorySlots } from './inventory.js?v=20260721c';
import { abandonSideQuest, getSideQuestProgress, getTrustTier } from './quests.js?v=20260721b';
import { getCompassGuidance, getCompassHeadingDegrees, getRelativeCompassBearing, resolveHomeTarget } from './questNavigation.js?v=20260721e';

const PROFESSION_NAMES = ['Schmied', 'Bauer', 'Händler', 'Bibliothekar'];

function getQuestState() {
    return window.getQuestState?.() || null;
}

function makeButton(label, onClick, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `quest-journal-button ${className}`.trim();
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function renderMainQuest(container, state) {
    container.innerHTML = '';
    const objective = window.getCurrentStoryObjective?.();
    const card = document.createElement('article');
    card.className = 'quest-journal-card main';
    const title = document.createElement('strong');
    title.textContent = objective?.text || 'Deine Reise';
    const details = document.createElement('span');
    details.textContent = objective?.hint || `Hauptquest – Abschnitt ${state.mainQuestIndex + 1}`;
    const relics = [];
    if (state.questItems?.deepCrystal) relics.push('Tiefenkristall');
    if (state.questItems?.bloodSeal) relics.push('Blutsiegel');
    const track = makeButton(state.trackedTarget?.kind === 'main' ? 'Wird verfolgt' : 'Verfolgen', () => {
        state.trackedTarget = { kind: 'main' };
        renderQuestJournal();
        updateQuestCompass();
    });
    track.disabled = state.trackedTarget?.kind === 'main';
    card.append(title, details);
    if (relics.length > 0) {
        const questItems = document.createElement('span');
        questItems.className = 'quest-journal-items';
        questItems.textContent = `Questrelikte: ${relics.join(' · ')}`;
        card.appendChild(questItems);
    }
    card.appendChild(track);
    container.appendChild(card);
}

function renderSideQuests(container, state) {
    container.innerHTML = '';
    if (state.activeSideQuests.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'quest-journal-empty';
        empty.textContent = 'Keine Nebenquest aktiv. Sprich mit den Bewohnern eines Dorfes.';
        container.appendChild(empty);
        return;
    }
    for (const quest of state.activeSideQuests) {
        const progress = getSideQuestProgress(quest, inventorySlots);
        const card = document.createElement('article');
        card.className = 'quest-journal-card';
        const title = document.createElement('strong');
        title.textContent = quest.title;
        const details = document.createElement('span');
        details.textContent = `${progress.current}/${progress.required} · ${PROFESSION_NAMES[quest.professionIdx] || 'Dorfauftrag'}`;
        const actions = document.createElement('div');
        actions.className = 'quest-journal-actions';
        const tracked = state.trackedTarget?.kind === 'side' && state.trackedTarget.questId === quest.id;
        const track = makeButton(tracked ? 'Wird verfolgt' : 'Verfolgen', () => {
            state.trackedTarget = { kind: 'side', questId: quest.id };
            renderQuestJournal();
            updateQuestCompass();
        });
        track.disabled = tracked;
        const abandon = makeButton('Abbrechen', () => {
            abandonSideQuest(state, quest.id);
            renderQuestJournal();
            updateQuestCompass();
        }, 'danger');
        actions.append(track, abandon);
        card.append(title, details, actions);
        container.appendChild(card);
    }
}

function renderVillages(container, state) {
    container.innerHTML = '';
    const villages = Object.values(state.villages || {});
    if (villages.length === 0) {
        container.textContent = 'Noch kein Dorf kennengelernt.';
        return;
    }
    for (const village of villages) {
        const tier = getTrustTier(village.trust);
        const card = document.createElement('article');
        card.className = 'quest-journal-card village';
        const home = village.id === state.homeVillageId ? ' · Heimatdorf' : '';
        const title = document.createElement('strong');
        title.textContent = `${village.biome || 'Dorf'}${home}`;
        const details = document.createElement('span');
        details.textContent = `${tier.label} · ${village.trust || 0} Vertrauen · ${(village.offers || []).length} Angebote`;
        card.append(title, details);
        container.appendChild(card);
    }
}

function renderHomeButton(container, state) {
    container.innerHTML = '';
    const context = window.getQuestNavigationContext?.();
    const home = resolveHomeTarget(context?.respawnBed, context?.world?.getBlock?.bind(context.world));
    const button = makeButton(state.trackedTarget?.kind === 'home' ? 'Zuhause wird verfolgt' : 'Zuhause verfolgen', () => {
        state.trackedTarget = { kind: 'home' };
        renderQuestJournal();
        updateQuestCompass();
    });
    button.disabled = !home || state.trackedTarget?.kind === 'home';
    container.appendChild(button);
    if (!home) {
        const hint = document.createElement('span');
        hint.textContent = ' Schlafe in einem gültigen Bett, um Zuhause zu setzen.';
        container.appendChild(hint);
    }
}

export function renderQuestJournal() {
    const state = getQuestState();
    if (!state) return;
    const main = document.getElementById('quest-journal-main');
    const side = document.getElementById('quest-journal-side');
    const villages = document.getElementById('quest-journal-villages');
    const home = document.getElementById('quest-journal-home');
    if (main) renderMainQuest(main, state);
    if (side) renderSideQuests(side, state);
    if (villages) renderVillages(villages, state);
    if (home) renderHomeButton(home, state);
}

export function showInventoryPanel(panel = 'inventory') {
    const overlay = document.getElementById('inventory-overlay');
    const journal = document.getElementById('quest-journal');
    if (!overlay || !journal) return;
    const showJournal = panel === 'quests';
    overlay.classList.toggle('quest-view', showJournal);
    journal.hidden = !showJournal;
    document.getElementById('inventory-view-tab')?.setAttribute('aria-selected', showJournal ? 'false' : 'true');
    document.getElementById('quest-view-tab')?.setAttribute('aria-selected', showJournal ? 'true' : 'false');
    if (showJournal) renderQuestJournal();
}

function trackedTarget(state, context) {
    if (state.trackedTarget?.kind === 'home') {
        const home = resolveHomeTarget(context?.respawnBed, context?.world?.getBlock?.bind(context.world));
        if (!home) state.trackedTarget = { kind: 'main' };
        else return { ...home, label: 'Zuhause' };
    }
    if (state.trackedTarget?.kind === 'side') {
        const quest = state.activeSideQuests.find(candidate => candidate.id === state.trackedTarget.questId);
        if (quest?.objective?.target) {
            return {
                ...quest.objective.target,
                label: quest.title,
                discovered: quest.objective.type !== 'structure',
                searchRadius: quest.objective.type === 'structure' ? 80 : 30
            };
        }
        state.trackedTarget = { kind: 'main' };
    }
    return context?.mainTarget ? { ...context.mainTarget, label: 'Hauptquest' } : null;
}

export function updateQuestCompass() {
    const compass = document.getElementById('quest-compass');
    const state = getQuestState();
    const context = window.getQuestNavigationContext?.();
    if (!compass || !state || !context?.playerPosition) return;
    const target = trackedTarget(state, context);
    const guidance = getCompassGuidance(context.playerPosition, target);
    if (!guidance) {
        compass.hidden = true;
        return;
    }
    const headingDegrees = getCompassHeadingDegrees(context.cameraYawRadians);
    const relativeBearing = getRelativeCompassBearing(guidance.bearing, headingDegrees);
    const arrow = compass.querySelector('.quest-compass-arrow');
    const label = compass.querySelector('.quest-compass-label');
    const distance = compass.querySelector('.quest-compass-distance');
    if (arrow) arrow.style.transform = `rotate(${relativeBearing}deg)`;
    if (label) label.textContent = `${target.label} · ${guidance.directionName}`;
    if (distance) distance.textContent = guidance.exact
        ? `${guidance.displayDistance} Blöcke`
        : `Suchgebiet in etwa ${guidance.displayDistance} Blöcken`;
    compass.hidden = false;
}

export function initQuestJournal() {
    document.getElementById('inventory-view-tab')?.addEventListener('click', () => showInventoryPanel('inventory'));
    document.getElementById('quest-view-tab')?.addEventListener('click', () => showInventoryPanel('quests'));
    window.showInventoryPanel = showInventoryPanel;
    window.addEventListener('butzcraft:quest-completed', renderQuestJournal);
    window.addEventListener('butzcraft:quest-action', () => {
        if (!document.getElementById('quest-journal')?.hidden) renderQuestJournal();
        updateQuestCompass();
    });
}
