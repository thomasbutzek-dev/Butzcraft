// @vitest-environment node
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config.js';

describe('production engine diagnostics', () => {
    it('instruments the generated main entry asset', () => {
        const plugin = viteConfig.plugins.find(candidate => candidate.name === 'butzcraft-engine-script-diagnostics');
        const html = '<script type="module" crossorigin src="./assets/main-example.js"></script>';

        const transformed = plugin.transformIndexHtml(html);

        expect(transformed).toContain('window.__butzcraftEngineAssetLoaded=true');
        expect(transformed).toContain('window.__butzcraftShowStartError');
    });
});
