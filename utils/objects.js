// Generate cube mesh with per-face normals
function makeCube(size) {
    const s = size || 1.0;
    const h = s * 0.5;

    const positions = new Float32Array([
        -h,  h,  h,  1,    h,  h,  h,  1,    h, -h,  h,  1,   -h, -h,  h,  1,
        -h,  h, -h,  1,   -h, -h, -h,  1,    h, -h, -h,  1,    h,  h, -h,  1,
        -h,  h,  h,  1,    h,  h,  h,  1,    h,  h, -h,  1,   -h,  h, -h,  1,
        -h, -h, -h,  1,   -h, -h,  h,  1,    h, -h,  h,  1,    h, -h, -h,  1,
         h,  h,  h,  1,    h,  h, -h,  1,    h, -h, -h,  1,    h, -h,  h,  1,
        -h,  h,  h,  1,   -h, -h,  h,  1,   -h, -h, -h,  1,   -h,  h, -h,  1,
    ]);

    const normals = new Float32Array([
        0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0,  0, 0, 1, 0,
        0, 0,-1, 0,  0, 0,-1, 0,  0, 0,-1, 0,  0, 0,-1, 0,
        0, 1, 0, 0,  0, 1, 0, 0,  0, 1, 0, 0,  0, 1, 0, 0,
        0,-1, 0, 0,  0,-1, 0, 0,  0,-1, 0, 0,  0,-1, 0, 0,
        1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,
       -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0,
    ]);

    const indices = new Uint16Array([
         0,  3,  2,  0,  2,  1,
         4,  7,  6,  4,  6,  5,
         8,  9, 10,  8, 10, 11,
        14, 13, 12, 15, 14, 12,
        18, 17, 16, 19, 18, 16,
        22, 21, 20, 23, 22, 20,
    ]);

    const mesh = { positions, normals, indices };
    if (window.generateCubeTexcoords) window.generateCubeTexcoords(mesh, 1.0);
    return mesh;
}

// Generate sphere mesh with spherical normals
function makeSphere(radius, slices, stacks) {
    const r  = radius || 1.0;
    const sl = slices  || 24;
    const st = stacks  || 16;

    const positions = [];
    const normals   = [];
    const indices   = [];

    for (let j = 0; j <= st; j++) {
        const v    = j / st;
        const phi  = v * Math.PI;
        const y    = Math.cos(phi);
        const ring = Math.sin(phi);

        for (let i = 0; i <= sl; i++) {
            const u     = i / sl;
            const theta = u * Math.PI * 2;

            const x = ring * Math.cos(theta) * r;
            const z = ring * Math.sin(theta) * r;
            const ny = y;

            positions.push(x, ny * r, z, 1.0);
            const len = Math.sqrt(x*x + (ny*r)*(ny*r) + z*z) || 1;
            normals.push(x/len, (ny*r)/len, z/len, 0.0);
        }
    }

    for (let j = 0; j < st; j++) {
        for (let i = 0; i < sl; i++) {
            const a = j * (sl + 1) + i;
            const b = a + sl + 1;
            indices.push(a, a + 1, b);
            indices.push(a + 1, b + 1, b);
        }
    }

    const mesh = {
        positions : new Float32Array(positions),
        normals   : new Float32Array(normals),
        indices   : new Uint16Array(indices),
    };
    if (window.generateSphereTexcoords) window.generateSphereTexcoords(mesh);
    return mesh;
}

// Generate cylinder mesh with top/bottom caps
function makeCylinder(radius, height, slices) {
    const r  = radius  || 0.5;
    const h  = height  || 1.0;
    const sl = slices  || 24;

    const positions = [];
    const normals   = [];
    const indices   = [];

    for (let i = 0; i <= sl; i++) {
        const theta = (i / sl) * Math.PI * 2;
        const nx    = Math.cos(theta);
        const nz    = Math.sin(theta);
        const x     = nx * r;
        const z     = nz * r;

        positions.push(x, -h * 0.5, z, 1.0);
        normals.push(nx, 0, nz, 0.0);

        positions.push(x,  h * 0.5, z, 1.0);
        normals.push(nx, 0, nz, 0.0);
    }

    for (let i = 0; i < sl; i++) {
        const a = i * 2;
        const b = a + 2;
        const aTop = a + 1;
        const bTop = b + 1;
        indices.push(a, aTop, b, aTop, bTop, b);
    }

    const bottomCenterIdx = positions.length / 4;
    positions.push(0, -h * 0.5, 0, 1.0);
    normals.push(0, -1, 0, 0.0);

    const topCenterIdx = positions.length / 4;
    positions.push(0,  h * 0.5, 0, 1.0);
    normals.push(0, 1, 0, 0.0);

    const bottomRingStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const theta = (i / sl) * Math.PI * 2;
        positions.push(Math.cos(theta) * r, -h * 0.5, Math.sin(theta) * r, 1.0);
        normals.push(0, -1, 0, 0.0);
    }

    const topRingStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const theta = (i / sl) * Math.PI * 2;
        positions.push(Math.cos(theta) * r, h * 0.5, Math.sin(theta) * r, 1.0);
        normals.push(0, 1, 0, 0.0);
    }

    for (let i = 0; i < sl; i++) {
        indices.push(bottomCenterIdx, bottomRingStart + i, bottomRingStart + i + 1);
    }

    for (let i = 0; i < sl; i++) {
        indices.push(topCenterIdx, topRingStart + i + 1, topRingStart + i);
    }

    const mesh = {
        positions : new Float32Array(positions),
        normals   : new Float32Array(normals),
        indices   : new Uint16Array(indices),
    };
    if (window.generateCylinderTexcoords) window.generateCylinderTexcoords(mesh, height, 1.0, 6.0);
    return mesh;
}

// Generate large ground plane quad
function makeGround(size) {
    const s = size || 10.0;
    const h = s * 0.5;

    const positions = new Float32Array([
        -h, 0, -h, 1,    h, 0, -h, 1,
         h, 0,  h, 1,   -h, 0,  h, 1,
    ]);

    const normals = new Float32Array([
        0, 1, 0, 0,   0, 1, 0, 0,
        0, 1, 0, 0,   0, 1, 0, 0,
    ]);

    const indices = new Uint16Array([0, 2, 1,  0, 3, 2]);

    const mesh = { positions, normals, indices };
    if (window.generateGroundTexcoords) window.generateGroundTexcoords(mesh, 4.0);
    return mesh;
}

// Generate hollow tube (thick-walled cylinder)
function makeTube(outerRadius, innerRadius, height, slices) {
    const or = (outerRadius !== undefined) ? outerRadius : 0.5;
    const ir = (innerRadius !== undefined) ? innerRadius : 0.35;
    const h  = (height !== undefined) ? height : 1.0;
    const sl = slices || 32;

    const positions = [];
    const normals   = [];
    const indices   = [];

    const outerBottomStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(or * c, -h * 0.5, or * s, 1.0);
        normals.push(c, 0, s, 0.0);
    }
    const outerTopStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(or * c,  h * 0.5, or * s, 1.0);
        normals.push(c, 0, s, 0.0);
    }

    const innerBottomStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(ir * c, -h * 0.5, ir * s, 1.0);
        normals.push(-c, 0, -s, 0.0);
    }
    const innerTopStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(ir * c,  h * 0.5, ir * s, 1.0);
        normals.push(-c, 0, -s, 0.0);
    }

    for (let i = 0; i < sl; i++) {
        const a = outerBottomStart + i;
        const b = outerTopStart + i;
        const c = outerBottomStart + i + 1;
        const d = outerTopStart + i + 1;
        indices.push(a, b, c, b, d, c);
    }

    for (let i = 0; i < sl; i++) {
        const a = innerBottomStart + i;
        const b = innerTopStart + i;
        const c = innerBottomStart + i + 1;
        const d = innerTopStart + i + 1;
        indices.push(a, c, b, c, d, b);
    }

    const topOuterStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(or * c, h * 0.5, or * s, 1.0);
        normals.push(0, 1, 0, 0.0);
    }
    const topInnerStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(ir * c, h * 0.5, ir * s, 1.0);
        normals.push(0, 1, 0, 0.0);
    }
    for (let i = 0; i < sl; i++) {
        const o0 = topOuterStart + i, o1 = topOuterStart + i + 1;
        const i0 = topInnerStart + i, i1 = topInnerStart + i + 1;
        indices.push(o0, i0, o1, o1, i0, i1);
    }

    const botOuterStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(or * c, -h * 0.5, or * s, 1.0);
        normals.push(0, -1, 0, 0.0);
    }
    const botInnerStart = positions.length / 4;
    for (let i = 0; i <= sl; i++) {
        const t = (i / sl) * Math.PI * 2;
        const c = Math.cos(t), s = Math.sin(t);
        positions.push(ir * c, -h * 0.5, ir * s, 1.0);
        normals.push(0, -1, 0, 0.0);
    }
    for (let i = 0; i < sl; i++) {
        const o0 = botOuterStart + i, o1 = botOuterStart + i + 1;
        const i0 = botInnerStart + i, i1 = botInnerStart + i + 1;
        indices.push(o0, o1, i0, o1, i1, i0);
    }

    const mesh = {
        positions : new Float32Array(positions),
        normals   : new Float32Array(normals),
        indices   : new Uint16Array(indices),
    };
    if (window.generateCylinderTexcoords) {
        window.generateCylinderTexcoords(mesh, height, 2.0, 1.0);
    }
    return mesh;
}
