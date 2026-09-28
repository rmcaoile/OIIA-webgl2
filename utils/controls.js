const camera = {
    eye:    [0, 0, 5],
    center: [0, 0, 0],
    up:     [0, 1, 0],
    _dragging:   false,
    _lastX:      0,
    _lastY:      0,
    _mode:       'orbit',
    _sensitivity: 4.0,
    _near: 1.5,
    _far:  30.0,
};

// Initialize camera and install mouse controls
function initCamera(sensitivity, near, far) {
    if (sensitivity != null) camera._sensitivity = sensitivity;
    if (near != null) camera._near = near;
    if (far  != null) camera._far  = far;

    camera.eye[0] = parseFloat(readSlider('eyeX') || 0);
    camera.eye[1] = parseFloat(readSlider('eyeY') || 0);
    camera.eye[2] = parseFloat(readSlider('eyeZ') || 5.0);

    clampEyeDistance();

    canvas_  = document.querySelector('#output');
    if (!canvas_) { console.error('Canvas not found — controls not installed.'); return; }

    canvas_.addEventListener('mousedown',    onMouseDown_);
    canvas_.addEventListener('mousemove',    onMouseMove_);
    window.addEventListener('mouseup',  onMouseUp_);
    canvas_.addEventListener('wheel',        onWheel_, { passive: false });
    canvas_.addEventListener('contextmenu',  e => e.preventDefault());
}

// Build view matrix from eye/center/up
function getViewMatrix(out) {
    glMatrix.mat4.lookAt(out, camera.eye, camera.center, camera.up);
    return out;
}

// Sync eye sliders with current camera state
function syncEyeSliders() {
    writeSlider('eyeX', camera.eye[0]);
    writeSlider('eyeY', camera.eye[1]);
    writeSlider('eyeZ', camera.eye[2]);
}

// Convert eye/center to spherical coordinates
function _toSpherical() {
    const dx = camera.eye[0] - camera.center[0];
    const dy = camera.eye[1] - camera.center[1];
    const dz = camera.eye[2] - camera.center[2];
    let theta = Math.atan2(dx, dz);
    const rXZ = Math.sqrt(dx * dx + dz * dz);
    const phi = Math.atan2(dy, rXZ);
    return { theta, phi, radius: Math.max(0.001, Math.sqrt(dx*dx + dy*dy + dz*dz)) };
}

// Convert spherical coordinates back to eye position
function _fromSpherical(th, ph, r) {
    const rXZ = r * Math.cos(ph);
    camera.eye[0] = camera.center[0] + rXZ * Math.sin(th);
    camera.eye[1] = camera.center[1] + r * Math.sin(ph);
    camera.eye[2] = camera.center[2] + rXZ * Math.cos(th);
}

// Clamp eye distance to near/far limits
function clampEyeDistance() {
    const dx = camera.eye[0] - camera.center[0];
    const dy = camera.eye[1] - camera.center[1];
    const dz = camera.eye[2] - camera.center[2];
    let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    dist = Math.max(camera._near, Math.min(camera._far, dist));
    const { theta, phi } = _toSpherical();
    _fromSpherical(theta, phi, dist);
}

let canvas_;

// Start drag tracking (orbit or pan)
function onMouseDown_(e) {
    e.preventDefault();
    camera._lastX = e.clientX;
    camera._lastY = e.clientY;
    camera._dragging = true;
    camera._mode = (e.button === 0) ? 'orbit' : 'pan';
    canvas_.style.cursor = (camera._mode === 'pan') ? 'grab' : 'grabbing';
}

// Handle mouse drag for orbit or pan
function onMouseMove_(e) {
    if (!camera._dragging) return;

    const dxPx = e.clientX - camera._lastX;
    const dyPx = e.clientY - camera._lastY;
    camera._lastX = e.clientX;
    camera._lastY = e.clientY;

    const sensible = camera._sensitivity;

    if (camera._mode === 'orbit') {
        const { theta, phi, radius } = _toSpherical();
        const dTheta = -(dxPx / sensible) * 0.02;
        const dPhi   =  (dyPx / sensible) * 0.02;
        const newTheta = theta + dTheta;
        const newPhi   = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, phi + dPhi));
        _fromSpherical(newTheta, newPhi, radius);
    } else if (camera._mode === 'pan') {
        const { theta, phi, radius } = _toSpherical();
        const panSpeed = (radius * 0.001) * sensible;
        const fwd = glMatrix.vec3.create();
        glMatrix.vec3.subtract(fwd, camera.eye, camera.center);
        glMatrix.vec3.normalize(fwd, fwd);
        const up = camera.up;
        const right = glMatrix.vec3.create();
        glMatrix.vec3.cross(right, up, fwd);
        const panX =  (dxPx / sensible) * panSpeed;
        const panY = -(dyPx / sensible) * panSpeed;
        camera.center[0] += right[0] * panX + up[0] * panY;
        camera.center[1] += right[1] * panX + up[1] * panY;
        camera.center[2] += right[2] * panX + up[2] * panY;
        camera.eye[0] += right[0] * panX + up[0] * panY;
        camera.eye[1] += right[1] * panX + up[1] * panY;
        camera.eye[2] += right[2] * panX + up[2] * panY;
    }
    syncEyeSliders();
}

// End drag tracking
function onMouseUp_() {
    camera._dragging = false;
    camera._mode = null;
    if (canvas_) canvas_.style.cursor = 'default';
}

// Handle scroll wheel for zoom
function onWheel_(e) {
    e.preventDefault();
    const { theta, phi, radius } = _toSpherical();
    const zoomFactor = 1.0 + (e.deltaY * 0.001);
    const newRadius = Math.max(camera._near, Math.min(camera._far, radius * zoomFactor));
    _fromSpherical(theta, phi, newRadius);
    syncEyeSliders();
}

// Read slider value by id
function readSlider(id) {
    const el = document.getElementById(id);
    return el ? el.value : null;
}

// Write value to slider and its label span
function writeSlider(id, value) {
    const el = document.getElementById(id);
    const spn = document.getElementById(id + 'Val');
    if (el) el.value = value.toFixed(1);
    if (spn) spn.textContent = value.toFixed(1);
}

// Get current center from center sliders
function getCenter() {
    return [
        parseFloat(readSlider('centerX') || 0),
        parseFloat(readSlider('centerY') || 0),
        parseFloat(readSlider('centerZ') || 0),
    ];
}

// Set camera center directly
function setCenter(x, y, z) {
    camera.center[0] = x;
    camera.center[1] = y;
    camera.center[2] = z;
}
