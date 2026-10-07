const scene = {
    catRoot: { translate: [0, 0, 0], rotate: [0, 0, 0], scale: [1, 1, 1] },
    cat: {
        body:  { translate: [0, 0.305, 0],      scale: [0.52, 0.74, 0.44], rotate: [90, 0, 0] },
        head:  { translate: [0, 0.485, 0.46],   scale: [0.42, 0.39, 0.42], rotate: [-12, 0, 0] },
        earL:  { translate: [-0.15, 0.655, 0.46], scale: [0.09, 0.12, 0.07], rotate: [0, 0, -18] },
        earR:  { translate: [ 0.15, 0.655, 0.46], scale: [0.09, 0.12, 0.07], rotate: [0, 0,  18] },
        tail:  { translate: [0, 0.285, -0.42],  scale: [0.09, 0.48, 0.09], rotate: [38, 0, 22] },
        legFL: { translate: [-0.20, 0.165,  0.27], scale: [0.105, 0.20, 0.105], rotate: [0, 0, 0] },
        legFR: { translate: [ 0.20, 0.165,  0.27], scale: [0.105, 0.20, 0.105], rotate: [0, 0, 0] },
        legBL: { translate: [-0.20, 0.165, -0.27], scale: [0.105, 0.20, 0.105], rotate: [0, 0, 0] },
        legBR: { translate: [ 0.20, 0.165, -0.27], scale: [0.105, 0.20, 0.105], rotate: [0, 0, 0] },
        pawFL: { translate: [-0.20, 0.045,  0.28], scale: [0.13, 0.09, 0.13], rotate: [0, 0, 0] },
        pawFR: { translate: [ 0.20, 0.045,  0.28], scale: [0.13, 0.09, 0.13], rotate: [0, 0, 0] },
        pawBL: { translate: [-0.20, 0.045, -0.26], scale: [0.13, 0.09, 0.13], rotate: [0, 0, 0] },
        pawBR: { translate: [ 0.20, 0.045, -0.26], scale: [0.13, 0.09, 0.13], rotate: [0, 0, 0] },
    },
animation: {
        time:       0,
        isAnimating: false,
        spinSpeed:  3.0,
        spinAngle:  0,
        headAmp:    12,
        headFreq:   3.5,
        bobAmp:     0.08,
        bobFreq:    4.0,
        bodyBaseScale: [0.52, 0.74, 0.44],
    },
    defaultPose: {
        rootRotationY: 0,
        headRotationY: 0,
    },
};

// Build TRS model matrix (T * Rz * Ry * Rx * S)
function createTransformMatrix(translate, rotate, scale) {
    const m = glMatrix.mat4.create();

    if (translate) {
        glMatrix.mat4.translate(m, m, translate);
    }
    if (rotate) {
        glMatrix.mat4.rotateZ(m, m, glMatrix.glMatrix.toRadian(rotate[2]));
        glMatrix.mat4.rotateY(m, m, glMatrix.glMatrix.toRadian(rotate[1]));
        glMatrix.mat4.rotateX(m, m, glMatrix.glMatrix.toRadian(rotate[0]));
    }
    if (scale) {
        glMatrix.mat4.scale(m, m, scale);
    }
    return m;
}

// Compose world matrix for a cat part relative to catRoot
function getCatPartModelMatrix(partName) {
    const part = scene.cat[partName];
    if (!part) return glMatrix.mat4.create();

    const rootM  = createTransformMatrix(
        scene.catRoot.translate,
        scene.catRoot.rotate,
        scene.catRoot.scale
    );
    const localM = createTransformMatrix(part.translate, part.rotate, part.scale);

    const out = glMatrix.mat4.create();
    glMatrix.mat4.multiply(out, rootM, localM);
    return out;
}

// Advance cat spinning and head wobble animation
function updateCatAnimation(deltaTime) {
    if (!scene.animation.isAnimating) {
        resetCatPose();
        return;
    }

    const anim = scene.animation;
    anim.time += deltaTime;

    anim.spinAngle += anim.spinSpeed * 360 * deltaTime;
    scene.catRoot.rotate[1] = anim.spinAngle % 360;

    anim.headAngle = anim.headAmp * Math.sin(2 * Math.PI * anim.headFreq * anim.time);
    scene.cat.head.rotate[1] = anim.headAngle;

    // Vertical bobbing
    scene.catRoot.translate[1] = anim.bobAmp * (0.5 + 0.5 * Math.sin(2 * Math.PI * anim.bobFreq * anim.time));
    
    // Sync Y slider
    if (window.updateCatYSlider) window.updateCatYSlider(scene.catRoot.translate[1]);
}

// Toggle cat animation on/off
function toggleCatAnimation() {
    const wasAnimating = scene.animation.isAnimating;
    scene.animation.isAnimating = !scene.animation.isAnimating;

    if (!scene.animation.isAnimating) {
        resetCatPose();
    }

    return scene.animation.isAnimating;
}

// Reset cat to default non-animated pose
function resetCatPose() {
    const anim = scene.animation;
    const def  = scene.defaultPose;

    scene.catRoot.rotate[1] = def.rootRotationY;
    scene.cat.head.rotate[1] = def.headRotationY;
    scene.catRoot.translate[1] = 0;

    const baseScale = anim.bodyBaseScale;
    scene.cat.body.scale[0] = baseScale[0];
    scene.cat.body.scale[2] = baseScale[2];

    anim.spinAngle = 0;
    anim.time = 0;
}

Object.assign(window, {
    scene,
    createTransformMatrix,
    getCatPartModelMatrix,
    updateCatAnimation,
    toggleCatAnimation,
    resetCatPose,
});