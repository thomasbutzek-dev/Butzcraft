import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    DEFAULT_CHARACTER_PROFILE,
    createCharacterProfile,
    normalizeCharacterProfile,
    parseCharacterProfile,
    serializeCharacterProfile
} from './characterProfile.js';
import { createCharacterModel } from './characterModel.js?v=20260717a';
import {
    CHARACTER_TRANSFER_STORAGE_KEY,
    createCharacterPlayUrl,
    getCharacterPlayTarget
} from './characterTransfer.js';

const isEmbedded = new URLSearchParams(window.location.search).get('embed') === '1' || window.parent !== window;
document.documentElement.classList.toggle('embedded', isEmbedded);

const preview = document.getElementById('character-preview');
const form = document.getElementById('character-form');
const jsonOutput = document.getElementById('profile-json');
const statusLine = document.getElementById('status-line');
const displayName = document.getElementById('display-name');
const importFile = document.getElementById('import-file');
const playWithCharacterButton = document.getElementById('play-with-character-button');

let profile = createCharacterProfile();
let loadedProfile = createCharacterProfile();
let characterGroup;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 1.9, 6.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
preview.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.2;
controls.maxDistance = 7;
controls.target.set(0, 1.25, 0);

scene.add(new THREE.HemisphereLight(0xf7f2df, 0x4d5b5f, 1.7));

const keyLight = new THREE.DirectionalLight(0xfff1cf, 2.4);
keyLight.position.set(3, 5, 4);
keyLight.castShadow = true;
scene.add(keyLight);

const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 36),
    new THREE.MeshStandardMaterial({ color: 0x2b332e, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

applyProfile(profile);
resizePreview();
window.addEventListener('resize', () => {
    resizePreview();
    reportEmbeddedHeight();
});

form.addEventListener('input', () => {
    const previousGender = profile.gender;
    profile = normalizeCharacterProfile(readFormProfile());
    applyGenderDefaults(profile, previousGender);
    updateProfile({ persist: false, message: '' });
});

document.getElementById('save-button').addEventListener('click', () => {
    applyDraft();
});

playWithCharacterButton.hidden = isEmbedded;
playWithCharacterButton.addEventListener('click', () => {
    profile = normalizeCharacterProfile(readFormProfile());
    localStorage.setItem(CHARACTER_TRANSFER_STORAGE_KEY, serializeCharacterProfile(profile));
    window.location.assign(createCharacterPlayUrl(profile, getCharacterPlayTarget()));
});

document.getElementById('export-button').addEventListener('click', async () => {
    await navigator.clipboard.writeText(serializeCharacterProfile(profile));
    setStatus('Profil-JSON in die Zwischenablage kopiert.');
});

document.getElementById('randomize-button').addEventListener('click', () => {
    profile = createCharacterProfile({
        ...profile,
        gender: pick(['male', 'female']),
        bodyType: pick(['classic', 'slim', 'sturdy']),
        hairStyle: pick(['short', 'flat', 'mohawk', 'curly', 'long', 'ponytail', 'cap', 'none']),
        accessory: pick(['none', 'cape', 'pack']),
        textures: {
            skinDetail: pick(['soft', 'freckles', 'scar', 'sunmark']),
            fabric: pick(['plain', 'woven', 'leather', 'iron']),
            outfitPattern: pick(['none', 'trim', 'stripes', 'checker', 'panel'])
        },
        colors: {
            skin: pick(['#c98f64', '#8f6048', '#e0ad82', '#6d4a37']),
            hair: pick(['#2f2219', '#6a3d24', '#d6b16d', '#1f1f1f']),
            eyes: pick(['#4aa3df', '#5fc27a', '#8b6ad9', '#3b2f2f']),
            shirt: pick(['#3f8f5f', '#b24b3f', '#d4a94f', '#6c78c9']),
            pants: pick(['#2f5f9f', '#514438', '#375b4a', '#2d3438']),
            boots: pick(['#2b2420', '#3b3028', '#1d1f20']),
            accent: pick(['#d4a94f', '#d9e0e4', '#9f4f3f', '#61b6a0'])
        }
    });
    applyProfile(profile);
    updateProfile({ persist: false, message: 'Zufälliger Look erstellt.' });
});

document.getElementById('reset-button').addEventListener('click', () => {
    profile = createCharacterProfile(DEFAULT_CHARACTER_PROFILE);
    applyProfile(profile);
    updateProfile({ persist: false, message: 'Profil zurückgesetzt.' });
});

importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;

    try {
        profile = parseCharacterProfile(await file.text());
        applyProfile(profile);
        updateProfile({ persist: false, message: 'Profil importiert.' });
    } catch {
        setStatus('Import fehlgeschlagen: keine gültige Profil-Datei.');
    } finally {
        importFile.value = '';
    }
});

renderer.setAnimationLoop(() => {
    if (characterGroup) characterGroup.rotation.y += 0.003;
    controls.update();
    renderer.render(scene, camera);
});

window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === 'load-profile') {
        loadedProfile = normalizeCharacterProfile(event.data.profile);
        profile = normalizeCharacterProfile(loadedProfile);
        applyProfile(profile);
        setStatus('Profil geladen.');
    }
    if (event.data.type === 'apply-profile') applyDraft();
    if (event.data.type === 'cancel') {
        profile = normalizeCharacterProfile(loadedProfile);
        applyProfile(profile);
        setStatus('Änderungen verworfen.');
    }
});

if (isEmbedded) {
    window.parent.postMessage({ type: 'editor-ready' }, window.location.origin);
    const editorShell = document.querySelector('.editor-shell');
    new ResizeObserver(reportEmbeddedHeight).observe(editorShell);
    requestAnimationFrame(reportEmbeddedHeight);
}

function applyDraft() {
    profile = normalizeCharacterProfile(readFormProfile());
    if (isEmbedded) {
        window.parent.postMessage({ type: 'apply-profile', profile }, window.location.origin);
        setStatus('Profil übernommen.');
        return;
    }
    localStorage.setItem(CHARACTER_TRANSFER_STORAGE_KEY, serializeCharacterProfile(profile));
    setStatus('Profil lokal gespeichert.');
}

function applyProfile(nextProfile) {
    displayName.value = nextProfile.displayName;
    form.elements.gender.value = nextProfile.gender;
    form.elements.bodyType.value = nextProfile.bodyType;
    form.elements.hairStyle.value = nextProfile.hairStyle;
    form.elements.accessory.value = nextProfile.accessory;
    form.elements.skinDetail.value = nextProfile.textures.skinDetail;
    form.elements.fabric.value = nextProfile.textures.fabric;
    form.elements.outfitPattern.value = nextProfile.textures.outfitPattern;

    for (const [key, value] of Object.entries(nextProfile.colors)) {
        form.elements[key].value = value;
    }

    updateProfile({ persist: false, message: '' });
}

function updateProfile({ persist, message }) {
    rebuildCharacter(profile);
    jsonOutput.value = serializeCharacterProfile(profile);
    if (message) setStatus(message);
}

function readFormProfile() {
    return {
        ...profile,
        displayName: displayName.value,
        gender: form.elements.gender.value,
        bodyType: form.elements.bodyType.value,
        hairStyle: form.elements.hairStyle.value,
        accessory: form.elements.accessory.value,
        colors: {
            skin: form.elements.skin.value,
            hair: form.elements.hair.value,
            eyes: form.elements.eyes.value,
            shirt: form.elements.shirt.value,
            pants: form.elements.pants.value,
            boots: form.elements.boots.value,
            accent: form.elements.accent.value
        },
        textures: {
            skinDetail: form.elements.skinDetail.value,
            fabric: form.elements.fabric.value,
            outfitPattern: form.elements.outfitPattern.value
        }
    };
}

function rebuildCharacter(nextProfile) {
    if (characterGroup) {
        scene.remove(characterGroup);
        disposeCharacter(characterGroup);
    }
    characterGroup = createCharacterModel(nextProfile);
    scene.add(characterGroup);
}

function disposeCharacter(character) {
    character.traverse((child) => {
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
            material?.map?.dispose?.();
            material?.dispose?.();
        }
    });
}

function applyGenderDefaults(nextProfile, previousGender) {
    if (previousGender === nextProfile.gender) return;

    if (nextProfile.gender === 'female' && ['short', 'flat'].includes(nextProfile.hairStyle)) {
        nextProfile.hairStyle = 'long';
        form.elements.hairStyle.value = nextProfile.hairStyle;
    }

    if (nextProfile.gender === 'male' && ['long', 'ponytail'].includes(nextProfile.hairStyle)) {
        nextProfile.hairStyle = 'short';
        form.elements.hairStyle.value = nextProfile.hairStyle;
    }
}

function resizePreview() {
    const width = preview.clientWidth || 1;
    const height = preview.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}

function setStatus(message) {
    statusLine.textContent = message;
    reportEmbeddedHeight();
}

function reportEmbeddedHeight() {
    if (!isEmbedded) return;
    const editorShell = document.querySelector('.editor-shell');
    const height = Math.ceil(editorShell?.getBoundingClientRect().height || document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'editor-height', height }, window.location.origin);
}

function pick(values) {
    return values[Math.floor(Math.random() * values.length)];
}
