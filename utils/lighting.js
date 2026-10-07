const LIGHT_PROPERTIES = {
    position: [3.0, 5.0, 5.0, 1.0],
    color:    [1.0, 0.95, 0.8, 1.0],
};

const LIGHT_DEFAULTS = {
    color: [1.0, 0.95, 0.8, 1.0],
};

let _lightingProgram = null;
let _controlsInstalled = false;
let _lightAnimating = false;
let _lightAnimTime = 0;

// Compute normal matrix = transpose(inverse(model))
function normalMatrixFrom(modelMatrix) {
    const nm = glMatrix.mat4.create();
    glMatrix.mat4.invert(nm, modelMatrix);
    glMatrix.mat4.transpose(nm, nm);
    return nm;
}

// Upload Phong lighting + material uniforms for one draw call
function setupLightingUniforms(u) {
    const { gl: _gl, program: _prog } = u;

    const nm = normalMatrixFrom(u.modelMatrix);
    _gl.uniformMatrix4fv(_gl.getUniformLocation(_prog, 'uNormalMatrix'), false, nm);

    _gl.uniform4fv(_gl.getUniformLocation(_prog, 'uMaterialDiffuseColor'),  u.materialDiffuseColor);
    _gl.uniform4fv(_gl.getUniformLocation(_prog, 'uMaterialSpecularColor'), u.materialSpecularColor);
    _gl.uniform1f(_gl.getUniformLocation(_prog, 'uSpecularPower'), u.specularPower);

    const eye = u.eyePosition || null;
    if (eye) {
        _gl.uniform4fv(_gl.getUniformLocation(_prog, 'uEyePosition'),
            new Float32Array([eye[0], eye[1], eye[2], 1.0]));
    }

    const lPos  = u.lightPosition  || LIGHT_PROPERTIES.position;
    const lDiff = u.lightDiffuseColor  || new Float32Array([...LIGHT_PROPERTIES.color]);
    const lSpec = u.lightSpecularColor || lDiff;

    _gl.uniform4fv(_gl.getUniformLocation(_prog, 'uLightPosition'),        lPos);
    _gl.uniform4fv(_gl.getUniformLocation(_prog, 'uLightDiffuseColor'),    lDiff);
    _gl.uniform4fv(_gl.getUniformLocation(_prog, 'uLightSpecularColor'),   lSpec);
}

// Store active shader program reference
function setLightingProgram(program) {
    _lightingProgram = program;
}

// Attach event listeners to all light position and color sliders
function setupLightingSliders() {
    if (_controlsInstalled) return;
    _controlsInstalled = true;

    const posIds = ['lightX', 'lightY', 'lightZ'];
    posIds.forEach((id, i) => {
        const el = document.getElementById(id);
        const val = document.getElementById(id + 'Val');
        el.addEventListener('input', () => {
            const v = parseFloat(el.value);
            LIGHT_PROPERTIES.position[i] = v;
            if (val) val.textContent = v.toFixed(1);
        });
    });

    const colIds = ['lightR', 'lightG', 'lightB'];
    colIds.forEach((id, i) => {
        const el = document.getElementById(id);
        const val = document.getElementById(id + 'Val');
        el.addEventListener('input', () => {
            const v = parseFloat(el.value);
            LIGHT_PROPERTIES.color[i] = v;
            LIGHT_DEFAULTS.color[i] = v;
            if (val) val.textContent = v.toFixed(2);
        });
    });
}

function updateLightColorAnimation(deltaTime) {
    if (!_lightAnimating) return;
    
    _lightAnimTime += deltaTime;
    
    const t = _lightAnimTime;
    LIGHT_PROPERTIES.color[0] = 0.5 + 0.5 * Math.sin(t * 2.0);
    LIGHT_PROPERTIES.color[1] = 0.5 + 0.5 * Math.sin(t * 2.5 + 2.0);
    LIGHT_PROPERTIES.color[2] = 0.5 + 0.5 * Math.sin(t * 3.0 + 4.0);
    
    updateLightColorSliders();
}

function updateLightColorSliders() {
    const colIds = ['lightR', 'lightG', 'lightB'];
    colIds.forEach((id, i) => {
        const el = document.getElementById(id);
        const val = document.getElementById(id + 'Val');
        if (el) el.value = LIGHT_PROPERTIES.color[i].toFixed(2);
        if (val) val.textContent = LIGHT_PROPERTIES.color[i].toFixed(2);
    });
}

function setLightAnimation(enabled) {
    _lightAnimating = enabled;
    if (!enabled) {
        LIGHT_PROPERTIES.color[0] = LIGHT_DEFAULTS.color[0];
        LIGHT_PROPERTIES.color[1] = LIGHT_DEFAULTS.color[1];
        LIGHT_PROPERTIES.color[2] = LIGHT_DEFAULTS.color[2];
        _lightAnimTime = 0;
        updateLightColorSliders();
    } else {
        LIGHT_PROPERTIES.color[0] = 1.0;
        LIGHT_PROPERTIES.color[1] = 0.0;
        LIGHT_PROPERTIES.color[2] = 1.0;
        updateLightColorSliders();
    }
}

Object.assign(window, {
    LIGHT_PROPERTIES,
    LIGHT_DEFAULTS,
    setupLightingUniforms,
    setLightingProgram,
    setupLightingSliders,
    updateLightColorAnimation,
    setLightAnimation,
});
