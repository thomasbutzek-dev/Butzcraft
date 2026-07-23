import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { graphicsPrototype } from './graphicsPrototype.js?v=20260718c';

let textureSerial = 0;

export function createCharacterModel(profile, options = {}) {
    const characterGroup = new THREE.Group();
    characterGroup.name = 'characterRoot';
    characterGroup.userData.outlines = options.outlines !== false;
    const bodyRoot = new THREE.Group();
    bodyRoot.name = 'bodyRoot';
    characterGroup.add(bodyRoot);
    const shape = getBodyShape(profile.gender, profile.bodyType);
    const scaleX = shape.torsoWidth / 0.95;
    const colors = profile.colors;
    const textures = profile.textures;
    const skin = makeMaterial(colors.skin, { kind: 'skin', detail: textures.skinDetail });
    const hair = makeMaterial(colors.hair, { kind: 'hair', detail: 'grain' });
    const shirt = makeMaterial(colors.shirt, { kind: 'fabric', detail: textures.fabric, pattern: textures.outfitPattern, accent: colors.accent });
    const pants = makeMaterial(colors.pants, { kind: 'fabric', detail: textures.fabric, pattern: textures.outfitPattern, accent: colors.accent });
    const boots = makeMaterial(colors.boots, { kind: 'fabric', detail: 'leather', pattern: 'trim', accent: colors.accent });
    const accent = makeMaterial(colors.accent, { kind: 'fabric', detail: 'plain' });

    const torso = createPivot(bodyRoot, 'torso', [0, 0.92, 0]);
    const headPivot = createPivot(torso, 'headPivot', [0, 0.86, 0]);
    const leftArmPivot = createPivot(torso, 'leftArmPivot', [-shape.armX, 0.86, 0]);
    const rightArmPivot = createPivot(torso, 'rightArmPivot', [shape.armX, 0.86, 0]);
    const leftLegPivot = createPivot(bodyRoot, 'leftLegPivot', [-shape.legX, 0.92, 0]);
    const rightLegPivot = createPivot(bodyRoot, 'rightLegPivot', [shape.legX, 0.92, 0]);

    addBox(headPivot, [0, 0.36, 0], [0.8 * shape.headScale, 0.76, 0.74 * shape.headScale], skin, { name: 'head' });
    addBox(torso, [0, 0.88, 0], [0.25, 0.2, 0.24], skin, { name: 'neck' });
    addTorso(torso, shape, shirt, pants, accent);
    addArm(leftArmPivot, shape, shirt, skin, accent);
    addArm(rightArmPivot, shape, shirt, skin, accent);
    addLeg(leftLegPivot, shape, pants, boots);
    addLeg(rightLegPivot, shape, pants, boots);

    addOutfitLayers(torso, scaleX, colors, textures, accent);
    addFace(headPivot, colors, hair);
    addFaceDetail(headPivot, textures.skinDetail, colors);
    const ponytailPivot = addHair(headPivot, profile.hairStyle, profile.gender, hair, colors);
    const accessoryPivots = addAccessory({ torso, headPivot }, profile.accessory, colors, accent);

    const rig = {
        characterRoot: characterGroup,
        bodyRoot,
        torso,
        headPivot,
        leftArmPivot,
        rightArmPivot,
        leftLegPivot,
        rightLegPivot,
        ponytailPivot,
        capePivot: accessoryPivots.capePivot,
        scarfPivot: accessoryPivots.scarfPivot
    };
    characterGroup.rig = rig;
    characterGroup.userData.rig = rig;

    characterGroup.position.y = options.positionY ?? 0.08;
    characterGroup.scale.setScalar(options.scale ?? 0.72);
    return characterGroup;
}

function createPivot(parent, name, position) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(position[0], position[1], position[2]);
    parent.add(pivot);
    return pivot;
}

function addLeg(parent, shape, pants, boots) {
    addBox(parent, [0, -0.35, 0], [shape.legWidth, 0.7, 0.35], pants, { name: 'trouserLeg' });
    addBox(parent, [0, -0.76, 0.025], [shape.legWidth + 0.035, 0.24, 0.38], boots, { name: 'bootShaft' });
    addBox(parent, [0, -0.9, 0.08], [shape.legWidth + 0.06, 0.16, 0.5], boots, { name: 'boot' });
}

function addArm(parent, shape, shirt, skin, accent) {
    addBox(parent, [0, -0.17, 0], [shape.armWidth + 0.06, 0.34, 0.37], shirt, { name: 'sleeve' });
    addBox(parent, [0, -0.43, 0], [shape.armWidth, 0.24, 0.31], accent, { name: 'sleeveCuff' });
    addBox(parent, [0, -0.62, 0], [shape.armWidth, 0.26, 0.3], skin, { name: 'forearm' });
    addBox(parent, [0, -0.8, 0.025], [shape.armWidth + 0.045, 0.18, 0.34], skin, { name: 'hand' });
}

function addBox(parent, position, size, materialOrColor, options = {}) {
    const radius = Math.min(options.radius ?? Math.min(...size) * 0.16, Math.min(...size) * 0.45);
    const mesh = new THREE.Mesh(
        graphicsPrototype.usesPainterlyTextures
            ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius)
            : new THREE.BoxGeometry(size[0], size[1], size[2]),
        typeof materialOrColor === 'string'
            ? makeMaterial(materialOrColor, { kind: 'plain' })
            : materialOrColor
    );
    if (options.name) mesh.name = options.name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    if (!usesOutlines(parent)) return mesh;
    const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, graphicsPrototype.usesPainterlyTextures ? 34 : 1),
        new THREE.LineBasicMaterial({ color: 0x241a12, transparent: true, opacity: graphicsPrototype.usesPainterlyTextures ? 0.26 : 0.38 })
    );
    mesh.add(outline);
    return mesh;
}

function usesOutlines(object) {
    let current = object;
    while (current) {
        if (current.userData?.outlines === false) return false;
        current = current.parent;
    }
    return true;
}

function getBodyShape(gender, bodyType) {
    const bodyScale = bodyType === 'slim' ? 0.9 : bodyType === 'sturdy' ? 1.12 : 1;
    const genderShape = gender === 'female'
        ? { shoulder: 0.9, waist: 0.78, hip: 1.08, arm: 0.28, leg: 0.34, head: 0.98, height: 1 }
        : { shoulder: 1.12, waist: 1, hip: 0.98, arm: 0.34, leg: 0.39, head: 1, height: 1 };
    const torsoWidth = 0.95 * bodyScale * genderShape.shoulder;
    const waistWidth = 0.82 * bodyScale * genderShape.waist;

    return {
        gender,
        torsoWidth,
        torsoHeight: 1.08 * genderShape.height,
        waistWidth,
        hipWidth: 0.86 * bodyScale * genderShape.hip,
        armX: (torsoWidth / 2) + 0.18,
        armWidth: genderShape.arm * bodyScale,
        legX: 0.24 * bodyScale,
        legWidth: genderShape.leg * bodyScale,
        headScale: genderShape.head
    };
}

function addTorso(parent, shape, shirt, pants, accent) {
    addBox(parent, [0, 0.64, 0], [shape.torsoWidth, 0.56, 0.44], shirt, { name: 'upperTorso' });
    addBox(parent, [0, 0.22, 0], [shape.waistWidth, 0.3, 0.43], shirt, { name: 'waist' });
    addBox(parent, [0, -0.055, 0.01], [shape.hipWidth, 0.23, 0.44], pants, { name: 'hips' });
    addBox(parent, [0, 0.075, 0.235], [shape.hipWidth + 0.02, 0.08, 0.055], accent, { name: 'belt' });
    addBox(parent, [0, 0.76, 0.235], [0.28, 0.075, 0.045], accent, { name: 'collar' });

    if (shape.torsoWidth > shape.hipWidth) {
        addBox(parent, [-shape.torsoWidth / 2 - 0.035, 0.82, 0], [0.07, 0.18, 0.48], shirt);
        addBox(parent, [shape.torsoWidth / 2 + 0.035, 0.82, 0], [0.07, 0.18, 0.48], shirt);
        return;
    }

    addBox(parent, [-shape.hipWidth / 2, 0.06, 0.02], [0.07, 0.18, 0.46], pants);
    addBox(parent, [shape.hipWidth / 2, 0.06, 0.02], [0.07, 0.18, 0.46], pants);
}

function addFace(parent, colors, hair) {
    const white = makeMaterial('#f3ead7', { kind: 'plain' });
    const iris = makeMaterial(colors.eyes, { kind: 'gloss' });
    const pupil = makeMaterial('#211d19', { kind: 'plain' });
    const nose = makeMaterial(lighten(colors.skin, 18), { kind: 'plain' });
    const mouth = makeMaterial(darken(colors.skin, 54), { kind: 'plain' });

    for (const x of [-0.16, 0.16]) {
        addBox(parent, [x, 0.45, 0.374], [0.17, 0.1, 0.035], white, { name: 'eyeWhite', radius: 0.025 });
        addBox(parent, [x, 0.45, 0.397], [0.085, 0.085, 0.025], iris, { name: 'iris', radius: 0.018 });
        addBox(parent, [x, 0.45, 0.413], [0.032, 0.052, 0.018], pupil, { name: 'pupil', radius: 0.008 });
        addBox(parent, [x, 0.555, 0.378], [0.18, 0.035, 0.03], hair, { name: 'eyebrow', radius: 0.01 });
    }
    addBox(parent, [0, 0.35, 0.39], [0.075, 0.11, 0.055], nose, { name: 'nose', radius: 0.02 });
    addBox(parent, [0, 0.21, 0.386], [0.16, 0.035, 0.03], mouth, { name: 'mouth', radius: 0.01 });
}

function addHair(parent, style, gender, material, colors) {
    if (style === 'none') return null;
    if (style === 'short') {
        addBox(parent, [0, 0.745, -0.015], [0.78, 0.17, 0.76], material);
        addBox(parent, [0, 0.57, -0.355], [0.76, gender === 'female' ? 0.38 : 0.3, 0.11], material);
        addBox(parent, [-0.28, 0.65, 0.31], [0.2, 0.16, 0.08], material);
        return null;
    }
    if (style === 'flat') {
        addBox(parent, [0, 0.735, 0], [0.79, 0.12, 0.76], material);
        return null;
    }
    if (style === 'curly') {
        for (const x of [-0.27, 0, 0.27]) {
            addBox(parent, [x, 0.76, 0.1], [0.24, 0.23, 0.23], material);
        }
        addBox(parent, [0, 0.58, -0.34], [0.75, gender === 'female' ? 0.44 : 0.28, 0.14], material);
        return null;
    }
    if (style === 'long') {
        addBox(parent, [0, 0.74, -0.02], [0.79, 0.15, 0.76], material);
        addBox(parent, [0, 0.34, -0.355], [0.75, 0.78, 0.14], material);
        for (const x of [-0.39, 0.39]) {
            addBox(parent, [x, 0.46, -0.13], [0.11, 0.42, 0.36], material);
            addBox(parent, [x, 0.18, -0.19], [0.09, 0.24, 0.25], material);
        }
        return null;
    }
    if (style === 'ponytail') {
        addBox(parent, [0, 0.74, -0.03], [0.77, 0.16, 0.73], material);
        const ponytailPivot = createPivot(parent, 'ponytailPivot', [0, 0.64, -0.39]);
        addBox(ponytailPivot, [0, -0.15, -0.03], [0.28, 0.58, 0.17], material);
        addBox(ponytailPivot, [0, -0.47, -0.05], [0.22, 0.3, 0.15], material);
        return ponytailPivot;
    }
    if (style === 'cap') {
        addBox(parent, [0, 0.735, 0], [0.8, 0.15, 0.77], makeMaterial(colors.accent, { kind: 'fabric', detail: 'woven' }));
        addBox(parent, [0, 0.65, 0.4], [0.46, 0.07, 0.2], makeMaterial(colors.accent, { kind: 'fabric', detail: 'plain' }));
        return null;
    }
    addBox(parent, [0, 0.88, 0], [0.22, 0.42, 0.29], material);
    addBox(parent, [0, 0.7, -0.08], [0.7, 0.13, 0.67], material);
    return null;
}

function addAccessory({ torso, headPivot }, accessory, colors, accent) {
    const pivots = { capePivot: null, scarfPivot: null };
    if (accessory === 'cape') {
        pivots.capePivot = createPivot(torso, 'capePivot', [0, 0.93, -0.27]);
        addBox(pivots.capePivot, [0, -0.52, -0.04], [0.86, 1.2, 0.08], makeMaterial(darken(colors.shirt), { kind: 'fabric', detail: 'woven', pattern: 'trim', accent: colors.accent }));
    }

    if (accessory === 'pack') {
        addBox(torso, [0, 0.43, -0.4], [0.66, 0.82, 0.28], makeMaterial('#5a3d2b', { kind: 'fabric', detail: 'leather', pattern: 'panel', accent: colors.accent }));
        addBox(torso, [-0.38, 0.7, -0.25], [0.08, 0.64, 0.08], makeMaterial(colors.boots, { kind: 'fabric', detail: 'leather' }));
        addBox(torso, [0.38, 0.7, -0.25], [0.08, 0.64, 0.08], makeMaterial(colors.boots, { kind: 'fabric', detail: 'leather' }));
    }

    if (accessory === 'scarf') {
        pivots.scarfPivot = createPivot(torso, 'scarfPivot', [0, 0.94, 0.04]);
        addBox(pivots.scarfPivot, [0, 0, 0], [0.92, 0.14, 0.54], accent);
        addBox(pivots.scarfPivot, [0.32, -0.31, 0.26], [0.16, 0.48, 0.12], accent);
    }

    if (accessory === 'goggles') {
        const strap = makeMaterial(colors.boots, { kind: 'fabric', detail: 'leather' });
        const frame = makeMaterial(colors.accent, { kind: 'gloss' });
        const lens = makeMaterial(lighten(colors.eyes, 38), { kind: 'gloss' });
        addBox(headPivot, [0, 0.45, 0.401], [0.77, 0.055, 0.04], strap);
        for (const x of [-0.16, 0.16]) {
            addBox(headPivot, [x, 0.45, 0.425], [0.22, 0.17, 0.055], frame);
            addBox(headPivot, [x, 0.45, 0.458], [0.15, 0.1, 0.025], lens);
        }
        addBox(headPivot, [0, 0.45, 0.444], [0.12, 0.045, 0.04], strap);
    }
    return pivots;
}

function addOutfitLayers(parent, scaleX, colors, textures, accent) {
    if (textures.outfitPattern === 'none') return;

    addBox(parent, [0, 1, 0.25], [0.86 * scaleX, 0.08, 0.05], accent);
    if (textures.outfitPattern === 'trim') {
        addBox(parent, [0, -0.06, 0.25], [0.88 * scaleX, 0.1, 0.05], accent);
    }
    if (textures.outfitPattern === 'stripes') {
        addBox(parent, [0, 0.56, 0.25], [0.9 * scaleX, 0.08, 0.05], accent);
        addBox(parent, [0, 0.26, 0.25], [0.9 * scaleX, 0.08, 0.05], accent);
    }
    if (textures.outfitPattern === 'checker') {
        addBox(parent, [-0.22 * scaleX, 0.58, 0.25], [0.18, 0.18, 0.05], accent);
        addBox(parent, [0.22 * scaleX, 0.3, 0.25], [0.18, 0.18, 0.05], accent);
        addBox(parent, [-0.22 * scaleX, -0.4, 0.22], [0.12, 0.2, 0.05], accent);
        addBox(parent, [0.22 * scaleX, -0.64, 0.22], [0.12, 0.2, 0.05], accent);
    }
    if (textures.outfitPattern === 'panel') {
        addBox(parent, [0, 0.44, 0.25], [0.28 * scaleX, 0.92, 0.05], makeMaterial(darken(colors.shirt), { kind: 'fabric', detail: textures.fabric }));
        addBox(parent, [0, -0.42, 0.23], [0.1, 0.76, 0.05], accent);
    }
}

function addFaceDetail(parent, detail, colors) {
    if (detail === 'freckles') {
        const freckle = makeMaterial(darken(colors.skin), { kind: 'plain' });
        addBox(parent, [-0.28, 0.35, 0.382], [0.045, 0.035, 0.025], freckle);
        addBox(parent, [0.27, 0.34, 0.382], [0.045, 0.035, 0.025], freckle);
        addBox(parent, [0.0, 0.31, 0.397], [0.035, 0.03, 0.025], freckle);
    }
    if (detail === 'scar') {
        addBox(parent, [0.27, 0.48, 0.39], [0.045, 0.24, 0.028], makeMaterial('#8d4a3d', { kind: 'plain' }));
    }
    if (detail === 'sunmark') {
        addBox(parent, [-0.28, 0.5, 0.39], [0.1, 0.1, 0.028], makeMaterial(colors.accent, { kind: 'plain' }));
    }
}

function makeMaterial(baseColor, options = {}) {
    const texture = makeTexture(baseColor, options);
    const metalness = options.detail === 'iron' || options.kind === 'gloss' ? 0.35 : 0;
    const roughness = options.kind === 'gloss' ? 0.28 : options.detail === 'leather' ? 0.7 : 0.86;
    return new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: texture,
        roughness,
        metalness,
        flatShading: !graphicsPrototype.usesPainterlyTextures
    });
}

function makeTexture(baseColor, { kind = 'plain', detail = 'plain', pattern = 'none', accent = '#d4a94f' } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const base = ctx.createLinearGradient(0, 0, 64, 64);
    base.addColorStop(0, lighten(baseColor, 14));
    base.addColorStop(0.55, baseColor);
    base.addColorStop(1, darken(baseColor, 16));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);

    addPainterlyGrain(ctx, baseColor, detail === 'iron' ? 28 : 14);
    if (detail === 'woven') drawWoven(ctx, baseColor);
    if (detail === 'leather') drawLeather(ctx, baseColor);
    if (detail === 'iron') drawIron(ctx, baseColor);
    if (kind === 'hair') drawHairGrain(ctx, baseColor);
    if (kind === 'skin') drawSkin(ctx, detail, baseColor);
    drawPattern(ctx, pattern, accent);

    const texture = new THREE.CanvasTexture(canvas);
    texture.name = `character-texture-${textureSerial++}`;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.magFilter = graphicsPrototype.usesPainterlyTextures ? THREE.LinearFilter : THREE.NearestFilter;
    texture.minFilter = graphicsPrototype.usesPainterlyTextures ? THREE.LinearFilter : THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
}

function addPainterlyGrain(ctx, color, amount) {
    for (let i = 0; i < amount; i++) {
        ctx.fillStyle = i % 2 ? lighten(color, 18) : darken(color, 18);
        ctx.globalAlpha = 0.11;
        const x = (i * 17) % 64;
        const y = (i * 29) % 64;
        ctx.fillRect(x, y, 10 + (i % 3) * 4, 2 + (i % 2) * 2);
    }
    ctx.globalAlpha = 1;
}

function drawWoven(ctx, color) {
    ctx.strokeStyle = lighten(color, 26);
    ctx.globalAlpha = 0.28;
    for (let i = 8; i < 64; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 64);
        ctx.moveTo(0, i);
        ctx.lineTo(64, i);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function drawLeather(ctx, color) {
    ctx.strokeStyle = darken(color, 34);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 8 + i * 12);
        ctx.bezierCurveTo(18, 2 + i * 9, 36, 22 + i * 6, 64, 10 + i * 11);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function drawIron(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, lighten(color, 55));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, darken(color, 45));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
}

function drawHairGrain(ctx, color) {
    ctx.strokeStyle = lighten(color, 24);
    ctx.globalAlpha = 0.22;
    for (let i = 6; i < 64; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 8, 64);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function drawSkin(ctx, detail, color) {
    if (detail === 'freckles') {
        ctx.fillStyle = darken(color, 38);
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < 12; i++) {
            ctx.fillRect((i * 19) % 60, (i * 31) % 60, 3, 3);
        }
    }
    if (detail === 'scar') {
        ctx.strokeStyle = '#8d4a3d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(42, 12);
        ctx.lineTo(28, 48);
        ctx.stroke();
    }
    if (detail === 'sunmark') {
        ctx.fillStyle = lighten(color, 52);
        ctx.fillRect(10, 12, 12, 12);
    }
    ctx.globalAlpha = 1;
}

function drawPattern(ctx, pattern, accent) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5;
    if (pattern === 'stripes') {
        for (let y = 8; y < 64; y += 18) ctx.fillRect(0, y, 64, 5);
    }
    if (pattern === 'checker') {
        for (let y = 0; y < 64; y += 16) {
            for (let x = (y / 16) % 2 ? 16 : 0; x < 64; x += 32) ctx.fillRect(x, y, 16, 16);
        }
    }
    if (pattern === 'trim') {
        ctx.fillRect(0, 0, 64, 5);
        ctx.fillRect(0, 59, 64, 5);
    }
    if (pattern === 'panel') {
        ctx.fillRect(29, 0, 6, 64);
    }
    ctx.globalAlpha = 1;
}

function darken(hex, amount = 48) {
    return shiftColor(hex, -amount);
}

function lighten(hex, amount) {
    return shiftColor(hex, amount);
}

function shiftColor(hex, amount) {
    const value = Number.parseInt(hex.slice(1), 16);
    const r = clampColor(((value >> 16) & 255) + amount);
    const g = clampColor(((value >> 8) & 255) + amount);
    const b = clampColor((value & 255) + amount);
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function clampColor(value) {
    return Math.max(0, Math.min(255, value));
}
