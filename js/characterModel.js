import * as THREE from 'three';
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

    addBox(headPivot, [0, 0.4, 0], [0.9 * shape.headScale, 0.84, 0.86 * shape.headScale], skin);
    addBox(torso, [0, 0.86, 0], [0.26, 0.18, 0.26], skin);
    addTorso(torso, shape, shirt, pants, accent);
    addBox(leftArmPivot, [0, -0.44, 0], [shape.armWidth, 0.9, 0.3], skin);
    addBox(rightArmPivot, [0, -0.44, 0], [shape.armWidth, 0.9, 0.3], skin);
    addLeg(leftLegPivot, shape, pants, boots);
    addLeg(rightLegPivot, shape, pants, boots);

    addOutfitLayers(torso, scaleX, colors, textures, accent);
    addBox(headPivot, [-0.16, 0.49, 0.45], [0.1, 0.08, 0.035], makeMaterial(colors.eyes, { kind: 'gloss' }));
    addBox(headPivot, [0.16, 0.49, 0.45], [0.1, 0.08, 0.035], makeMaterial(colors.eyes, { kind: 'gloss' }));
    addFace(headPivot, colors);
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
    addBox(parent, [0, -0.43, 0], [shape.legWidth, 0.86, 0.36], pants);
    addBox(parent, [0, -0.9, 0.04], [shape.legWidth + 0.06, 0.18, 0.46], boots);
}

function addBox(parent, position, size, materialOrColor) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        typeof materialOrColor === 'string'
            ? makeMaterial(materialOrColor, { kind: 'plain' })
            : materialOrColor
    );
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    if (!usesOutlines(parent)) return mesh;
    const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: 0x161616, transparent: true, opacity: 0.38 })
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
    addBox(parent, [0, 0.65, 0], [shape.torsoWidth, 0.58, 0.46], shirt);
    addBox(parent, [0, 0.22, 0], [shape.waistWidth, 0.3, 0.45], shirt);
    addBox(parent, [0, -0.06, 0.01], [shape.hipWidth, 0.24, 0.46], pants);
    addBox(parent, [0, 0.07, 0.25], [shape.hipWidth + 0.02, 0.07, 0.045], accent);

    if (shape.gender === 'female') {
        addBox(parent, [0, 0.66, 0.265], [0.52, 0.16, 0.045], shirt);
        addBox(parent, [0, 0.5, 0.265], [0.36, 0.08, 0.045], accent);
    }

    if (shape.torsoWidth > shape.hipWidth) {
        addBox(parent, [-shape.torsoWidth / 2 - 0.035, 0.82, 0], [0.07, 0.18, 0.48], shirt);
        addBox(parent, [shape.torsoWidth / 2 + 0.035, 0.82, 0], [0.07, 0.18, 0.48], shirt);
        return;
    }

    addBox(parent, [-shape.hipWidth / 2, 0.06, 0.02], [0.07, 0.18, 0.46], pants);
    addBox(parent, [shape.hipWidth / 2, 0.06, 0.02], [0.07, 0.18, 0.46], pants);
}

function addFace(parent, colors) {
    const nose = makeMaterial(lighten(colors.skin, 18), { kind: 'plain' });
    const mouth = makeMaterial(darken(colors.skin, 58), { kind: 'plain' });

    addBox(parent, [0, 0.38, 0.47], [0.08, 0.1, 0.04], nose);
    addBox(parent, [0, 0.24, 0.47], [0.22, 0.04, 0.04], mouth);
}

function addHair(parent, style, gender, material, colors) {
    if (style === 'none') return null;
    if (style === 'short') {
        addBox(parent, [0, 0.85, -0.02], [0.88, 0.18, 0.88], material);
        addBox(parent, [0, 0.62, -0.41], [0.86, gender === 'female' ? 0.42 : 0.34, 0.12], material);
        return null;
    }
    if (style === 'flat') {
        addBox(parent, [0, 0.8, 0], [0.9, 0.12, 0.9], material);
        return null;
    }
    if (style === 'curly') {
        for (const x of [-0.28, 0, 0.28]) {
            addBox(parent, [x, 0.88, 0.14], [0.23, 0.24, 0.23], material);
        }
        addBox(parent, [0, 0.7, -0.38], [0.82, gender === 'female' ? 0.48 : 0.28, 0.16], material);
        return null;
    }
    if (style === 'long') {
        addBox(parent, [0, 0.84, -0.02], [0.9, 0.16, 0.88], material);
        addBox(parent, [0, 0.4, -0.43], [0.86, 0.9, 0.16], material);
        addBox(parent, [-0.43, 0.46, 0], [0.12, 0.72, 0.62], material);
        addBox(parent, [0.43, 0.46, 0], [0.12, 0.72, 0.62], material);
        return null;
    }
    if (style === 'ponytail') {
        addBox(parent, [0, 0.84, -0.03], [0.86, 0.17, 0.82], material);
        const ponytailPivot = createPivot(parent, 'ponytailPivot', [0, 0.72, -0.45]);
        addBox(ponytailPivot, [0, -0.14, -0.03], [0.32, 0.72, 0.18], material);
        addBox(ponytailPivot, [0, -0.52, -0.05], [0.24, 0.34, 0.16], material);
        return ponytailPivot;
    }
    if (style === 'cap') {
        addBox(parent, [0, 0.83, 0], [0.9, 0.16, 0.9], makeMaterial(colors.accent, { kind: 'fabric', detail: 'woven' }));
        addBox(parent, [0, 0.72, 0.48], [0.5, 0.08, 0.22], makeMaterial(colors.accent, { kind: 'fabric', detail: 'plain' }));
        return null;
    }
    addBox(parent, [0, 0.99, 0], [0.24, 0.5, 0.32], material);
    addBox(parent, [0, 0.76, -0.1], [0.76, 0.14, 0.72], material);
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
        addBox(headPivot, [-0.16, 0.51, 0.47], [0.2, 0.16, 0.06], makeMaterial(colors.accent, { kind: 'gloss' }));
        addBox(headPivot, [0.16, 0.51, 0.47], [0.2, 0.16, 0.06], makeMaterial(colors.accent, { kind: 'gloss' }));
        addBox(headPivot, [0, 0.51, 0.48], [0.12, 0.05, 0.05], makeMaterial(colors.boots, { kind: 'plain' }));
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
        addBox(parent, [-0.29, 0.38, 0.43], [0.05, 0.04, 0.03], freckle);
        addBox(parent, [0.28, 0.37, 0.43], [0.05, 0.04, 0.03], freckle);
        addBox(parent, [0.0, 0.34, 0.43], [0.04, 0.035, 0.03], freckle);
    }
    if (detail === 'scar') {
        addBox(parent, [0.26, 0.54, 0.44], [0.06, 0.28, 0.035], makeMaterial('#8d4a3d', { kind: 'plain' }));
    }
    if (detail === 'sunmark') {
        addBox(parent, [-0.3, 0.56, 0.44], [0.12, 0.12, 0.035], makeMaterial(colors.accent, { kind: 'plain' }));
    }
}

function makeMaterial(baseColor, options = {}) {
    const texture = makeTexture(baseColor, options);
    const metalness = options.detail === 'iron' || options.kind === 'gloss' ? 0.35 : 0;
    const roughness = options.kind === 'gloss' ? 0.28 : options.detail === 'leather' ? 0.62 : 0.78;
    return new THREE.MeshStandardMaterial({ color: '#ffffff', map: texture, roughness, metalness });
}

function makeTexture(baseColor, { kind = 'plain', detail = 'plain', pattern = 'none', accent = '#d4a94f' } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 64, 64);

    addPixelNoise(ctx, baseColor, detail === 'iron' ? 28 : 14);
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

function addPixelNoise(ctx, color, amount) {
    for (let i = 0; i < amount; i++) {
        ctx.fillStyle = i % 2 ? lighten(color, 18) : darken(color, 18);
        ctx.globalAlpha = 0.16;
        ctx.fillRect((i * 17) % 64, (i * 29) % 64, 8, 8);
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
