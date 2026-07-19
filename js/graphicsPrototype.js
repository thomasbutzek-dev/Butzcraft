// PROTOTYPE — throwaway forest graphics comparison, selected via ?graphicsPrototype=A|B|C.
import * as THREE from 'three';

const PARAM = 'graphicsPrototype';
const VARIANTS = Object.freeze({
    A: 'Original',
    B: 'Painterly textures',
    C: 'Painterly hybrid'
});

function readVariant() {
    if (typeof window === 'undefined') return 'B';
    const requested = new URLSearchParams(window.location.search).get(PARAM)?.toUpperCase();
    return Object.hasOwn(VARIANTS, requested) ? requested : 'B';
}

function isReducedDetailDevice() {
    if (typeof window === 'undefined') return false;
    return Boolean(navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
}

const variant = readVariant();

export const graphicsPrototype = Object.freeze({
    enabled: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(PARAM),
    variant,
    usesPainterlyTextures: variant === 'B' || variant === 'C',
    usesHybridGeometry: variant === 'C',
    reducedDetail: isReducedDetailDevice()
});

function selectVariant(nextVariant) {
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, nextVariant);
    window.location.assign(url);
}

function showVariantNotice() {
    if (!graphicsPrototype.enabled) return;
    document.getElementById('graphics-variant-notice')?.remove();
    const notice = document.createElement('div');
    notice.id = 'graphics-variant-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.textContent = `Grafikversion ${graphicsPrototype.variant} — ${VARIANTS[graphicsPrototype.variant]}`;
    notice.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:25000;padding:14px 24px;border:2px solid #ffe066;border-radius:12px;background:rgba(24,28,22,.94);box-shadow:0 10px 32px rgba(0,0,0,.5);color:#fff6cf;font:800 18px/1.2 Segoe UI,sans-serif;letter-spacing:.3px;pointer-events:none;opacity:1;transition:opacity .35s ease';
    document.body.appendChild(notice);
    window.setTimeout(() => { notice.style.opacity = '0'; }, 2200);
    window.setTimeout(() => notice.remove(), 2600);
}

function applyPainterlyAtmosphere() {
    if (!graphicsPrototype.usesPainterlyTextures) return;

    let attempts = 0;
    const applyWhenReady = () => {
        const game = window.Game;
        const scene = game?.world?.scene;
        if (!game?.renderer || !scene) {
            if (attempts++ < 600) requestAnimationFrame(applyWhenReady);
            return;
        }

        game.renderer.outputColorSpace = THREE.SRGBColorSpace;
        game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        game.renderer.toneMappingExposure = graphicsPrototype.usesHybridGeometry ? 1.08 : 1.1;

        for (const child of scene.children) {
            if (child.isAmbientLight) {
                child.color.set(graphicsPrototype.usesHybridGeometry ? 0xc7d5c4 : 0xdde6d7);
                child.intensity = graphicsPrototype.usesHybridGeometry ? 0.48 : 0.88;
                if (!graphicsPrototype.usesHybridGeometry) {
                    child.userData.painterlyDayIntensity = 0.88;
                    child.userData.painterlyNightIntensity = 0.18;
                }
            } else if (child.isDirectionalLight) {
                child.color.set(graphicsPrototype.usesHybridGeometry ? 0xffe0ad : 0xffdfb0);
            }
        }
    };
    applyWhenReady();
}

function initPrototypeControls() {
    applyPainterlyAtmosphere();
    showVariantNotice();
    const keys = Object.keys(VARIANTS);
    window.addEventListener('keydown', (event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
        if (event.code !== 'KeyG' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.cancelable) event.preventDefault();
        const current = keys.indexOf(graphicsPrototype.variant);
        selectVariant(keys[(current + 1) % keys.length]);
    });
}

if (typeof document !== 'undefined') {
    document.documentElement.dataset.graphicsVariant = graphicsPrototype.variant;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPrototypeControls, { once: true });
    else initPrototypeControls();
}
