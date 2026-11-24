import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function loadPage(file) {
    return new DOMParser().parseFromString(readFileSync(file, 'utf8'), 'text/html');
}

describe('landing page', () => {
    const page = loadPage('butzcraft-preview.html');

    it('keeps the heavy media off the first load', () => {
        // The scroll flight is fetched by script on wide screens only, the 3D editor on click.
        expect(page.querySelector('[data-hero-video]').getAttribute('preload')).toBe('none');
        const editor = page.getElementById('landing-character-editor');
        expect(editor.hasAttribute('src')).toBe(false);
        expect(editor.dataset.src).toContain('character-editor.html');
        expect(page.querySelector('[data-open-editor]')).not.toBeNull();
    });

    it('serves world-card images in fitting sizes with real descriptions', () => {
        for (const image of page.querySelectorAll('.world-card img')) {
            expect(image.alt, image.getAttribute('src')).not.toMatch(/Platzhalter/);
            expect(image.getAttribute('loading')).toBe('lazy');
        }
        const responsive = [...page.querySelectorAll('.world-card img[srcset]')];
        expect(responsive.length).toBeGreaterThanOrEqual(4);
        for (const image of responsive) {
            expect(image.getAttribute('sizes')).toBeTruthy();
            for (const candidate of image.getAttribute('srcset').split(',')) {
                expect(existsSync(candidate.trim().split(' ')[0]), candidate).toBe(true);
            }
        }
    });

    it('describes itself for search engines and link previews', () => {
        expect(page.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://butzcraft.de/');
        expect(page.querySelector('meta[property="og:image"]').content).toBe('https://butzcraft.de/og-image.jpg');
        expect(page.querySelector('meta[name="twitter:card"]').content).toBe('summary_large_image');
        expect(page.querySelector('link[rel="manifest"]')).not.toBeNull();
        const data = JSON.parse(page.querySelector('script[type="application/ld+json"]').textContent);
        expect(data['@type']).toBe('VideoGame');
        for (const file of ['og-image.jpg', 'site.webmanifest', 'robots.txt', 'sitemap.xml', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
            expect(existsSync(`public/${file}`), file).toBe(true);
        }
    });

    it('gives every site page a canonical address and the sharp logo', () => {
        for (const [file, path] of [['guide.html', '/guide'], ['faq.html', '/faq'], ['impressum.html', '/impressum'], ['datenschutz.html', '/datenschutz']]) {
            const subpage = loadPage(file);
            expect(subpage.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(`https://butzcraft.de${path}`);
            expect(subpage.querySelector('.brand img').getAttribute('src')).toContain('logo-320.webp');
        }
    });
});
