'use strict';

// Load image as WebGL texture (with file:// fallback)
async function loadTexture(gl, url, options = {}) {
    return new Promise((resolve) => {
        const image = new Image();

        image.onload = () => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);

            try {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                const wrap   = options.wrap   || gl.REPEAT;
                const filter = options.filter || gl.LINEAR;

                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

                gl.generateMipmap(gl.TEXTURE_2D);
            } catch (e) {
                console.warn('%c[textures] file:// security block on ' + url + ' — using solid fallback', 'color:#f88');
                gl.deleteTexture(texture);

                let fbColor = [230, 225, 215, 255];
                if (url.includes('stone_tiles')) fbColor = [160, 160, 162, 255];
                if (url.includes('metal1') || url.includes('metal2')) fbColor = [185, 190, 200, 255];
                if (url.includes('sisal_rope')) fbColor = [245, 240, 230, 255];
                if (url.includes('fur')) fbColor = [200, 180, 150, 255];
                if (url.includes('tabby')) fbColor = [135, 130, 125, 255];

                const fallback = createSolidColorTexture(gl, fbColor);
                resolve(fallback);
                return;
            }

            gl.bindTexture(gl.TEXTURE_2D, null);
            resolve(texture);
        };

        image.onerror = () => {
            let fbColor = [230, 225, 215, 255];
            if (url.includes('stone_tiles')) fbColor = [160, 160, 162, 255];
            if (url.includes('metal1') || url.includes('metal2')) fbColor = [185, 190, 200, 255];
            if (url.includes('sisal_rope')) fbColor = [245, 240, 230, 255];
            if (url.includes('fur')) fbColor = [200, 180, 150, 255];
            if (url.includes('tabby')) fbColor = [135, 130, 125, 255];

            const fallback = createSolidColorTexture(gl, fbColor);
            resolve(fallback);
        };

        image.src = url;
    });
}

// Create 1x1 solid color texture
function createSolidColorTexture(gl, rgba = [255, 255, 255, 255]) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const data = new Uint8Array(rgba);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
}

// Generate box/planar UVs for cube (6 faces)
function generateCubeTexcoords(mesh, repeat = 1.0) {
    const pos = mesh.positions;
    const nVerts = pos.length / 4;
    const uv = new Float32Array(nVerts * 2);

    for (let f = 0; f < 6; f++) {
        const base = f * 4;
        for (let i = 0; i < 4; i++) {
            const idx = base + i;
            const x = pos[idx*4 + 0];
            const y = pos[idx*4 + 1];
            const z = pos[idx*4 + 2];

            let u, v;
            if (f === 0 || f === 1) {
                u = (x + 0.5) * repeat;
                v = (y + 0.5) * repeat;
            } else if (f === 2 || f === 3) {
                u = (x + 0.5) * repeat;
                v = (z + 0.5) * repeat;
            } else {
                u = (z + 0.5) * repeat;
                v = (y + 0.5) * repeat;
            }
            uv[idx*2 + 0] = u;
            uv[idx*2 + 1] = v;
        }
    }
    mesh.texcoords = uv;
    return uv;
}

// Generate cylindrical UVs (u=angle, v=height)
function generateCylinderTexcoords(mesh, height = 1.0, repeatU = 1.0, repeatV = 1.0, uOffset = 0) {
    const pos = mesh.positions;
    const nVerts = pos.length / 4;
    const uv = new Float32Array(nVerts * 2);

    const h = height * 0.5;

    for (let i = 0; i < nVerts; i++) {
        const x = pos[i*4 + 0];
        const y = pos[i*4 + 1];
        const z = pos[i*4 + 2];

        const theta = Math.atan2(z, x);
        let u = (theta + Math.PI) / (2 * Math.PI);
        let v = (y + h) / (2 * h);

        u *= repeatU;
        v *= repeatV;
        u = u - uOffset;
        u = ((u % 1.0) + 1.0) % 1.0;

        uv[i*2 + 0] = u;
        uv[i*2 + 1] = v;
    }

    mesh.texcoords = uv;
    return uv;
}

// Generate spherical UVs (lat-long)
function generateSphereTexcoords(mesh) {
    const pos = mesh.positions;
    const nVerts = pos.length / 4;
    const uv = new Float32Array(nVerts * 2);

    for (let i = 0; i < nVerts; i++) {
        const x = pos[i*4 + 0];
        const y = pos[i*4 + 1];
        const z = pos[i*4 + 2];

        const len = Math.sqrt(x*x + y*y + z*z) || 1;
        const nx = x / len, ny = y / len, nz = z / len;

        let u = Math.atan2(nz, nx);
        u = (u + Math.PI) / (2 * Math.PI);
        let v = (ny + 1.0) * 0.5;

        uv[i*2 + 0] = u;
        uv[i*2 + 1] = v;
    }

    mesh.texcoords = uv;
    return uv;
}

// Generate repeated planar UVs for ground
function generateGroundTexcoords(mesh, repeat = 4.0) {
    const pos = mesh.positions;
    const nVerts = pos.length / 4;
    const uv = new Float32Array(nVerts * 2);

    for (let i = 0; i < nVerts; i++) {
        const x = pos[i*4 + 0];
        const z = pos[i*4 + 2];
        uv[i*2 + 0] = (x * 0.1 + 0.5) * repeat;
        uv[i*2 + 1] = (z * 0.1 + 0.5) * repeat;
    }

    mesh.texcoords = uv;
    return uv;
}

const TEX = {};

// Load all scene textures
async function initTextures(gl) {
    const base = './assets/';

    try {
        TEX.sisalRope = await loadTexture(gl, base + 'sisal_rope.jpg', { wrap: gl.REPEAT });
        TEX.stoneTiles = await loadTexture(gl, base + 'tiles.jpg', { wrap: gl.REPEAT });
        TEX.platform = await loadTexture(gl, base + 'cattree_platform.jpg', { wrap: gl.REPEAT });
        TEX.fur = await loadTexture(gl, base + 'fur.jpg', { wrap: gl.REPEAT });
        TEX.tabby = await loadTexture(gl, base + 'tabby.jpg', { wrap: gl.REPEAT });
        TEX.metal1 = await loadTexture(gl, base + 'metal1.jpg', { wrap: gl.CLAMP_TO_EDGE });
        TEX.box1 = await loadTexture(gl, base + 'box1.jpg', { wrap: gl.REPEAT });

        console.log('%c[textures] All textures loaded successfully', 'color:#8f8');
    } catch (err) {
        console.error('[textures] Unexpected error during texture init:', err);
        const sisalWhite = createSolidColorTexture(gl, [245, 240, 230, 255]);
        const furFallback = createSolidColorTexture(gl, [200, 180, 150, 255]);
        const tabbyFallback = createSolidColorTexture(gl, [135, 130, 125, 255]);
        const stoneGray = createSolidColorTexture(gl, [160, 160, 162, 255]);
        const silver = createSolidColorTexture(gl, [185, 190, 200, 255]);
        const white = createSolidColorTexture(gl, [255, 255, 255, 255]);

        TEX.sisalRope = sisalWhite;
        TEX.fur = furFallback;
        TEX.tabby = tabbyFallback;
        TEX.platform = TEX.box1 = white;
        TEX.stoneTiles = stoneGray;
        TEX.metal1 = silver;
    }

    return TEX;
}

// Bind texture (or null)
function bindTexture(gl, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture || null);
}

Object.assign(window, {
    initTextures,
    TEX,
    bindTexture,
    generateCubeTexcoords,
    generateCylinderTexcoords,
    generateSphereTexcoords,
    generateGroundTexcoords,
    loadTexture,
    createSolidColorTexture
});
