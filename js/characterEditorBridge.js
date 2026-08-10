export function openCharacterEditor({ overlay, frame, profile, origin, activateDialog }) {
    overlay.classList.add('open');
    activateDialog(overlay, '#character-editor-close');
    frame.contentWindow?.postMessage({ type: 'load-profile', profile }, origin);
}
