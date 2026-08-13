import { describe, expect, it, vi } from 'vitest';
import { openCharacterEditor } from '../js/characterEditorBridge.js';

describe('character editor bridge', () => {
    it('loads the active profile when the editor-ready signal arrived before the parent listener', () => {
        const postMessage = vi.fn();
        const overlay = { classList: { add: vi.fn() } };
        const frame = { dataset: {}, contentWindow: { postMessage } };
        const profile = { displayName: 'Transfer' };
        const activateDialog = vi.fn();

        openCharacterEditor({
            overlay,
            frame,
            profile,
            origin: 'http://127.0.0.1:5175',
            activateDialog
        });

        expect(overlay.classList.add).toHaveBeenCalledWith('open');
        expect(activateDialog).toHaveBeenCalledWith(overlay, '#character-editor-close');
        expect(postMessage).toHaveBeenCalledWith(
            { type: 'load-profile', profile },
            'http://127.0.0.1:5175'
        );
    });
});
