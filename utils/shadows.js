'use strict';

let shadowFBO = null;
let shadowDepthTexture = null;
let shadowMapSize = 1024;

let lightViewMatrix = null;
let lightProjMatrix = null;
let lightSpaceMatrix = null;

let shadowProgram = null;
let shadowLoc = {};

const SHADOW_VERTEX_SRC = `#version 300 es
in vec4 aPosition;
uniform mat4 uLightMVP;
void main() {
    gl_Position = uLightMVP * aPosition;
}`;

const SHADOW_FRAGMENT_SRC = `#version 300 es
precision mediump float;
void main() {
}`;

// Create FBO and depth texture for shadow mapping
function createShadowFramebuffer(gl) {
    shadowDepthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT24,
        shadowMapSize,
        shadowMapSize,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    shadowFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        shadowDepthTexture,
        0
    );

    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Shadow FBO incomplete:', status);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    console.log('%c[shadows] Shadow FBO + depth texture created (' + shadowMapSize + 'x' + shadowMapSize + ')', 'color:#8f8');
}

// Create depth-only shader program for shadow pass
function createShadowProgram(gl) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, SHADOW_VERTEX_SRC);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error('Shadow VS error:', gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, SHADOW_FRAGMENT_SRC);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error('Shadow FS error:', gl.getShaderInfoLog(fs));
    }

    shadowProgram = gl.createProgram();
    gl.attachShader(shadowProgram, vs);
    gl.attachShader(shadowProgram, fs);
    gl.linkProgram(shadowProgram);
    if (!gl.getProgramParameter(shadowProgram, gl.LINK_STATUS)) {
        console.error('Shadow program link error:', gl.getProgramInfoLog(shadowProgram));
    }

    shadowLoc.aPosition = gl.getAttribLocation(shadowProgram, 'aPosition');
    shadowLoc.uLightMVP = gl.getUniformLocation(shadowProgram, 'uLightMVP');

    console.log('%c[shadows] Depth-only shadow program created', 'color:#8f8');
}

// Compute light-space view and projection matrices
function updateLightSpaceMatrices(lightPos) {
    lightViewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.lookAt(lightViewMatrix, lightPos, [0, 0, 0], [0, 1, 0]);

    lightProjMatrix = glMatrix.mat4.create();
    glMatrix.mat4.perspective(lightProjMatrix, (60 * Math.PI) / 180, 1.0, 1.0, 80.0);

    lightSpaceMatrix = glMatrix.mat4.create();
    glMatrix.mat4.multiply(lightSpaceMatrix, lightProjMatrix, lightViewMatrix);

    window.lightSpaceMatrix = lightSpaceMatrix;
}

// Initialize shadow mapping (FBO + shaders)
function initShadows(gl) {
    createShadowFramebuffer(gl);
    createShadowProgram(gl);
    return {
        shadowFBO,
        shadowDepthTexture,
        shadowMapSize,
        getLightSpaceMatrix: () => lightSpaceMatrix,
    };
}

// Bind shadow framebuffer for rendering
function bindShadowFramebuffer(gl) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
    gl.viewport(0, 0, shadowMapSize, shadowMapSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
}

// Restore default framebuffer and viewport
function unbindShadowFramebuffer(gl, canvas) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
}

Object.assign(window, {
    initShadows,
    updateLightSpaceMatrices,
    bindShadowFramebuffer,
    unbindShadowFramebuffer,
    getShadowProgram: () => shadowProgram,
    getShadowLoc: () => shadowLoc,
    getShadowDepthTexture: () => shadowDepthTexture,
});
