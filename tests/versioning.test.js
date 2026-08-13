import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';

describe('release versioning', () => {
    it('keeps the package and visible application version aligned', () => {
        const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
        const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

        expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        expect(packageJson.version).toBe(APP_VERSION);
        expect(packageLock.version).toBe(APP_VERSION);
        expect(packageLock.packages[''].version).toBe(APP_VERSION);
    });

    it('shows the current version in the game and every public site footer', () => {
        const pages = ['index.html', 'butzcraft-preview.html', 'guide.html', 'faq.html', 'impressum.html', 'datenschutz.html'];

        for (const page of pages) {
            const document = new DOMParser().parseFromString(readFileSync(page, 'utf8'), 'text/html');
            expect(document.querySelector('[data-app-version]')?.textContent).toBe(APP_VERSION);
        }
    });

    it('builds immutable version images from release tags', () => {
        const workflow = readFileSync('.github/workflows/container-image.yml', 'utf8');

        expect(workflow).toContain('"v*.*.*"');
        expect(workflow).toContain('type=semver,pattern={{version}}');
        expect(workflow).toContain("type=raw,value=stable,enable=${{ startsWith(github.ref, 'refs/tags/v') }}");
    });
});
