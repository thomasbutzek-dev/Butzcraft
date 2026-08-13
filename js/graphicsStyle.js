import * as THREE from 'three';

function isReducedDetailDevice() {
    if (typeof window === 'undefined') return false;
    return Boolean(navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches);
}

export const graphicsStyle = Object.freeze({
    reducedDetail: isReducedDetailDevice()
});

function applyPainterlyAtmosphere() {
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
        game.renderer.toneMappingExposure = 1.1;

        for (const child of scene.children) {
            if (child.isAmbientLight) {
                child.color.set(0xdde6d7);
                child.intensity = 0.88;
                child.userData.painterlyDayIntensity = 0.88;
                child.userData.painterlyNightIntensity = 0.18;
            } else if (child.isDirectionalLight) {
                child.color.set(0xffdfb0);
            }
        }
    };
    applyWhenReady();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyPainterlyAtmosphere, { once: true });
    else applyPainterlyAtmosphere();
}
