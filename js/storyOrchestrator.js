import { resolveRitualSite } from './questNavigation.js?v=20260731a';
import { grantQuestItem } from './quests.js?v=20260730a';
import { getStoryProgress, reconcileStoryProgress, recordStoryMilestone, STORY_EVENTS } from './storyProgress.js?v=20260730c';

export function reconcileStoryState({
    questState,
    storyObjectiveIndex = questState?.mainQuestIndex || 0,
    context = {}
}) {
    const timedProgress = getStoryProgress(storyObjectiveIndex, context);
    const reconciledIndex = reconcileStoryProgress(timedProgress.index, questState?.storyMilestones);
    const progress = reconciledIndex === timedProgress.index
        ? timedProgress
        : getStoryProgress(reconciledIndex, context);
    if (questState) questState.mainQuestIndex = progress.index;
    return progress;
}

export function applyStoryEvent({
    questState,
    storyObjectiveIndex = questState?.mainQuestIndex || 0,
    eventName,
    detail = {},
    context = {},
    structures
}) {
    if (eventName === STORY_EVENTS.MINE_COMPLETED) {
        grantQuestItem(questState, 'deepCrystal');
    }
    if (eventName === STORY_EVENTS.DUNGEON_COMPLETED) {
        grantQuestItem(questState, 'bloodSeal');
        const ritualSite = resolveRitualSite({
            structureId: detail.structureId,
            position: detail.position
        }, structures);
        if (ritualSite) {
            if (!questState.storyFlags || typeof questState.storyFlags !== 'object') questState.storyFlags = {};
            questState.storyFlags.ritualSite = ritualSite;
        }
    }
    if (eventName === STORY_EVENTS.BOSS_DEFEATED) {
        if (!questState.storyFlags || typeof questState.storyFlags !== 'object') questState.storyFlags = {};
        questState.storyFlags.bossDefeated = true;
    }

    questState.storyMilestones = recordStoryMilestone(questState.storyMilestones, eventName);
    return reconcileStoryState({ questState, storyObjectiveIndex, context });
}
