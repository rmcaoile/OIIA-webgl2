# CMSC 161: Term Project — Cat Play Area

**Author:** Ralph Philip M. Caoile  
**Course:** CMSC 161 — Interactive Computer Graphics

---

## Short Description

An interactive WebGL 2.0 3D graphics application featuring a detailed **Cat Play Area** scene. The environment includes:

- A fully articulated munchkin cat model ("Ethel" / Ooia Cat) with hierarchical body, head (with ears), tail, short legs, and paws.
- A multi-platform cat tree with three sisal-rope wrapped posts, wooden platforms.
- Other object: toy mice (blue & green), metal food/kibble bowls with contents, and a textured cardboard box.
- Stone-tiled floor ground plane.

The project demonstrates all core CMSC 161 topics in one cohesive scene:
- Geometric modeling with reusable primitives (cube, sphere, cylinder, custom meshes)
- Hierarchical transformations and articulated animation
- Perspective projection, view, and modeling matrices
- Full Phong lighting + specular highlights
- Multiple texture mappings (wood, fur, metal, sisal, tiles, cardboard) using proper UV mapping (cylindrical, spherical, planar)
- Real-time shadow mapping 
- Extensive user interaction: mouse orbit/pan/zoom camera, click-to-toggle cat animation, sliders for camera/light/cat position, toggles


---

## How to Use

### Running the Application
1. To see the textures:
Run
```bash
python -m http.server 8000
```

Then open your browser and navigate to:

```
http://localhost:8000/index.html
```

2. Otherwise just open index.html
