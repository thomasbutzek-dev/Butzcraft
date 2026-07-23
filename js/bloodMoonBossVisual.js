import * as THREE from 'three';

const BLOOD_MOON_ARMOR_TEXTURE_URL = new URL('../assets/generated/blood-moon-armor-v1.webp', import.meta.url).href;

let armorTexture = null;

function getArmorTexture() {
    if (armorTexture) return armorTexture;
    armorTexture = new THREE.TextureLoader().load(BLOOD_MOON_ARMOR_TEXTURE_URL);
    armorTexture.colorSpace = THREE.SRGBColorSpace;
    armorTexture.wrapS = THREE.RepeatWrapping;
    armorTexture.wrapT = THREE.RepeatWrapping;
    armorTexture.repeat.set(1.35, 1.35);
    armorTexture.anisotropy = 4;
    return armorTexture;
}

function material(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.72,
        metalness: options.metalness ?? 0.22,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        depthWrite: options.depthWrite ?? true
    });
}

function addMesh(parent, geometry, meshMaterial, position, rotation = null) {
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

export function createBloodMoonBossVisual({ echo = false } = {}) {
    const group = new THREE.Group();
    const modelRoot = new THREE.Group();
    const visualBaseY = 1.08;
    modelRoot.position.y = visualBaseY;
    group.add(modelRoot);

    const texture = getArmorTexture();
    const armor = new THREE.MeshStandardMaterial({
        map: texture,
        color: echo ? 0x90727c : 0xb4a6a3,
        roughness: 0.62,
        metalness: 0.58,
        emissive: echo ? 0x3b0618 : 0x200003,
        emissiveIntensity: echo ? 0.78 : 0.32
    });
    const darkArmor = new THREE.MeshStandardMaterial({
        map: texture,
        color: echo ? 0x4a303c : 0x5c5557,
        roughness: 0.78,
        metalness: 0.48,
        emissive: echo ? 0x280513 : 0x130002,
        emissiveIntensity: echo ? 0.72 : 0.26
    });
    const red = material(echo ? 0xff416c : 0xff304f, {
        roughness: 0.16,
        metalness: 0.22,
        emissive: echo ? 0xff174f : 0xa80018,
        emissiveIntensity: echo ? 4.5 : 3.4
    });
    const voidMaterial = new THREE.MeshBasicMaterial({ color: 0x040105 });
    const edgeMetal = material(0x75666b, {
        roughness: 0.4,
        metalness: 0.82,
        emissive: 0x240007,
        emissiveIntensity: 0.3
    });
    const echoParts = [];
    const fractureParts = [];
    const track = mesh => {
        if (echo) {
            const index = echoParts.length;
            mesh.position.add(new THREE.Vector3(
                Math.sin(index * 2.17) * (0.05 + index % 3 * 0.022),
                Math.cos(index * 1.31) * (0.04 + index % 4 * 0.018),
                Math.sin(index * 0.91) * 0.06
            ));
            mesh.userData.basePosition = mesh.position.clone();
            mesh.userData.baseRotation = mesh.rotation.clone();
            mesh.userData.floatSeed = index * 0.83;
            echoParts.push(mesh);
        }
        return mesh;
    };

    const pelvis = track(addMesh(modelRoot, new THREE.DodecahedronGeometry(0.83, 0), darkArmor, [0, 1.12, 0]));
    pelvis.scale.set(1.45, 0.72, 0.9);
    const torso = track(addMesh(modelRoot, new THREE.DodecahedronGeometry(1.25, 1), darkArmor, [0, 2.48, 0]));
    torso.scale.set(1.22, 1.25, 0.78);

    const chestPlates = [];
    for (const side of [-1, 1]) {
        const breastplate = track(addMesh(
            modelRoot,
            new THREE.DodecahedronGeometry(0.78, 0),
            armor,
            [side * 0.52, 2.7, 0.66],
            [0.04, side * 0.14, side * -0.08]
        ));
        breastplate.scale.set(1.08, 1.2, 0.42);
        chestPlates.push(breastplate);
    }
    for (let row = 0; row < 3; row++) {
        const abdomenPlate = track(addMesh(
            modelRoot,
            new THREE.OctahedronGeometry(0.58 - row * 0.07, 0),
            row === 1 ? darkArmor : armor,
            [0, 1.92 - row * 0.34, 0.73],
            [0, 0, Math.PI / 4]
        ));
        abdomenPlate.scale.set(1.4 - row * 0.12, 0.58, 0.28);
        chestPlates.push(abdomenPlate);
    }

    const collar = track(addMesh(
        modelRoot,
        new THREE.TorusGeometry(0.86, 0.16, 5, 12, Math.PI * 1.35),
        edgeMetal,
        [0, 3.42, 0.04],
        [Math.PI / 2, 0, -Math.PI * 0.18]
    ));
    collar.scale.set(1.25, 1, 0.82);

    const core = addMesh(modelRoot, new THREE.OctahedronGeometry(echo ? 0.44 : 0.38, 0), red, [0, 2.55, 1.15]);
    const coreRing = addMesh(modelRoot, new THREE.TorusGeometry(0.62, 0.105, 8, 20), edgeMetal, [0, 2.55, 1.03]);
    for (let index = 0; index < 8; index++) {
        const angle = index / 8 * Math.PI * 2;
        addMesh(
            modelRoot,
            new THREE.ConeGeometry(0.09, 0.42, 4),
            edgeMetal,
            [Math.cos(angle) * 0.74, 2.55 + Math.sin(angle) * 0.74, 1.0],
            [0, 0, -angle - Math.PI / 2]
        );
    }
    const coreLight = new THREE.PointLight(echo ? 0xff2f73 : 0xff1838, echo ? 18 : 13, 8);
    coreLight.position.set(0, 2.55, 1.5);
    modelRoot.add(coreLight);

    const head = new THREE.Group();
    head.position.set(0, 3.93, 0.03);
    modelRoot.add(head);
    const helmet = track(addMesh(head, new THREE.IcosahedronGeometry(0.72, 1), darkArmor, [0, 0, 0]));
    helmet.scale.set(0.95, 1.08, 0.86);
    const brow = track(addMesh(head, new THREE.DodecahedronGeometry(0.55, 0), armor, [0, 0.13, 0.48]));
    brow.scale.set(1.18, 0.42, 0.28);
    const face = track(addMesh(head, new THREE.DodecahedronGeometry(0.52, 0), armor, [0, -0.18, 0.5]));
    face.scale.set(0.92, 0.82, 0.28);
    const visor = addMesh(head, new THREE.BoxGeometry(0.86, 0.13, 0.06), voidMaterial, [0, 0.01, 0.75]);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: echo ? 0xff5d96 : 0xff304f });
    addMesh(head, new THREE.OctahedronGeometry(0.095, 0), eyeMaterial, [-0.23, 0.01, 0.8]).scale.set(1.6, 0.62, 0.4);
    addMesh(head, new THREE.OctahedronGeometry(0.095, 0), eyeMaterial, [0.23, 0.01, 0.8]).scale.set(1.6, 0.62, 0.4);
    visor.renderOrder = 1;

    const hornCount = echo ? 3 : 2;
    for (const side of [-1, 1]) {
        for (let index = 0; index < hornCount; index++) {
            const horn = track(addMesh(
                head,
                new THREE.ConeGeometry(0.18 - index * 0.018, (echo ? 1.42 : 1.12) - index * 0.13, 5),
                index === 0 ? armor : darkArmor,
                [side * (0.38 + index * 0.22), 0.55 + index * 0.17, -0.02],
                [-0.12, 0, side * (-0.38 - index * 0.16)]
            ));
            horn.scale.z = 0.82;
        }
    }

    const arms = {};
    for (const [side, name] of [[-1, 'left'], [1, 'right']]) {
        const arm = new THREE.Group();
        arm.position.set(side * (echo ? 1.46 : 1.34), 3.08, 0);
        modelRoot.add(arm);
        const pauldron = track(addMesh(arm, new THREE.DodecahedronGeometry(0.76, 0), armor, [side * 0.12, 0, 0]));
        pauldron.scale.set(1.38, 0.72, 1.06);
        const shoulderBlade = track(addMesh(arm, new THREE.ConeGeometry(0.27, 1.18, 5), darkArmor, [side * 0.58, 0.35, -0.08], [0, 0, side * -0.72]));
        shoulderBlade.scale.z = 0.72;
        const upperArm = track(addMesh(arm, new THREE.CylinderGeometry(0.38, 0.5, 1.18, 6), darkArmor, [side * 0.13, -0.82, 0]));
        upperArm.rotation.z = side * -0.08;
        const elbow = track(addMesh(arm, new THREE.DodecahedronGeometry(0.46, 0), edgeMetal, [side * 0.18, -1.48, 0.02]));
        elbow.scale.set(1.05, 0.78, 0.9);
        const forearm = track(addMesh(arm, new THREE.CylinderGeometry(0.5, 0.34, 1.28, 6), armor, [side * 0.22, -2.03, 0.12]));
        forearm.rotation.z = side * -0.06;
        const vambrace = track(addMesh(arm, new THREE.OctahedronGeometry(0.48, 0), darkArmor, [side * 0.25, -1.92, 0.4]));
        vambrace.scale.set(0.8, 1.22, 0.38);
        const fist = track(addMesh(arm, new THREE.DodecahedronGeometry(0.62, 0), darkArmor, [side * 0.27, -2.73, 0.22]));
        fist.scale.set(1.1, 0.9, 1.22);
        for (let knuckle = -1; knuckle <= 1; knuckle++) {
            const spike = track(addMesh(
                arm,
                new THREE.ConeGeometry(0.075, echo ? 0.58 : 0.4, 4),
                edgeMetal,
                [side * (0.27 + knuckle * 0.08), -3.12, 0.08 + knuckle * 0.17],
                [0, 0, Math.PI]
            ));
            spike.rotation.x = knuckle * 0.08;
        }
        if (echo) fractureParts.push(pauldron, vambrace);
        arms[name] = arm;
    }

    const legs = {};
    for (const [side, name] of [[-1, 'left'], [1, 'right']]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.58, 1.2, 0);
        modelRoot.add(leg);
        const thigh = track(addMesh(leg, new THREE.CylinderGeometry(0.43, 0.54, 1.15, 6), darkArmor, [0, -0.55, 0]));
        thigh.rotation.z = side * 0.035;
        const knee = track(addMesh(leg, new THREE.DodecahedronGeometry(0.46, 0), edgeMetal, [0, -1.15, 0.15]));
        knee.scale.set(0.92, 0.72, 1.08);
        track(addMesh(leg, new THREE.CylinderGeometry(0.52, 0.37, 1.12, 6), armor, [0, -1.68, 0.06]));
        const greave = track(addMesh(leg, new THREE.OctahedronGeometry(0.45, 0), darkArmor, [0, -1.66, 0.43]));
        greave.scale.set(0.78, 1.18, 0.42);
        const boot = track(addMesh(leg, new THREE.DodecahedronGeometry(0.58, 0), armor, [0, -2.3, 0.3]));
        boot.scale.set(1.06, 0.62, 1.48);
        if (echo) fractureParts.push(greave);
        legs[name] = leg;
    }

    for (const side of [-1, 1]) {
        for (let index = 0; index < 3; index++) {
            track(addMesh(
                modelRoot,
                new THREE.ConeGeometry(0.16 - index * 0.02, 0.86 - index * 0.09, 5),
                darkArmor,
                [side * (0.66 + index * 0.34), 3.52 - index * 0.2, -0.54],
                [Math.PI / 2.8, 0, side * (-0.18 - index * 0.13)]
            ));
        }
    }

    const crackSpecs = echo
        ? [[-0.42, 3.0, 1.05, 0.35, 0.04], [0.3, 2.27, 1.04, -0.5, 0.03], [-1.62, 1.75, 0.55, 0.25, 0.03], [1.72, 0.92, 0.54, -0.3, 0.03]]
        : [[-0.36, 3.02, 1.04, 0.28, 0.025], [0.38, 2.14, 1.04, -0.42, 0.022]];
    crackSpecs.forEach(([x, y, z, rotation, width]) => {
        const crack = addMesh(modelRoot, new THREE.TetrahedronGeometry(0.2, 0), red, [x, y, z], [0, 0, rotation]);
        crack.scale.set(width, 1.8, 0.18);
    });

    if (echo) {
        chestPlates.forEach((part, index) => {
            part.position.x += (index % 2 ? 1 : -1) * (0.1 + index * 0.018);
            part.position.y += Math.sin(index * 1.7) * 0.12;
            part.rotation.z += (index % 2 ? 1 : -1) * (0.08 + index * 0.018);
            part.userData.basePosition.copy(part.position);
            part.userData.baseRotation.copy(part.rotation);
            fractureParts.push(part);
        });
        const fragmentSpecs = [
            [-2.05, 3.5, 0.1, 0.42], [2.16, 3.28, -0.05, 0.5],
            [-1.82, 2.35, 0.48, 0.3], [1.98, 1.95, 0.35, 0.34],
            [-1.22, 0.82, 0.22, 0.28], [1.34, 0.56, 0.18, 0.32],
            [-0.62, 4.92, 0.03, 0.24], [0.86, 4.75, -0.02, 0.27]
        ];
        fragmentSpecs.forEach(([x, y, z, size], index) => {
            fractureParts.push(track(addMesh(
                modelRoot,
                index % 2 ? new THREE.TetrahedronGeometry(size, 0) : new THREE.DodecahedronGeometry(size, 0),
                index % 3 ? armor : darkArmor,
                [x, y, z],
                [index * 0.31, index * 0.47, index * 0.19]
            )));
        });
    }

    const summonMaterial = red.clone();
    summonMaterial.transparent = true;
    summonMaterial.opacity = 0.78;
    summonMaterial.depthWrite = false;
    const summonRing = addMesh(
        group,
        new THREE.TorusGeometry(2.2, 0.07, 8, 48),
        summonMaterial,
        [0, 0.08, 0],
        [Math.PI / 2, 0, 0]
    );
    summonRing.visible = false;

    const particles = [];
    for (let index = 0; index < (echo ? 24 : 14); index++) {
        particles.push(addMesh(
            group,
            new THREE.OctahedronGeometry(0.05 + index % 3 * 0.025, 0),
            red,
            [0, 0, 0]
        ));
    }

    return {
        kind: echo ? 'echo' : 'blood',
        group,
        modelRoot,
        visualBaseY,
        head,
        arms,
        legs,
        core,
        coreRing,
        coreLight,
        summonRing,
        particles,
        echoParts,
        fractureParts,
        fracturePartSet: new Set(fractureParts),
        chestPlates
    };
}
