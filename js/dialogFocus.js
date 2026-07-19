const FOCUSABLE_SELECTOR = [
    'button:not(:disabled)',
    'input:not(:disabled)',
    'select:not(:disabled)',
    'textarea:not(:disabled)',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

let activeDialog = null;
let previousFocus = null;

function getFocusableElements(dialog) {
    return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter(element => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });
}

function focusElement(element) {
    if (!element || typeof element.focus !== 'function') return;
    element.focus({ preventScroll: true });
}

function handleFocusTrap(event) {
    if (event.key !== 'Tab' || !activeDialog) return;
    if (!activeDialog.isConnected) {
        activeDialog = null;
        previousFocus = null;
        return;
    }

    const focusable = getFocusableElements(activeDialog);
    if (focusable.length === 0) {
        event.preventDefault();
        focusElement(activeDialog);
        return;
    }

    event.preventDefault();
    const currentIndex = focusable.indexOf(document.activeElement);
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = currentIndex === -1
        ? (event.shiftKey ? focusable.length - 1 : 0)
        : (currentIndex + direction + focusable.length) % focusable.length;
    focusElement(focusable[nextIndex]);
}

document.addEventListener('keydown', handleFocusTrap);

export function activateDialog(dialog, initialFocusSelector = '') {
    if (!dialog) return;
    if (activeDialog !== dialog) {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        activeDialog = dialog;
    }
    dialog.setAttribute('aria-hidden', 'false');
    if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;

    queueMicrotask(() => {
        if (activeDialog !== dialog || !dialog.isConnected) return;
        const preferred = initialFocusSelector ? dialog.querySelector(initialFocusSelector) : null;
        focusElement(preferred || getFocusableElements(dialog)[0] || dialog);
    });
}

export function deactivateDialog(dialog) {
    if (!dialog) return;
    dialog.setAttribute('aria-hidden', 'true');
    if (activeDialog !== dialog) return;

    activeDialog = null;
    const restoreTarget = previousFocus;
    previousFocus = null;
    queueMicrotask(() => {
        if (restoreTarget?.isConnected) focusElement(restoreTarget);
    });
}
