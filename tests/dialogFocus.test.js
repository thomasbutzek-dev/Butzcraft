import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { activateDialog, deactivateDialog } from '../js/dialogFocus.js';

describe('dialog focus management', () => {
    let dialog;
    let trigger;

    beforeEach(() => {
        document.body.innerHTML = `
            <button id="trigger">Öffnen</button>
            <div id="dialog" role="dialog" aria-hidden="true">
                <button id="first">Erste Aktion</button>
                <button id="middle">Zweite Aktion</button>
                <button id="last">Schließen</button>
            </div>
        `;
        trigger = document.getElementById('trigger');
        dialog = document.getElementById('dialog');
        trigger.focus();
    });

    afterEach(() => {
        deactivateDialog(dialog);
        document.body.innerHTML = '';
    });

    it('focuses the requested control and restores the previous focus', async () => {
        activateDialog(dialog, '#last');
        await Promise.resolve();

        expect(dialog.getAttribute('aria-hidden')).toBe('false');
        expect(document.activeElement).toBe(document.getElementById('last'));

        deactivateDialog(dialog);
        await Promise.resolve();

        expect(dialog.getAttribute('aria-hidden')).toBe('true');
        expect(document.activeElement).toBe(trigger);
    });

    it('wraps tab focus inside the active dialog', async () => {
        activateDialog(dialog, '#last');
        await Promise.resolve();

        document.getElementById('last').dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true
        }));
        expect(document.activeElement).toBe(document.getElementById('first'));

        document.getElementById('first').dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true
        }));
        expect(document.activeElement).toBe(document.getElementById('middle'));

        document.getElementById('middle').dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true,
            cancelable: true
        }));
        expect(document.activeElement).toBe(document.getElementById('first'));

        document.getElementById('first').dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true,
            cancelable: true
        }));
        expect(document.activeElement).toBe(document.getElementById('last'));
    });
});
