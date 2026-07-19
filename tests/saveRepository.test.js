import { describe, expect, it, vi } from 'vitest';
import { SaveRepository } from '../js/saveRepository.js';

function createRepository(overrides = {}) {
    const browserStore = {
        list: vi.fn().mockResolvedValue(['Browser World']),
        load: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
        ...overrides.browserStore
    };
    const fetchJson = vi.fn().mockResolvedValue([]);
    const warn = vi.fn();
    const repository = new SaveRepository({
        browserStore,
        fetchJson: overrides.fetchJson || fetchJson,
        warn
    });
    return { repository, browserStore, fetchJson, warn };
}

describe('SaveRepository', () => {
    it('merges browser and legacy server save names without duplicates', async () => {
        const fetchJson = vi.fn().mockResolvedValue(['Server World', 'Browser World']);
        const { repository } = createRepository({ fetchJson });

        await expect(repository.list()).resolves.toEqual(['Browser World', 'Server World']);
        expect(fetchJson).toHaveBeenCalledWith('api/saves');
    });

    it('returns the browser save without requesting the server fallback', async () => {
        const gameData = { time: 42 };
        const { repository, fetchJson } = createRepository({
            browserStore: { load: vi.fn().mockResolvedValue(gameData) }
        });

        await expect(repository.load('World 1')).resolves.toBe(gameData);
        expect(fetchJson).not.toHaveBeenCalled();
    });

    it('falls back to the legacy server when browser storage is unavailable', async () => {
        const fetchJson = vi.fn().mockResolvedValue({ time: 99 });
        const { repository, warn } = createRepository({
            browserStore: { load: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')) },
            fetchJson
        });

        await expect(repository.load('World 1')).resolves.toEqual({ time: 99 });
        expect(fetchJson).toHaveBeenCalledWith('api/load?name=World%201');
        expect(warn).toHaveBeenCalledOnce();
    });

    it('routes writes through the browser store', async () => {
        const { repository, browserStore } = createRepository();
        const gameData = { time: 7 };

        await repository.save('World 1', gameData);

        expect(browserStore.save).toHaveBeenCalledWith('World 1', gameData);
    });
});
