import * as THREE from 'three';

const PALETTES = Object.freeze({
    handle: { base: 0x704522, dark: 0x3f2414, light: 0xa56a35, accent: 0x5a3219, shininess: 5 },
    Holz: { base: 0x9a6031, dark: 0x5c331b, light: 0xd08a48, accent: 0x7a4726, shininess: 4 },
    Stein: { base: 0x777873, dark: 0x464944, light: 0xa8aaa2, accent: 0x60635e, shininess: 7 },
    Eisen: { base: 0xb7c0c5, dark: 0x68747c, light: 0xf0f4f2, accent: 0x929da4, shininess: 55 },
    Gold: { base: 0xd9a928, dark: 0x88620d, light: 0xffe579, accent: 0xb88718, shininess: 70 },
    leather: { base: 0x744027, dark: 0x3d2015, light: 0xa7673f, accent: 0x5b301f, shininess: 3 },
    darkMetal: { base: 0x4d5559, dark: 0x252b2e, light: 0x808a8e, accent: 0x394145, shininess: 35 },
    bowWood: { base: 0x8c5127, dark: 0x482712, light: 0xc47b3d, accent: 0x693819, shininess: 7 }
});

const textureCache = new Map();

function colorBytes(color) {
    return [(color >> 16) & 255, (color >> 8) & 255, color & 255, 255];
}

function getPainterlyTexture(name) {
    if (textureCache.has(name)) return textureCache.get(name);
    const palette = PALETTES[name] || PALETTES.Stein;
    const pattern = [
        palette.dark, palette.base, palette.base, palette.light,
        palette.base, palette.accent, palette.light, palette.base,
        palette.accent, palette.base, palette.dark, palette.base,
        palette.base, palette.light, palette.base, palette.accent
    ];
    const pixels = new Uint8Array(pattern.flatMap(colorBytes));
    const texture = new THREE.DataTexture(pixels, 4, 4, THREE.RGBAFormat);
    texture.name = `held-item-${name}`;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    textureCache.set(name, texture);
    return texture;
}

function createPainterlyMaterial(name) {
    const palette = PALETTES[name] || PALETTES.Stein;
    return new THREE.MeshPhongMaterial({
        color: 0xffffff,
        map: getPainterlyTexture(name),
        shininess: palette.shininess,
        specular: palette.light
    });
}

function setPainterlyMaterial(material, name) {
    const palette = PALETTES[name] || PALETTES.Stein;
    material.map = getPainterlyTexture(name);
    material.shininess = palette.shininess;
    material.specular.setHex(palette.light);
    material.color.setHex(0xffffff);
    material.needsUpdate = true;
}

function addBox(parent, name, size, position, material, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
}

function addDiamond(parent, name, radius, height, position, material, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), material);
    mesh.name = name;
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
}

function addGripWraps(parent, yValues, material) {
    for (const [index, y] of yValues.entries()) {
        addBox(parent, index === 0 ? 'swordGripWrap' : `swordGripWrap${index + 1}`, [0.105, 0.035, 0.105], [0, y, 0], material);
    }
}

export function createHeldSwordModel() {
    const group = new THREE.Group();
    group.name = 'heldSword';
    const bladeMaterial = createPainterlyMaterial('Eisen');
    const edgeMaterial = createPainterlyMaterial('Eisen');
    const guardMaterial = createPainterlyMaterial('darkMetal');
    const gripMaterial = createPainterlyMaterial('leather');

    const blade = addBox(group, 'swordBlade', [0.13, 0.46, 0.055], [0, 0.43, 0], bladeMaterial);
    addBox(group, 'swordBladeShoulder', [0.17, 0.12, 0.065], [0, 0.2, 0], bladeMaterial);
    addDiamond(group, 'swordBladeTip', 0.095, 0.2, [0, 0.76, 0], bladeMaterial);
    addBox(group, 'swordBladeEdge', [0.025, 0.53, 0.07], [-0.07, 0.45, 0], edgeMaterial);
    edgeMaterial.color.setHex(0xdde3e0);
    addBox(group, 'swordGuard', [0.42, 0.075, 0.11], [0, 0.12, 0], guardMaterial);
    addBox(group, 'swordGuardLeft', [0.09, 0.12, 0.1], [-0.19, 0.09, 0], guardMaterial, [0, 0, 0.35]);
    addBox(group, 'swordGuardRight', [0.09, 0.12, 0.1], [0.19, 0.09, 0], guardMaterial, [0, 0, -0.35]);
    addBox(group, 'swordHandle', [0.085, 0.27, 0.085], [0, -0.05, 0], gripMaterial);
    addGripWraps(group, [-0.14, -0.06, 0.02], guardMaterial);
    addDiamond(group, 'swordPommel', 0.085, 0.13, [0, -0.24, 0], guardMaterial, [0, 0, Math.PI]);

    group.userData.bladeMaterial = bladeMaterial;
    group.userData.edgeMaterial = edgeMaterial;
    group.userData.blade = blade;
    group.position.set(0.4, -0.35, -0.5);
    group.rotation.set(-0.2, 0, 0);
    group.visible = false;
    return group;
}

export function createHeldBowModel() {
    const group = new THREE.Group();
    group.name = 'heldBow';
    const limbMaterial = createPainterlyMaterial('bowWood');
    const gripMaterial = createPainterlyMaterial('leather');
    const wrapMaterial = createPainterlyMaterial('Gold');
    const segments = [
        { y: 0.34, x: 0.11, angle: -0.34 },
        { y: 0.15, x: 0.045, angle: -0.2 },
        { y: 0.51, x: 0.22, angle: -0.52 },
        { y: -0.34, x: 0.11, angle: 0.34 },
        { y: -0.15, x: 0.045, angle: 0.2 },
        { y: -0.51, x: 0.22, angle: 0.52 }
    ];
    for (const [index, segment] of segments.entries()) {
        addBox(group, `bowLimb${index + 1}`, [0.075, 0.24, 0.075], [segment.x, segment.y, 0], limbMaterial, [0, 0, segment.angle]);
    }
    addBox(group, 'bowGrip', [0.1, 0.25, 0.1], [0, 0, 0], gripMaterial);
    addBox(group, 'bowUpperWrap', [0.11, 0.045, 0.11], [0.025, 0.13, 0], wrapMaterial);
    addBox(group, 'bowLowerWrap', [0.11, 0.045, 0.11], [0.025, -0.13, 0], wrapMaterial);

    const string = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0.35, 0.61, 0),
            new THREE.Vector3(-0.08, 0, 0),
            new THREE.Vector3(0.35, -0.61, 0)
        ]),
        new THREE.LineBasicMaterial({ color: 0xe8dcc3 })
    );
    string.name = 'bowString';
    group.add(string);
    group.userData.limbSegments = segments.length;
    group.userData.limbMaterial = limbMaterial;
    group.position.set(0.42, -0.25, -0.55);
    group.rotation.set(-0.15, -0.35, -0.15);
    group.visible = false;
    return group;
}

function createPickaxeHead(material) {
    const head = new THREE.Group();
    head.name = 'pickaxeHead';
    addBox(head, 'pickaxeSocket', [0.15, 0.2, 0.14], [0, 0.46, 0], material);
    addBox(head, 'pickaxeLeftArm', [0.34, 0.12, 0.12], [-0.2, 0.5, 0], material, [0, 0, 0.12]);
    addBox(head, 'pickaxeRightArm', [0.34, 0.12, 0.12], [0.2, 0.5, 0], material, [0, 0, -0.12]);
    addDiamond(head, 'pickaxeLeftTip', 0.085, 0.2, [-0.45, 0.47, 0], material, [0, 0, Math.PI / 2]);
    addDiamond(head, 'pickaxeRightTip', 0.085, 0.2, [0.45, 0.47, 0], material, [0, 0, -Math.PI / 2]);
    return head;
}

function createAxeHead(material) {
    const head = new THREE.Group();
    head.name = 'axeHead';
    addBox(head, 'axeSocket', [0.15, 0.2, 0.14], [0, 0.48, 0], material);
    addBox(head, 'axeBlade', [0.3, 0.32, 0.11], [-0.2, 0.5, 0], material);
    addBox(head, 'axeEdge', [0.075, 0.38, 0.125], [-0.385, 0.5, 0], material);
    addDiamond(head, 'axePoll', 0.095, 0.18, [0.19, 0.5, 0], material, [0, 0, -Math.PI / 2]);
    return head;
}

function createShovelHead(material) {
    const head = new THREE.Group();
    head.name = 'shovelHead';
    addBox(head, 'shovelCollar', [0.14, 0.16, 0.14], [0, 0.45, 0], material);
    addBox(head, 'shovelSpade', [0.3, 0.28, 0.095], [0, 0.62, 0], material);
    addDiamond(head, 'shovelTip', 0.17, 0.2, [0, 0.85, 0], material);
    return head;
}

export function createHeldToolModel() {
    const group = new THREE.Group();
    group.name = 'heldTool';
    const handleMaterial = createPainterlyMaterial('handle');
    const headMaterial = createPainterlyMaterial('Stein');
    addBox(group, 'toolHandle', [0.085, 0.72, 0.085], [0, 0.08, 0], handleMaterial);
    addBox(group, 'toolHandleCap', [0.115, 0.08, 0.115], [0, -0.31, 0], createPainterlyMaterial('darkMetal'));
    addBox(group, 'toolGrip', [0.105, 0.25, 0.105], [0, -0.12, 0], createPainterlyMaterial('leather'));
    const heads = {
        pickaxe: createPickaxeHead(headMaterial),
        axe: createAxeHead(headMaterial),
        shovel: createShovelHead(headMaterial)
    };
    Object.values(heads).forEach(head => group.add(head));
    group.userData.heads = heads;
    group.userData.headMaterial = headMaterial;
    group.position.set(0.42, -0.38, -0.55);
    group.rotation.set(-0.25, -0.2, -0.18);
    group.visible = false;
    return group;
}

export function applyToolAppearance(group, tool) {
    if (!group?.userData?.heads || !tool) return;
    for (const [category, head] of Object.entries(group.userData.heads)) {
        head.visible = category === tool.category;
    }
    setPainterlyMaterial(group.userData.headMaterial, tool.material);
}

export function applySwordAppearance(group, sword) {
    if (!group?.userData?.bladeMaterial || !sword) return;
    setPainterlyMaterial(group.userData.bladeMaterial, sword.material);
    setPainterlyMaterial(group.userData.edgeMaterial, sword.material);
    group.userData.edgeMaterial.color.setHex(0xe4e7df);
}
