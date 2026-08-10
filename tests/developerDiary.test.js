import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';
import { DEVELOPER_DIARY_ENTRIES, initializeDeveloperDiary } from '../js/developerDiary.js';

describe('developer diary releases', () => {
    it('starts at 0.2.0 and requires an entry for the current app version', () => {
        expect(DEVELOPER_DIARY_ENTRIES[0].version).toBe('0.2.0');
        expect(DEVELOPER_DIARY_ENTRIES.at(-1).version).toBe(APP_VERSION);
        expect(new Set(DEVELOPER_DIARY_ENTRIES.map(entry => entry.version)).size).toBe(DEVELOPER_DIARY_ENTRIES.length);
    });

    it('keeps every chapter complete and in ascending version order', () => {
        const versions = DEVELOPER_DIARY_ENTRIES.map(entry => entry.version);
        const sortedVersions = [...versions].sort((left, right) => (
            left.localeCompare(right, undefined, { numeric: true })
        ));

        expect(versions).toEqual(sortedVersions);
        for (const entry of DEVELOPER_DIARY_ENTRIES) {
            expect(entry.title).toBeTruthy();
            expect(entry.summary).toBeTruthy();
            expect(entry.changes.length).toBeGreaterThanOrEqual(5);
        }
    });

    it('keeps the diary on the page without adding it to the main menu', () => {
        const html = readFileSync('butzcraft-preview.html', 'utf8');
        const page = new DOMParser().parseFromString(html, 'text/html');

        expect(page.querySelector('#tagebuch')).not.toBeNull();
        expect(page.querySelector('.site-nav a[href="#tagebuch"]')).toBeNull();
    });

    it('renders the current chapter and lets readers turn back a page', () => {
        const html = readFileSync('butzcraft-preview.html', 'utf8');
        const page = new DOMParser().parseFromString(html, 'text/html');
        const diary = page.querySelector('[data-developer-diary]');
        document.body.append(diary);

        initializeDeveloperDiary(diary);
        expect(diary.querySelector('.diary-version').textContent).toContain(APP_VERSION);
        expect(diary.querySelector('[data-diary-position]').textContent)
            .toBe(`Seite ${DEVELOPER_DIARY_ENTRIES.length} von ${DEVELOPER_DIARY_ENTRIES.length}`);

        diary.querySelector('[data-diary-previous]').click();
        expect(diary.querySelector('.diary-version').textContent).toContain('0.2.2');
        expect(diary.querySelector('[data-diary-next]').disabled).toBe(false);
    });
});
