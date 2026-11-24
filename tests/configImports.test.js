import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('config module imports', () => {
    it('imports config.js with one specifier so every module shares the same CONFIG object', () => {
        // Different ?v= queries load separate module instances: a render distance chosen in
        // the menu then never reached the world, which read its own copy of CONFIG.
        const specifiers = new Set();
        for (const file of readdirSync('js').filter(name => name.endsWith('.js'))) {
            const source = readFileSync(`js/${file}`, 'utf8');
            for (const match of source.matchAll(/from\s+'([^']*config\.js[^']*)'/g)) specifiers.add(match[1]);
        }
        expect([...specifiers]).toHaveLength(1);
    });
});
