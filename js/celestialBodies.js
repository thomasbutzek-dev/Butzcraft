import * as THREE from 'three';

export const CELESTIAL_RADIUS = 340;
export const SUN_SIZE = 66;
export const MOON_SIZE = 62;
export const BLOOD_MOON_SIZE = 200;

const TAU = Math.PI * 2;
const SUN_LIGHT_COLOR = 0xffdfa8;
const MOON_LIGHT_COLOR = 0x91abdc;
const BLOOD_MOON_LIGHT_COLOR = 0xff5963;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export function calculateCelestialState(dayRatio, isBloodMoon, state = {}) {
    const angle = (dayRatio - 0.25) * TAU;
    const sunHeight = Math.sin(angle);
    const sunX = Math.cos(angle) * CELESTIAL_RADIUS;
    const sunY = sunHeight * CELESTIAL_RADIUS;
    const sunZ = Math.sin(angle * 0.35) * 42;
    const daylight = Math.pow(clamp01(sunHeight), 0.65);
    const moonlight = Math.pow(clamp01(-sunHeight), 0.72);
    const bloodMoonActive = Boolean(isBloodMoon && moonlight > 0);

    state.sunX = sunX;
    state.sunY = sunY;
    state.sunZ = sunZ;
    state.moonX = -sunX;
    state.moonY = -sunY;
    state.moonZ = -sunZ;
    state.sunVisible = sunY > -12;
    state.moonVisible = -sunY > -12;
    state.sunSize = SUN_SIZE;
    state.moonSize = bloodMoonActive ? BLOOD_MOON_SIZE : MOON_SIZE;
    state.sunLightIntensity = daylight * 1.1;
    state.moonLightIntensity = moonlight * (bloodMoonActive ? 0.55 : 0.2);
    state.moonLightColor = bloodMoonActive ? BLOOD_MOON_LIGHT_COLOR : MOON_LIGHT_COLOR;
    state.bloodMoonActive = bloodMoonActive;
    return state;
}

function createCanvas(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
}

function finishTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function createSunTexture() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const center = canvas.width / 2;
    const glow = ctx.createRadialGradient(center, center, 28, center, center, 124);
    glow.addColorStop(0, 'rgba(255,255,224,1)');
    glow.addColorStop(0.48, 'rgba(255,232,92,1)');
    glow.addColorStop(0.76, 'rgba(255,166,35,.92)');
    glow.addColorStop(1, 'rgba(255,128,16,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, 82, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 28; i++) {
        const angle = i * 2.399;
        const radius = 10 + (i * 19) % 66;
        const size = 3 + (i % 5);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,126,18,.18)' : 'rgba(255,255,210,.17)';
        ctx.beginPath();
        ctx.arc(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius, size, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
    return finishTexture(canvas);
}

function createMoonTexture(bloodMoon = false) {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const center = canvas.width / 2;

    if (bloodMoon) {
        const glow = ctx.createRadialGradient(center, center, 48, center, center, 128);
        glow.addColorStop(0, 'rgba(255,255,250,1)');
        glow.addColorStop(0.5, 'rgba(255,238,235,.98)');
        glow.addColorStop(0.64, 'rgba(255,82,113,.82)');
        glow.addColorStop(0.82, 'rgba(255,48,82,.3)');
        glow.addColorStop(1, 'rgba(255,25,55,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const radius = 78;
        const base = ctx.createRadialGradient(104, 92, 8, center, center, radius);
        base.addColorStop(0, '#fffef2');
        base.addColorStop(0.7, '#fff8f2');
        base.addColorStop(1, '#ffd8da');
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, TAU);
        ctx.fillStyle = base;
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius - 2, 0, TAU);
        ctx.clip();

        const patches = [
            [-48, -36, 24, 15], [-17, -48, 18, 25], [20, -42, 28, 17],
            [-55, -4, 20, 27], [-22, -9, 31, 19], [25, -5, 20, 31],
            [-42, 30, 28, 19], [-5, 24, 17, 28], [27, 29, 30, 18]
        ];
        ctx.fillStyle = 'rgba(170,184,184,.16)';
        for (const [x, y, width, height] of patches) {
            ctx.fillRect(center + x, center + y, width, height);
        }
        ctx.fillStyle = 'rgba(255,126,142,.1)';
        ctx.beginPath();
        ctx.arc(center - 32, center + 11, 17, 0, TAU);
        ctx.arc(center + 23, center - 22, 14, 0, TAU);
        ctx.fill();
        ctx.restore();
        return finishTexture(canvas);
    }

    const radius = 104;
    const base = ctx.createRadialGradient(92, 82, 16, center, center, radius);
    base.addColorStop(0, '#fff9df');
    base.addColorStop(0.58, '#cbd2d6');
    base.addColorStop(1, '#6f7b85');
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, TAU);
    ctx.fillStyle = base;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius - 2, 0, TAU);
    ctx.clip();

    for (let i = 0; i < 24; i++) {
        const angle = i * 2.17;
        const distance = 18 + (i * 31) % 72;
        const craterRadius = 5 + (i * 7) % 15;
        const x = center + Math.cos(angle) * distance;
        const y = center + Math.sin(angle) * distance;
        const crater = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, craterRadius);
        crater.addColorStop(0, 'rgba(255,255,245,.28)');
        crater.addColorStop(0.55, 'rgba(70,82,92,.28)');
        crater.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = crater;
        ctx.beginPath();
        ctx.arc(x, y, craterRadius, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
    return finishTexture(canvas);
}

export function createCelestialSystem(scene) {
    const sunTexture = createSunTexture();
    const moonTexture = createMoonTexture(false);
    const bloodMoonTexture = createMoonTexture(true);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sunTexture,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false
    }));
    const moonMaterial = new THREE.SpriteMaterial({
        map: moonTexture,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false
    });
    const moonSprite = new THREE.Sprite(moonMaterial);
    const sunLight = new THREE.DirectionalLight(SUN_LIGHT_COLOR, 0);
    const moonLight = new THREE.DirectionalLight(MOON_LIGHT_COLOR, 0);

    sunSprite.renderOrder = -1;
    moonSprite.renderOrder = -1;
    scene.add(sunSprite, moonSprite, sunLight, sunLight.target, moonLight, moonLight.target);
    return { sunSprite, moonSprite, sunLight, moonLight, moonTexture, bloodMoonTexture, state: {} };
}

export function updateCelestialSystem(system, cameraPosition, dayRatio, isBloodMoon, weatherMultiplier = 1, skyVisible = true) {
    const state = calculateCelestialState(dayRatio, isBloodMoon, system.state);
    const weatherLight = Math.max(0.2, weatherMultiplier);
    system.sunSprite.position.set(cameraPosition.x + state.sunX, cameraPosition.y + state.sunY, cameraPosition.z + state.sunZ);
    system.moonSprite.position.set(cameraPosition.x + state.moonX, cameraPosition.y + state.moonY, cameraPosition.z + state.moonZ);
    system.sunSprite.scale.setScalar(state.sunSize);
    system.moonSprite.scale.setScalar(state.moonSize);
    system.sunSprite.visible = skyVisible && state.sunVisible;
    system.moonSprite.visible = skyVisible && state.moonVisible;
    const moonMap = state.bloodMoonActive ? system.bloodMoonTexture : system.moonTexture;
    if (system.moonSprite.material.map !== moonMap) {
        system.moonSprite.material.map = moonMap;
        system.moonSprite.material.needsUpdate = true;
    }

    const lightDistance = 90 / CELESTIAL_RADIUS;
    system.sunLight.position.set(cameraPosition.x + state.sunX * lightDistance, cameraPosition.y + state.sunY * lightDistance, cameraPosition.z + state.sunZ * lightDistance);
    system.moonLight.position.set(cameraPosition.x + state.moonX * lightDistance, cameraPosition.y + state.moonY * lightDistance, cameraPosition.z + state.moonZ * lightDistance);
    system.sunLight.target.position.copy(cameraPosition);
    system.moonLight.target.position.copy(cameraPosition);
    system.sunLight.intensity = state.sunLightIntensity * weatherLight;
    system.moonLight.intensity = state.moonLightIntensity * weatherLight;
    system.moonLight.color.setHex(state.moonLightColor);
    return state;
}
