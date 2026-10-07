'use strict';

const VERTEX_SHADER_SRC = `#version 300 es
in vec4 aPosition;
in vec4 aNormal;
in vec2 aTexCoord;

uniform mat4 uMVP;
uniform mat4 uModelMatrix;
uniform mat4 uNormalMatrix;
uniform mat4 uLightSpaceMatrix;

out vec4 vWorldPos;
out vec3 vNormal;
out vec2 vTexCoord;
out vec4 vLightSpacePos;

void main() {
    vWorldPos = uModelMatrix * aPosition;
    vNormal   = normalize(vec3(uNormalMatrix * vec4(aNormal.xyz, 0.0)));
    vTexCoord = aTexCoord;
    vLightSpacePos = uLightSpaceMatrix * vWorldPos;
    gl_Position = uMVP * aPosition;
}`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision mediump float;

in vec4 vWorldPos;
in vec3 vNormal;
in vec2 vTexCoord;
in vec4 vLightSpacePos;

uniform vec4 uEyePosition;
uniform vec4 uLightPosition;
uniform vec4 uLightDiffuseColor;
uniform vec4 uLightSpecularColor;

uniform vec4  uMaterialDiffuseColor;
uniform vec4  uMaterialSpecularColor;
uniform float uSpecularPower;

uniform sampler2D uTexture;
uniform float     uUseTexture;

uniform sampler2D uShadowMap;
uniform float     uShadowBias;
uniform float     uShadowsEnabled;

out vec4 outColor;

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightPosition.xyz - vWorldPos.xyz);
    vec3 V = normalize(uEyePosition.xyz   - vWorldPos.xyz);
    vec3 H = normalize(L + V);

    vec4 baseColor = uMaterialDiffuseColor;
    if (uUseTexture > 0.5) {
        vec4 texColor = texture(uTexture, vTexCoord);
        baseColor = vec4(texColor.rgb * uMaterialDiffuseColor.rgb, uMaterialDiffuseColor.a);
    }

    float shadow = 0.0;
    if (uShadowsEnabled > 0.5) {
        vec3 projCoords = vLightSpacePos.xyz / vLightSpacePos.w;
        projCoords = projCoords * 0.5 + 0.5;

        if (projCoords.z > 0.0 && projCoords.z < 1.0) {
            float closestDepth = texture(uShadowMap, projCoords.xy).r;
            float currentDepth = projCoords.z;
            if (currentDepth - uShadowBias > closestDepth) {
                shadow = 1.0;
            }
        }
    }

    vec3 ambient  = 0.05 * uLightDiffuseColor.rgb * baseColor.rgb;
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), uSpecularPower);

    float s = (shadow > 0.5) ? 0.35 : 1.0;
    vec3 diffuse  = s * diff * uLightDiffuseColor.rgb * baseColor.rgb;
    vec3 specular = s * spec * uLightSpecularColor.rgb * uMaterialSpecularColor.rgb;

    outColor = vec4(ambient + diffuse + specular, baseColor.a);
}`;

let gl, program;
let canvas;
const loc = {};
const meshCache = {};
let lastTime = 0;
let shadowBias = 0.0006;
let shadowsEnabled = true;

// Create and compile a shader
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader compile error:\n' + log);
    }
    return shader;
}

// Link vertex + fragment shaders into a program
function createProgram(gl, vsSrc, fsSrc) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link error:\n' + gl.getProgramInfoLog(prog));
    }
    return prog;
}

// Upload mesh data to GPU and store in meshCache
function uploadMesh(name, meshObj) {
    if (meshCache[name]) return;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, meshObj.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc.aPosition);
    gl.vertexAttribPointer(loc.aPosition, 4, gl.FLOAT, false, 0, 0);

    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, meshObj.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc.aNormal);
    gl.vertexAttribPointer(loc.aNormal, 4, gl.FLOAT, false, 0, 0);

    if (meshObj.texcoords) {
        const tcBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tcBuf);
        gl.bufferData(gl.ARRAY_BUFFER, meshObj.texcoords, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc.aTexCoord);
        gl.vertexAttribPointer(loc.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    }

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshObj.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    meshCache[name] = { vao, indexCount: meshObj.indices.length, hasTex: !!meshObj.texcoords };
}

// Draw a mesh with material and optional texture
function drawMesh(name, modelMat, material, texture = null) {
    const entry = meshCache[name];
    if (!entry) { console.warn('drawMesh: mesh not found:', name); return; }

    const view = glMatrix.mat4.create();
    glMatrix.mat4.lookAt(view, camera.eye, camera.center, camera.up);

    const proj = glMatrix.mat4.create();
    glMatrix.mat4.perspective(proj, 45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 200.0);

    const mvp = glMatrix.mat4.create();
    glMatrix.mat4.multiply(mvp, proj, view);
    glMatrix.mat4.multiply(mvp, mvp, modelMat);

    const normalMat = glMatrix.mat4.create();
    glMatrix.mat4.invert(normalMat, modelMat);
    glMatrix.mat4.transpose(normalMat, normalMat);

    gl.uniformMatrix4fv(loc.uMVP, false, mvp);
    gl.uniformMatrix4fv(loc.uModelMatrix, false, modelMat);
    gl.uniformMatrix4fv(loc.uNormalMatrix, false, normalMat);

    gl.uniform4fv(loc.uEyePosition, new Float32Array([camera.eye[0], camera.eye[1], camera.eye[2], 1.0]));
    gl.uniform4fv(loc.uLightPosition, new Float32Array(LIGHT_PROPERTIES.position));
    gl.uniform4fv(loc.uLightDiffuseColor, new Float32Array(LIGHT_PROPERTIES.color));
    gl.uniform4fv(loc.uLightSpecularColor, new Float32Array(LIGHT_PROPERTIES.color));

    gl.uniform4fv(loc.uMaterialDiffuseColor, new Float32Array(material.diffuse));
    gl.uniform4fv(loc.uMaterialSpecularColor, new Float32Array(material.specular));
    gl.uniform1f(loc.uSpecularPower, material.shininess);

    const useTex = (texture && entry.hasTex) ? 1.0 : 0.0;
    gl.uniform1f(loc.uUseTexture, useTex);
    if (texture && entry.hasTex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(loc.uTexture, 0);
    } else {
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    gl.bindVertexArray(entry.vao);
    gl.drawElements(gl.TRIANGLES, entry.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
}

// Draw mesh during shadow pass using depth-only program
function drawMeshForShadow(name, lightMVP) {
    const entry = meshCache[name];
    if (!entry) return;

    const shadowProg = window.getShadowProgram ? window.getShadowProgram() : null;
    const sLoc = window.getShadowLoc ? window.getShadowLoc() : {};
    if (!shadowProg || sLoc.uLightMVP === null) return;

    gl.useProgram(shadowProg);
    gl.uniformMatrix4fv(sLoc.uLightMVP, false, lightMVP);

    gl.bindVertexArray(entry.vao);
    gl.drawElements(gl.TRIANGLES, entry.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.useProgram(program);
}

// Build model matrix and draw object
function drawObject(mesh, translate, rotate, scale, material, texture = null) {
    const m = createTransformMatrix(translate, rotate, scale);
    drawMesh(mesh, m, material, texture);
}

const MAT = {
    ground:      { diffuse: [0.90, 0.90, 0.92, 1], specular: [0.15, 0.15, 0.15, 1], shininess: 12 },
    wood:        { diffuse: [0.78, 0.58, 0.32, 1], specular: [0.2, 0.2, 0.1, 1], shininess: 16 },
    platformWood:{ diffuse: [0.85, 0.68, 0.40, 1], specular: [0.15, 0.15, 0.1, 1], shininess: 12 },
    pole:        { diffuse: [0.99, 0.99, 0.98, 1], specular: [0.35, 0.35, 0.35, 1], shininess: 22 },
    fur:         { diffuse: [0.92, 0.92, 0.88, 1], specular: [0.25, 0.25, 0.22, 1], shininess: 10 },
    furHead:     { diffuse: [0.60, 0.60, 0.60, 1], specular: [0.25, 0.25, 0.22, 1], shininess: 10 },
    ear:         { diffuse: [0.92, 0.70, 0.65, 1], specular: [0.15,0.1, 0.1, 1], shininess: 8 },
    paw:         { diffuse: [0.92, 0.92, 0.88, 1], specular: [0.2, 0.2, 0.18, 1], shininess: 10 },
    tail:        { diffuse: [0.88, 0.88, 0.84, 1], specular: [0.2, 0.2, 0.18, 1], shininess: 10 },
    bowl:        { diffuse: [0.25, 0.45, 0.80, 1], specular: [0.6, 0.6, 0.8, 1], shininess: 64 },
    toy:         { diffuse: [0.75, 0.20, 0.20, 1], specular: [0.3, 0.1, 0.1, 1], shininess: 16 },
    mouseBlue:   { diffuse: [0.1, 0.6, 0.9, 1], specular: [0.3, 0.4, 0.6, 1], shininess: 18 },
    mouseGreen:  { diffuse: [0.5, 0.85, 0.7, 1], specular: [0.35, 0.5, 0.35, 1], shininess: 16 },
    perch:       { diffuse: [0.75, 0.75, 0.75, 1], specular: [0.4, 0.4, 0.4, 1], shininess: 24 },
    bowlMetal:   { diffuse: [0.78, 0.80, 0.85, 1], specular: [0.95, 0.95, 1.0, 1], shininess: 96 },
    water:       { diffuse: [0.15, 0.35, 0.75, 1], specular: [0.4, 0.6, 0.9, 1], shininess: 32 },
    kibble:      { diffuse: [0.85, 0.55, 0.20, 1], specular: [0.2, 0.15, 0.1, 1], shininess: 8 },
    cardboard:   { diffuse: [0.9, 0.80, 0.6, 1], specular: [0.08, 0.08, 0.05, 1], shininess: 5 },
};

// Draw ground plane
function drawGround() {
    drawObject('ground', [0, 0, 0], [0, 0, 0], [1, 1, 1], MAT.ground, TEX.stoneTiles || null);
}

// Draw cat tree (posts + platforms)
function drawCatTree() {
    const cx = 2.0, cz = 0.0;

    drawObject('cube', [cx + 0.1, 0.025, cz + 0.05], [0, 0, 0], [1.55, 0.05, 1.45], MAT.platformWood, TEX.platform);

    const posts = [
        { x: cx - 0.5, z: cz - 0.5, h: 2.0 },
        { x: cx + 0.7, z: cz - 0.5, h: 2.8 },
        { x: cx + 0.1, z: cz + 0.6, h: 1.6 },
    ];
    for (const p of posts) {
        drawObject('cylinder', [p.x, p.h * 0.5, p.z], [0, 0, 0], [0.12, p.h, 0.12], MAT.pole, TEX.sisalRope);
    }

    const platforms = [
        { x: cx - 0.5, z: cz - 0.5, y: posts[0].h + 0.04 },
        { x: cx + 0.7, z: cz - 0.5, y: posts[1].h + 0.04 },
        { x: cx + 0.1, z: cz + 0.6, y: posts[2].h + 0.04 },
        { x: cx + 0.45, z: cz - 0.5, y: 1.2 },
    ];
    for (const pl of platforms) {
        drawObject('cube', [pl.x, pl.y, pl.z], [0, 0, 0], [0.70, 0.08, 0.70], MAT.platformWood, TEX.platform);
    }
}

// Draw full hierarchical cat
function drawCat() {
    const furTex = TEX.tabby || null;
    drawMesh('catBody', getCatPartModelMatrix('body'), MAT.fur, furTex);
    drawMesh('sphere', getCatPartModelMatrix('head'), MAT.furHead, null);
    drawMesh('cube', getCatPartModelMatrix('earL'), MAT.ear, null);
    drawMesh('cube', getCatPartModelMatrix('earR'), MAT.ear, null);
    drawMesh('cylinder', getCatPartModelMatrix('tail'), MAT.tail, furTex);
    drawMesh('cylinder', getCatPartModelMatrix('legFL'), MAT.fur, furTex);
    drawMesh('cylinder', getCatPartModelMatrix('legFR'), MAT.fur, furTex);
    drawMesh('cylinder', getCatPartModelMatrix('legBL'), MAT.fur, furTex);
    drawMesh('cylinder', getCatPartModelMatrix('legBR'), MAT.fur, furTex);
    drawMesh('sphere', getCatPartModelMatrix('pawFL'), MAT.paw, null);
    drawMesh('sphere', getCatPartModelMatrix('pawFR'), MAT.paw, null);
    drawMesh('sphere', getCatPartModelMatrix('pawBL'), MAT.paw, null);
    drawMesh('sphere', getCatPartModelMatrix('pawBR'), MAT.paw, null);
}

// Draw water bowl
function drawFoodBowl() {
    const bx = -2.05, bz = 0.75;
    drawObject('tube', [bx, 0.055, bz], [0, 0, 0], [1, 1, 1], MAT.bowlMetal, TEX.metal1);
    drawObject('cylinder', [bx, 0.03, bz], [0, 0, 0], [0.35, 0.06, 0.35], MAT.water);
}

// Draw kibble bowl + kibbles
function drawKibbleBowl() {
    const bx = -2.05, bz = 0.3;
    drawObject('tube', [bx, 0.055, bz], [0, 0, 0], [1, 1, 1], MAT.bowlMetal, TEX.metal1);
    drawObject('cylinder', [bx, 0.02, bz], [0, 0, 0], [0.35, 0.04, 0.35], MAT.bowlMetal, TEX.metal1);

    const kibblePositions = [
        { dx: 0.00, dz: 0.00, y: 0.03, s: 0.038 }, { dx: 0.05, dz: 0.03, y: 0.03, s: 0.036 },
        { dx: -0.04, dz: 0.05, y: 0.03, s: 0.037 }, { dx: 0.06, dz: -0.04, y: 0.03, s: 0.035 },
        { dx: -0.05, dz: -0.03, y: 0.03, s: 0.036 }, { dx: 0.02, dz: 0.07, y: 0.03, s: 0.035 },
        { dx: -0.07, dz: 0.02, y: 0.035, s: 0.034 }, { dx: 0.07, dz: 0.01, y: 0.035, s: 0.035 },
        { dx: -0.01, dz: -0.07, y: 0.035, s: 0.034 }, { dx: 0.04, dz: -0.06, y: 0.03, s: 0.036 },
        { dx: -0.06, dz: 0.04, y: 0.04, s: 0.033 }, { dx: 0.03, dz: 0.06, y: 0.04, s: 0.034 },
    ];
    for (const k of kibblePositions) {
        drawObject('sphere', [bx + k.dx, k.y || 0.03, bz + k.dz], [0, 0, 0], [k.s, k.s, k.s], MAT.kibble, null);
    }
}

// Draw toy mice
function drawToyMice() {
    const mice = [
        { x: 1.2, z: 1.4, mat: MAT.mouseBlue },
        { x: 1.5, z: 1.8, mat: MAT.mouseGreen },
    ];
    for (const m of mice) {
        drawObject('sphere', [m.x, 0.03, m.z], [0, 0, 0], [0.08, 0.06, 0.11], m.mat, TEX.fur);
        drawObject('cylinder', [m.x, 0.025, m.z - 0.12], [90, 0, 0], [0.0065, 0.18, 0.0065], m.mat, TEX.fur);
    }
}

// Draw cardboard box
function drawCardboardBox() {
    drawObject('cube', [-1.75, 0.35, -1.25], [0, 0, 0], [0.9, 0.7, 0.85], MAT.cardboard, TEX.box1);
}

// Build model matrix for shadow pass and draw
function drawObjectForShadow(meshName, translate, rotate, scale, lightMVP) {
    const model = createTransformMatrix(translate, rotate, scale);
    const fullLightMVP = glMatrix.mat4.create();
    glMatrix.mat4.multiply(fullLightMVP, lightMVP, model);
    drawMeshForShadow(meshName, fullLightMVP);
}

// Shadow pass for cat
function drawCatForShadow(lightMVP) {
    const bodyM = getCatPartModelMatrix('body');
    drawMeshForShadow('catBody', glMatrix.mat4.multiply(glMatrix.mat4.create(), lightMVP, bodyM));

    const headM = getCatPartModelMatrix('head');
    drawMeshForShadow('sphere', glMatrix.mat4.multiply(glMatrix.mat4.create(), lightMVP, headM));

    const tailM = getCatPartModelMatrix('tail');
    drawMeshForShadow('cylinder', glMatrix.mat4.multiply(glMatrix.mat4.create(), lightMVP, tailM));

    ['legFL','legFR','legBL','legBR'].forEach(l => {
        const m = getCatPartModelMatrix(l);
        drawMeshForShadow('cylinder', glMatrix.mat4.multiply(glMatrix.mat4.create(), lightMVP, m));
    });
}

// Shadow pass for water bowl
function drawFoodBowlForShadow(lightMVP) {
    const m = createTransformMatrix([-2.05, 0.055, 0.75], [0,0,0], [1,1,1]);
    const full = glMatrix.mat4.create();
    glMatrix.mat4.multiply(full, lightMVP, m);
    drawMeshForShadow('tube', full);
    drawObjectForShadow('cylinder', [-2.05, 0.03, 0.75], [0,0,0], [0.35, 0.06, 0.35], lightMVP);
}

// Shadow pass for kibble bowl
function drawKibbleBowlForShadow(lightMVP) {
    const m = createTransformMatrix([-2.05, 0.055, 0.3], [0,0,0], [1,1,1]);
    const full = glMatrix.mat4.create();
    glMatrix.mat4.multiply(full, lightMVP, m);
    drawMeshForShadow('tube', full);
    drawObjectForShadow('cylinder', [-2.05, 0.02, 0.3], [0,0,0], [0.35, 0.04, 0.35], lightMVP);
}

// Shadow pass for toy mice
function drawToyMiceForShadow(lightMVP) {
    let m1 = createTransformMatrix([1.2, 0.03, 1.4], [0,0,0], [0.08,0.06,0.11]);
    let f1 = glMatrix.mat4.create(); glMatrix.mat4.multiply(f1, lightMVP, m1);
    drawMeshForShadow('sphere', f1);

    let m2 = createTransformMatrix([1.5, 0.03, 1.8], [0,0,0], [0.08,0.06,0.11]);
    let f2 = glMatrix.mat4.create(); glMatrix.mat4.multiply(f2, lightMVP, m2);
    drawMeshForShadow('sphere', f2);
}

// Shadow pass for cardboard box
function drawCardboardBoxForShadow(lightMVP) {
    const m = createTransformMatrix([-1.75, 0.35, -1.25], [0,0,0], [0.9,0.7,0.85]);
    const full = glMatrix.mat4.create();
    glMatrix.mat4.multiply(full, lightMVP, m);
    drawMeshForShadow('cube', full);
}


function _slider(id)    { return document.getElementById(id); }
function _sliderVal(id) { return document.getElementById(id + 'Val'); }
function sliderVal(id)  { return parseFloat(_slider(id).value); }

// Setup all UI sliders and controls
function setupUIControls() {
    ['eyeX','eyeY','eyeZ','centerX','centerY','centerZ','upX','upY','upZ'].forEach(id => {
        const el = _slider(id);
        if (!el) return;
        el.addEventListener('input', () => {
            _sliderVal(id).textContent = parseFloat(el.value).toFixed(1);
            camera.eye[0]    = sliderVal('eyeX');
            camera.eye[1]    = sliderVal('eyeY');
            camera.eye[2]    = sliderVal('eyeZ');
            camera.center[0] = sliderVal('centerX');
            camera.center[1] = sliderVal('centerY');
            camera.center[2] = sliderVal('centerZ');
        });
    });

    const catXEl = _slider('catX');
    const catYEl = _slider('catY');
    const catZEl = _slider('catZ');

    function syncCatSliders() {
        if (catXEl) { _sliderVal('catX').textContent = parseFloat(catXEl.value).toFixed(1); scene.catRoot.translate[0] = parseFloat(catXEl.value); }
        if (catYEl) { _sliderVal('catY').textContent = parseFloat(catYEl.value).toFixed(1); scene.catRoot.translate[1] = parseFloat(catYEl.value); }
        if (catZEl) { _sliderVal('catZ').textContent = parseFloat(catZEl.value).toFixed(1); scene.catRoot.translate[2] = parseFloat(catZEl.value); }
    }

    window.updateCatYSlider = function(y) {
        if (catYEl) catYEl.value = y.toFixed(2);
        const val = _sliderVal('catY');
        if (val) val.textContent = y.toFixed(2);
    };

    if (catXEl) catXEl.addEventListener('input', syncCatSliders);
    if (catYEl) catYEl.addEventListener('input', syncCatSliders);
    if (catZEl) catZEl.addEventListener('input', syncCatSliders);

    syncCatSliders();

    const btnAnim  = document.getElementById('btnToggleAnim');
    const animSpan = document.getElementById('animStatus');
    function updateAnimStatus() {
        if (animSpan) animSpan.textContent = 'Animation: ' + (scene.animation.isAnimating ? 'ON' : 'OFF');
    }
    function toggleAnimAndLight() {
        const isNow = toggleCatAnimation();
        if (window.setLightAnimation) window.setLightAnimation(isNow);
        updateAnimStatus();
        return isNow;
    }
    if (btnAnim) {
        btnAnim.addEventListener('click', toggleAnimAndLight);
    }
    canvas.addEventListener('click', toggleAnimAndLight);

    const chkShadows = document.getElementById('chkShadows');
    if (chkShadows) {
        chkShadows.addEventListener('change', () => { shadowsEnabled = chkShadows.checked; });
        shadowsEnabled = chkShadows.checked;
    }
}

// Initialize WebGL, shaders, textures, meshes, controls
async function init() {
    canvas = document.querySelector('#output');
    if (!canvas) { console.error('Canvas #output not found'); return; }

    gl = canvas.getContext('webgl2', { depth: true });
    if (!gl) { console.error('WebGL2 not supported'); return; }

    program = createProgram(gl, VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC);
    gl.useProgram(program);

    loc.aPosition = gl.getAttribLocation(program, 'aPosition');
    loc.aNormal   = gl.getAttribLocation(program, 'aNormal');
    loc.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');

    ['uMVP', 'uModelMatrix', 'uNormalMatrix', 'uEyePosition',
     'uLightPosition', 'uLightDiffuseColor', 'uLightSpecularColor',
     'uMaterialDiffuseColor', 'uMaterialSpecularColor', 'uSpecularPower',
     'uTexture', 'uUseTexture', 'uShadowMap', 'uLightSpaceMatrix',
     'uShadowBias', 'uShadowsEnabled'].forEach(name => {
        loc[name] = gl.getUniformLocation(program, name);
    });

    setLightingProgram(program);
    await initTextures(gl);
    if (window.initShadows) window.initShadows(gl);

    uploadMesh('cube', makeCube(1.0));
    uploadMesh('sphere', makeSphere(0.5, 28, 18));
    uploadMesh('cylinder', makeCylinder(0.5, 1.0, 28));

    const catBodyMesh = makeCylinder(0.5, 1.0, 28);
    if (window.generateCylinderTexcoords) {
        window.generateCylinderTexcoords(catBodyMesh, 1.0, 1.0, 1.0, -0.25);
    }
    uploadMesh('catBody', catBodyMesh);

    uploadMesh('tube', makeTube(0.19, 0.175, 0.11, 32));
    uploadMesh('ground', makeGround(12.0));

    initCamera(4.0, 1.0, 60.0);
    setupUIControls();
    setupLightingSliders();

    gl.clearColor(0.12, 0.16, 0.22, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    lastTime = performance.now();
    requestAnimationFrame(render);
}

// Main render loop: shadow pass + main pass
function render(now) {
    const deltaTime = Math.min((now - lastTime) / 1000.0, 0.1);
    lastTime = now;

    updateCatAnimation(deltaTime);
    if (window.updateLightColorAnimation) window.updateLightColorAnimation(deltaTime);

    const lightPos = LIGHT_PROPERTIES.position.slice(0, 3);
    if (window.updateLightSpaceMatrices) window.updateLightSpaceMatrices(lightPos);
    const lightSpace = window.lightSpaceMatrix || null;

    // PASS 1: Shadow map
    if (shadowsEnabled && window.bindShadowFramebuffer && window.unbindShadowFramebuffer) {
        window.bindShadowFramebuffer(gl);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        const lmvp = lightSpace || glMatrix.mat4.create();

        drawObjectForShadow('ground', [0,0,0], [0,0,0], [1,1,1], lmvp);
        drawObjectForShadow('cube', [2.0+0.1,0.025,0.0+0.05], [0,0,0], [1.55,0.05,1.45], lmvp);
        drawObjectForShadow('cylinder', [2.0-0.5,1.0,0.0-0.5], [0,0,0], [0.12,2.0,0.12], lmvp);
        drawObjectForShadow('cylinder', [2.0+0.7,1.4,0.0-0.5], [0,0,0], [0.12,2.8,0.12], lmvp);
        drawObjectForShadow('cylinder', [2.0+0.1,0.8,0.0+0.6], [0,0,0], [0.12,1.6,0.12], lmvp);
        drawObjectForShadow('cube', [2.0-0.5,2.04,0.0-0.5], [0,0,0], [0.70,0.08,0.70], lmvp);
        drawObjectForShadow('cube', [2.0+0.7,2.84,0.0-0.5], [0,0,0], [0.70,0.08,0.70], lmvp);
        drawObjectForShadow('cube', [2.0+0.1,1.64,0.0+0.6], [0,0,0], [0.70,0.08,0.70], lmvp);
        drawObjectForShadow('cube', [2.45,1.2,0.0-0.5], [0,0,0], [0.70,0.08,0.70], lmvp);

        drawCatForShadow(lmvp);
        drawFoodBowlForShadow(lmvp);
        drawKibbleBowlForShadow(lmvp);
        drawToyMiceForShadow(lmvp);
        drawCardboardBoxForShadow(lmvp);

        window.unbindShadowFramebuffer(gl, canvas);
        gl.enable(gl.CULL_FACE);
    }

    // PASS 2: Main render
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(program);

    if (loc.uShadowsEnabled !== null) {
        gl.uniform1f(loc.uShadowsEnabled, shadowsEnabled ? 1.0 : 0.0);
    }

    if (shadowsEnabled) {
        const shadowTex = window.getShadowDepthTexture ? window.getShadowDepthTexture() : null;
        if (shadowTex && loc.uShadowMap !== null) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, shadowTex);
            gl.uniform1i(loc.uShadowMap, 1);
        }
        if (lightSpace && loc.uLightSpaceMatrix) {
            gl.uniformMatrix4fv(loc.uLightSpaceMatrix, false, lightSpace);
        }
        if (loc.uShadowBias) gl.uniform1f(loc.uShadowBias, shadowBias);
    }

    drawGround();
    drawCatTree();
    drawCat();
    drawFoodBowl();
    drawKibbleBowl();
    drawToyMice();
    drawCardboardBox();

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);

    requestAnimationFrame(render);
}

window.addEventListener('load', init);
