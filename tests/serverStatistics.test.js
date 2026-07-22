// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import statisticsModule from '../serverStatistics.js';

const { createStatisticsStore } = statisticsModule;
const temporaryDirectories = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

function createStore(now = () => new Date('2026-07-22T12:30:00.000Z')) {
    const directory = mkdtempSync(path.join(tmpdir(), 'butzcraft-statistics-'));
    temporaryDirectories.push(directory);
    return createStatisticsStore({ directory, now, flushDelayMs: 60_000 });
}

describe('server statistics', () => {
    it('stores only aggregate counters for Berlin hour and day buckets', () => {
        const store = createStore();

        store.recordResponse({ statusCode: 200, gamePage: true });
        store.recordResponse({ statusCode: 200 });
        store.recordResponse({ statusCode: 404 });
        store.recordResponse({ statusCode: 503 });
        store.flush();

        const persisted = JSON.parse(readFileSync(store.filePath, 'utf8'));
        expect(persisted.hours['2026-07-22T14']).toEqual({
            gamePageRequests: 1,
            totalRequests: 4,
            status2xx: 2,
            status3xx: 0,
            status4xx: 1,
            status5xx: 1
        });
        expect(Object.keys(persisted)).toEqual(['version', 'timeZone', 'hours', 'days']);
        expect(JSON.stringify(persisted)).not.toMatch(/ip|userAgent|referrer|url|events/i);
    });

    it('provides zero-filled 24-hour and 30-day dashboard series', () => {
        const store = createStore();
        store.recordResponse({ statusCode: 200, gamePage: true });
        store.recordResponse({ statusCode: 404 });

        const snapshot = store.snapshot();

        expect(snapshot.totals).toEqual({
            todayGamePageRequests: 1,
            last7DaysGamePageRequests: 1,
            last30DaysGamePageRequests: 1,
            last30DaysErrors: 1
        });
        expect(snapshot.hours).toHaveLength(24);
        expect(snapshot.days).toHaveLength(30);
        expect(snapshot.hours.at(-1)).toMatchObject({ start: '2026-07-22T14', gamePageRequests: 1 });
    });

    it('loads persisted counters after a restart', () => {
        const first = createStore();
        first.recordResponse({ statusCode: 200, gamePage: true });
        first.close();

        const second = createStatisticsStore({
            directory: path.dirname(first.filePath),
            now: () => new Date('2026-07-22T12:30:00.000Z'),
            flushDelayMs: 60_000
        });

        expect(second.snapshot().totals.todayGamePageRequests).toBe(1);
    });

    it('removes expired hour and day buckets when new traffic arrives', () => {
        let current = new Date('2025-01-01T12:00:00.000Z');
        const store = createStore(() => current);
        store.recordResponse({ statusCode: 200, gamePage: true });

        current = new Date('2026-07-22T12:30:00.000Z');
        store.recordResponse({ statusCode: 200, gamePage: true });
        store.flush();

        const persisted = JSON.parse(readFileSync(store.filePath, 'utf8'));
        expect(Object.keys(persisted.hours)).toEqual(['2026-07-22T14']);
        expect(Object.keys(persisted.days)).toEqual(['2026-07-22']);
    });

    it('protects the statistics endpoint with the existing admin session', () => {
        const serverSource = readFileSync('server.js', 'utf8');
        const dockerfile = readFileSync('Dockerfile', 'utf8');
        expect(serverSource).toContain("app.get('/api/admin/statistics', requireSiteAdmin");
        expect(dockerfile).toContain('COPY --chown=node:node server.js serverStatistics.js ./');
    });
});
