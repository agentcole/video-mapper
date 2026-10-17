# Projection-mapping software: mapping-side feature landscape (state as of 2026-10-15)

Scope: MadMapper, Millumin, HeavyM, Resolume Arena Advanced Output, Dataton WATCHOUT 7, disguise Designer (high-end reference), and the open-source mappers MapMap, Splash, ofxPiMapper, LPMT, and TouchDesigner's Kantan Mapper / stoner / camSchnappr / projectorBlend. The goal is a comparable matrix for a browser-based mapper + VJ tool. Its current baseline: a CSS `matrix3d` corner-pin per frame; polygon/circle/rect masks whose vertices go through the same homography as the content; soft-edge feathering; a fixed composition resolution; grid snap; test patterns; undo/redo.

Versions checked (latest found on 2026-10-15):
- Resolume 7.28.1 (2026-10-07)
- Millumin 5.14 (Nov 2025) plus an unnumbered beta
- WATCHOUT 7.8.4 (2026-09-07)
- disguise Designer r34.2 (2026-10-14)
- Splash 0.12.6 (2026-09-01)
- MapMap 1.0.0-alpha.1 on the `dev` branch (last commit 2026-09-18)
- ofxPiMapper v0.4.0 (2018; last code commit 2022)
- LPMT (original 2014; pierrep fork 2021)
- Kantan Mapper 2 (docs dated around 2021)
- MadMapper 6.1.7 (2026-10-09), with the 6.2.0 beta released the same day — [GarageCube forum: 6.1.7](https://forum.garagecube.com/viewtopic.php?f=20&t=36480); [GarageCube forum: 6.2.0 beta](https://forum.garagecube.com/viewtopic.php?f=20&t=36481)
- HeavyM 2.15.8 (2026-05-26) — [HeavyM update history](https://www.heavym.net/update-history/)

Sources for the versions are given in the sections below.

**Premise correction:** I found no evidence that 7thSense acquired Dataton or WATCHOUT. The evidence points the other way:
- Dataton's About page still describes Dataton AB, Linköping, founded 1973, with a "© Dataton AB 2026" footer — [Dataton About](https://www.dataton.com/about).
- WATCHOUT 7.8.4 shipped under Dataton on 2026-09-07 — [WATCHOUT release notes](https://dataton.com/watchout/release-notes).
- The only 7thSense link found is a Medialon device driver for controlling WATCHOUT — [7thSense Medialon help](https://portal.7thsense.one/medialon-help/mxmDatatonWatchoutIP.html).

The product is called "Dataton WATCHOUT 7" throughout these notes.

**Source access caveat:** reddit.com, old.reddit.com, the Resolume forum and the Dataton forum all returned HTTP 403 or were blocked for automated fetching. Forum points marked "(search snippet)" come from search-engine extracts, not full reads.

---

## 1. Surface & mask model (shapes, mesh warp, input vs output split, masks, groups)

### Takeaway
Every mature tool separates **where content is sampled from** (input/source shape, slice, crop) from **where it lands** (output shape or warp), and layers warps:
- a 4-corner perspective (homography) pin on the outside,
- an optional linear or Bezier grid mesh inside,
- and a second warp/mask stage per output (screen, canvas or display).

Masks exist in two coordinate spaces: pre-warp (they travel with the content) and post-warp (output space, never distorted). The browser tool currently has only one stage and only the pre-warp mask space.

### Cited Findings

**Resolume Arena: two editing stages**
- Advanced Output has two stages, each with its own editor:
  - **Input Selection**: which composition pixels a slice samples.
  - **Output Transformation**: how the slice is moved and warped on the physical output.
  - Presets are composition-independent .xml files.
  - Sources: [Resolume Advanced Output](https://resolume.com/support/en/advanced-output); [Resolume Output Transformation](https://resolume.com/article/52)
- **Input Selection slice types:** rectangle slices (default); slice masks (Arena only; preset or freeform pencil; linear or Bezier points; inverting a mask turns it into a crop); polygon slices (Arena only).
- **Polygon slices** come as a preset triangle or are drawn freehand. They are auto-triangulated, self-intersections are shown in red, and Bezier points are not allowed — [Resolume Input Selection](https://resolume.com/article/50)
- **No ellipse slice type.** The right-click "Make Triangle" and "Make Circle" commands create shapes — [Resolume article 51](https://resolume.com/article/51)
- **Output-side masks:**
  - Any number of points, inverted by default so they act as crops, Bezier point mode for rounded corners.
  - They "apply to all slices underneath them" and hide output "without distorting it".
  - Source: [Resolume Output Transformation](https://resolume.com/article/52)
- **Output Transformation warp levels on regular slices:**
  - 4 large corner points give a Perspective warp.
  - 4 smaller inner points give a Linear warp; more points can be added horizontally and vertically.
  - Any point can switch to Bezier, with two handles.
  - No point-count limit is documented; the page is labelled "v 6".
  - Source: [Resolume Output Transformation](https://resolume.com/article/52)
- **Editing aids:** "Match Output Shape" / "Match Input Shape", snapping to edges, centre and other slices, numeric fields that accept math (e.g. "/3"), multi-select, and dragging slices between screens — [Resolume Input Selection](https://resolume.com/article/50); [Resolume article 51](https://resolume.com/article/51)
- **Input Maps workflow:** build the slice layout in Input Selection (e.g. a 1080x1080 composition for a cube), then "Match Input Shape" on site and align corners — [Resolume Input Maps](https://resolume.com/support/en/input-maps)
- **Slice routing:** a slice's input can be the composition, a single layer, a group, the Preview, or **the output of another screen** (physical, virtual, NDI, Spout/Syphon). This allows multi-stage warping, e.g. blend two projectors first, then map objects inside a virtual screen — [Resolume Slice Routing](https://resolume.com/support/en/slice-routing)
- **Slice Transform effect** places content onto slices, polygon slices and fixtures with Fill, Fit, Stretch or Mask modes — [Resolume Slice Transform](https://resolume.com/article/42). Scale and Position were added in 7.25 (Mar 2026) — [Resolume 7.25 blog](https://resolume.com/blog/34172)

**Millumin**
- **Canvas → layers hierarchy.** Canvas size equals its output layout, and a project can hold several canvases — [Millumin Canvas](https://help.millumin.com/docs/display/canvas/)
- **Layer mapping:**
  - The Mapping tool (M) is a perspective-preserving corner-pin.
  - The Slice Editor (CMD+J) sets the input crop. Slice shapes are rectangle, quad or triangle; many slices per layer are allowed, with SVG import/export and "link input with output warping".
  - Mesh warping: double-click adds points, a `division` property sets the grid, and a `bezier mode` exists. No maximum point count is documented.
  - Source: [Millumin Mapping](https://help.millumin.com/docs/playback/mapping/)
- **Canvas-level and output-level warping:** each output has its own warping grid, colour adjustment and frame delay — [Millumin Display Mapping](https://help.millumin.com/docs/display/mapping/)
- **Surfaces** are reusable triangle or quad mapping presets shared by a canvas's layers. Snapped corners attach and move together. SVG import/export is supported — [Millumin Surfaces](https://help.millumin.com/docs/display/surfaces/)
- **Masks:**
  - Shapes: square, circle, triangle, a custom path with Bezier points (Alt+click), or SVG import.
  - **Feather in px**; the docs note it costs GPU.
  - Invert, opacity, alpha/luma mattes, and "Copy Masks Only".
  - Source: [Millumin Masks](https://help.millumin.com/docs/playback/masks/)
- **Video routing:** many canvases can feed one output (e.g. one per LED panel), and one canvas can split into many outputs with soft-edge — [Millumin Video Routing](https://help.millumin.com/docs/display/video-routing/)

**WATCHOUT 7**
- **Pipeline order:** per-cue corner pin → composite into the display buffer → display warp → display masks, with edge blending applied on top of the corrected output — [WATCHOUT Warp Geometry](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/warp-geometry.html)
- **Display warp is a Bezier-interpolated mesh:**
  - Presets 2×2, 2×3, 3×2 and 3×3; Ctrl+click an edge adds a row or column.
  - Up to 4 tangent handles per junction, with a "Smooth" (G¹) option.
  - A **"Perspective Correction" option** switches to perspective-correct interpolation instead of bilinear, to avoid texture swimming.
  - Source: [WATCHOUT Warp Geometry](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/warp-geometry.html)
- **Corner pin is a per-cue effect:** 8 tweenable channels, enforces a convex quad, single GPU pass before the display warp — [WATCHOUT Corner Pinning](https://docs.dataton.com/watchout-7-new/watchout/effects-and-tweens/corner-pinning.html)
- **Display masks:**
  - Presets: Left, Right, Top, Bottom, Rectangular, Round.
  - Freeform masks are built from a junction grid with Bezier handles.
  - **Feather comes from per-junction alpha**, with a gamma per mask. Several mask surfaces per display are allowed, and an image can serve as a mask.
  - Source: [WATCHOUT Display Masks](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/display-masks.html)
- **Virtual displays** render to an internal texture. Documented uses: LED pixel mapping, capturing faces of a 3D model, and splitting one composition into outputs of different resolutions — [WATCHOUT Virtual Displays](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/virtual-displays.html)

**disguise Designer**
- **Every screen is a UV-mapped 3D mesh.** Without a UV map, a surface renders black — [disguise UV maps](https://help.disguise.one/workflows/3d-modelling/uv-mapping/uv-maps-in-designer)
- **Mapping types:** Direct, Feed, Parallel, Perspective, Cylindrical, Radial, Spherical, Fisheye, CameraPlate, Spatial, Mesh, Depth Map, PreComp — [disguise Mapping types](https://help.disguise.one/designer/mapping/mapping-types-overview)
- **Feed system:**
  - FeedRects map a normalized `screenRect` of a screen to a `rect` on an output head.
  - Each FeedRect has a DeformStack (Lens, Circular, Mesh) and a `mask` texture.
  - Source: [disguise developer Feed guide](https://developer.disguise.one/plugins/guides/feed)
- **Output warp layer types:** 4point, 9point, Custom (any number of points), Grid, "Reference other projector", Circular and Lens Deform. The page is undated — [disguise legacy Warping outputs](https://legacy-help.disguise.one/en/Content/Stage-Setup/Projector-Simulation/Warping-outputs.html)

**MapMap**
- **Each Layer pairs an "Input shape" (source region) with an "Output shape"** that has the same vertex count, matched vertex by vertex — [MapMap LayerGui.cpp](https://github.com/mapmapteam/mapmap/blob/dev/src/gui/LayerGui.cpp); [MapMap MainWindow.cpp](https://github.com/mapmapteam/mapmap/blob/dev/src/gui/MainWindow.cpp)
- **Shapes:** Mesh (a quad is a 2×2 mesh), Triangle and Ellipse. There are no masks or feathering; "Soft edges" has been an open issue since 2014 — [MapMap manual](https://github.com/mapmapteam/mapmap/blob/dev/docs/manual/manual_en.rst); [MapMap issue #66](https://github.com/mapmapteam/mapmap/issues/66)

**ofxPiMapper**
- **Surface types:** TRIANGLE, QUAD, GRID_WARP, HEXAGON, CIRCLE — [ofxPiMapper SurfaceType.h](https://github.com/kr15h/ofxPiMapper/blob/master/src/Surfaces/SurfaceType.h)
- **Separate modes:** "Texture mapping mode" edits the input texcoords, and "Surface editing mode" edits the output vertices — [ofxPiMapper README](https://github.com/kr15h/ofxPiMapper)
- **Circle** is a QuadSurface subclass that renders through a circular mask FBO, with no feather — [ofxPiMapper CircleSurface.cpp](https://github.com/kr15h/ofxPiMapper/blob/master/src/Surfaces/CircleSurface.cpp)
- **Grid warp** defaults to 2×2 cells, with linear vertices only — [ofxPiMapper GridWarpSurface.cpp](https://github.com/kr15h/ofxPiMapper/blob/master/src/Surfaces/GridWarpSurface.cpp)

**LPMT**
- Up to 36 surfaces — [LPMT repo](https://github.com/hvfrancesco/lpmt)
- **Per-surface warps and masks:**
  - Bicubic Bezier warp: 4×4 control points, tessellated 20×20.
  - Grid warp, default 7×6.
  - Editable polygon masks with invert, and Kinect live masks.
  - Source: [LPMT quad.cpp](https://github.com/hvfrancesco/lpmt/blob/master/src/quad.cpp); [LPMT quad.h](https://github.com/hvfrancesco/lpmt/blob/master/src/quad.h)

**TouchDesigner: Kantan Mapper and stoner**
- **Kantan Mapper 2:**
  - Quad shapes (with rows and columns) and Freeform shapes (keys with optional Bezier handles).
  - Quad texture mode is "Perspective" or "Bilinear"; gridwarp is "Bezier" or "Linear".
  - Per-shape softedge, a Shapes Tree with groups and nesting, and "apply the shape as a mask to the texture".
  - Source: [Kantan Mapper docs](https://docs.derivative.ca/Palette:kantanMapper)
- **stoner** has two warp levels: a 4-point keystone (Perspective or Bilinear) with a Bezier or Linear mesh grid inside it. It outputs a UV/displacement map for the Remap TOP — [stoner docs](https://docs.derivative.ca/Palette:stoner)

**Splash**
- Mapping is based on a 3D model: the user provides a UV-mapped model and Splash calibrates each projector as a virtual camera.
- A per-projector Bezier patch, default 4×4 control points tessellated at 64, is a last-resort post-correction.
- Sources: [Splash README](https://gitlab.com/splashmapper/splash); [Splash mesh_bezierpatch.cpp](https://gitlab.com/splashmapper/splash/-/blob/master/src/mesh/mesh_bezierpatch.cpp); [Splash geometric calibration](https://splashmapper.xyz/en/how-to/calibration/geometrical_calibration.html)

**MadMapper 6**
- **Surface types:** Video Quad, Video Line, Triangle, Circle, Mask, 3D Surface (OBJ) and Groups — [MadMapper docs: Surface types](https://docs.madmapper.com/madmapper/6/4.-surfaces/surface-types)
- **Feature-page claims:** "Multiple bezier masks per surface", feathering, and "Unlimited points Bezier Meshwarping" — [MadMapper features](https://madmapper.com/madmapper/features)
- **Mesh warping:**
  - A grid comes from H/V subdivision counts, or Alt+click adds a point anywhere. Rows and columns can be deleted, and segments and lines can be selected.
  - Arrow keys nudge by 1 px (10 px with Shift).
  - A **Bezier** slider adds tangent handles, which can be unlinked for sharp corners.
  - A **"Precision"** slider adds tessellation.
  - Source: [MadMapper docs: Warping and geometry](https://docs.madmapper.com/madmapper/6/4.-surfaces/warping-and-geometry)
- **Input vs output split:**
  - The Input View sets texture coordinates (UVs), and an input rectangle crops the source.
  - The Stage/Output view sets the projected geometry.
  - Sources: [MadMapper docs: Interface overview](https://docs.madmapper.com/madmapper/6/2.-the-interface/interface-overview); [MadMapper docs: Assigning content](https://docs.madmapper.com/madmapper/6/4.-surfaces/assigning-content-to-surfaces)
- **"Link Input and Output Mesh"** is on by default, so output edits are mirrored on the input mesh to keep video undistorted. "Show Input Mesh" unlinks them so each can be warped on its own — [MadMapper docs: Warping and geometry](https://docs.madmapper.com/madmapper/6/4.-surfaces/warping-and-geometry)
- **Masks:**
  - **Internal masks** cut only their own surface. **Global Mask surfaces** cut every layer beneath them.
  - Masks can be Bezier, freehand (auto-smoothed) or square/triangle/circle presets. Feathering is per surface.
  - **Groups** transform as one unit and multiply opacity. "Shadow groups" limit how far masks and blend modes reach.
  - Sources: [MadMapper docs: Groups and masks](https://docs.madmapper.com/madmapper/6/4.-surfaces/surface-groups-and-masks); [MadMapper docs: Surface inspector](https://docs.madmapper.com/madmapper/6/4.-surfaces/surface-inspector)
- **Video Wall template:** generates a grid of quads or DMX fixtures from screen count, resolution and bezel size — [MadMapper docs: Video wall setup](https://docs.madmapper.com/madmapper/6/4.-surfaces/video-wall-setup)

**HeavyM 2.15**
- **Three shape kinds:**
  - **Faces** are vector outlines filled with built-in generative effects.
  - **Players** hold media: video, image, webcam, Syphon/Spout, NDI, shaders, text.
  - **Masks** are faces set to "Use as Mask".
  - Source: [HeavyM help: What are Shapes](https://help.heavym.net/hc/en-us/articles/360018757859-What-are-Shapes)
- **Faces:**
  - Presets are square, triangle, circle, or regular 5–10-gons; point-to-point drawing is also possible.
  - Straight and Bezier points can be mixed (at least 3 points, no maximum), with 4 handle types.
  - Since 2.13, numeric X/Y pixel coordinates can be typed per vertex.
  - Source: [HeavyM help: Drawing and editing Faces](https://help.heavym.net/hc/en-us/articles/360018758119-Drawing-and-editing-Faces)
- **Masks** affect only their own group. No mask feathering is documented — [HeavyM help: Masks](https://help.heavym.net/hc/en-us/articles/360018758279-Drawing-and-editing-Masks)
- **Organizing tools:**
  - "Maps" are saved sets of shapes chosen per sequence — [HeavyM help: Maps](https://help.heavym.net/hc/en-us/articles/360021596060-Using-Maps-to-create-multiple-drawings)
  - The "Magnet" snaps and links shared vertices — [HeavyM help: The Magnet](https://help.heavym.net/hc/en-us/articles/4407417552914-The-Magnet)
  - The "Slice Selector" crops a Player's input — [HeavyM help: Slice Selector](https://help.heavym.net/hc/en-us/articles/6577548993426-Using-the-Slice-Selector-to-crop-the-input-of-a-player)

### Inferences
- **The common core is the stoner/Resolume/WATCHOUT layering:** a corner-pin (homography) outer warp, an N×M grid inside it with per-point Linear/Bezier mode, and a global "Perspective vs Bilinear" interpolation toggle. Point counts are rarely capped in the docs; documented defaults are 2×2 to 7×6 grids and 4×4 Bezier patches.
- **Two mask spaces are standard.** All of these have them:
  - MadMapper: internal masks attachable to Quad, Input or Nothing, plus Global Mask surfaces.
  - Millumin: layer masks pre-warp, canvas masks post-warp.
  - Resolume: input slice masks and output masks.
  - WATCHOUT: cue-level corner pin vs display masks in output space. The browser tool's current masks are pre-warp only. Adding **output-space masks per output/screen** is a cheap, high-value next step: they cover projector spill, blackout of obstacles, and hard crops.
- **"Match input shape"** (Resolume) and Millumin's "link input with output warping" are the UX glue for the input/output split. They are worth copying when an "input selection" stage is added.

### Gaps
- No tool documents a hard maximum mesh point count.
  - MadMapper markets "Unlimited points Bezier Meshwarping" — [MadMapper features](https://madmapper.com/madmapper/features)
  - HeavyM's output warping allows 1–15 subdivisions per axis — [HeavyM help: Output warping](https://help.heavym.net/hc/en-us/articles/4410182398098-Distorting-the-Output-with-the-Warping-module)
- The Resolume manual pages are undated, and some are labelled v6, so v7 UI differences may exist.
- disguise's order of output masks versus warp layers is not stated in its docs.

---

## 2. How perspective / corner-pin works on non-quad shapes, and how UX stays consistent

### Takeaway
Three point pairs define only an affine map, while a homography needs four. Tools therefore choose one of two patterns.

**(A) Per-vertex texture mapping.** Triangles are mapped exactly affine; polygons are triangulated and warped piecewise-affine, with no perspective. Users of:
- Resolume poly slices
- MapMap
- ofxPiMapper triangle and grid
- Millumin triangle slices

**(B) Shape lives inside a 4-corner container.** The shape (mask) stays in content space and is carried through the container's homography, as in Photoshop's bounding-box Distort/Perspective. Users of:
- ofxPiMapper circle
- LPMT masks
- Millumin layer masks
- Kantan "shape as mask"
- the browser tool's current unified model
- MadMapper (masks attached to the Quad since 4.0)

**(C) No texture warp at all.** HeavyM "Faces" are vector outlines filled with generated effects; a movable "Center +" acts as a vanishing point to fake perspective.

Only pattern (B) gives true perspective on non-quads. Pattern (A) produces visible creases or seams at steep angles.

MadMapper's model is the most explicit: a mask can be attached to the Quad (follows the warp), to the Input (follows the texture), or to Nothing (fixed in output space).

### Cited Findings

**Resolume**
- "Poly slices cannot be perspective warped", and "Bezier warping is not available on poly slices". Only linear per-point warping exists for polygons — [Resolume Output Transformation](https://resolume.com/article/52)
- On Input Selection masks, the slice "still warps based on its own corner points, not the corners of the mask". Users are told to build the slice at the same scale as the shape being mapped — [Resolume Input Selection](https://resolume.com/article/50) (search snippet of that page)
- A forum user reported that moving any point of a polygon slice warps the content. Staff suggested "match shape" from the other tab; another user said it didn't work (search snippet) — [Resolume forum p=58585](https://www.resolume.com/forum/viewtopic.php?p=58585)
- Users note that polygon slices give no perspective correction and lack the large corner points (search snippet) — [Resolume forum p=93004](https://resolume.com/forum/viewtopic.php?p=93004)
- A feature request asks for interior points in polygon slices (search snippet) — [Resolume forum p=82331](https://www.resolume.com/forum/viewtopic.php?p=82331)
- Staff (old threads, search snippet) say warping always splits the texture into triangles or squares, so arbitrary single points cause creases. Only the 4 perspective points warp evenly, and more slices are recommended instead — [Resolume forum p=53475](https://www.resolume.com/forum/viewtopic.php?p=53475); [Resolume forum p=42113](https://www.resolume.com/forum/viewtopic.php?p=42113)
- Resolume 7.28 added "Invert" to the **Keystone Mask** effect, a clip/layer-level corner-pin mask — [Resolume 7.28 blog](https://resolume.com/blog/34630)

**Millumin**
- The developer wrote "Masking is processed before mapping" (Nov 2014). Layer masks are therefore warped with the content, which confused users who expected output-space masks. The suggested fix is a black colour layer with a mask on top — [Millumin forum comment 1341](https://forum.millumin.com/discussion/comment/1341/) (2014)
- Canvas masks render after canvas mapping, in output space — [Millumin Display Mapping](https://help.millumin.com/docs/display/mapping/)

**WATCHOUT 7**
- "Mask coordinates correspond to the final display surface, not the pre-warp content space". Masks are not distorted by warp — [WATCHOUT Display Masks](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/display-masks.html)
- The per-cue corner pin enforces a **convex quad** — [WATCHOUT Corner Pinning](https://docs.dataton.com/watchout-7-new/watchout/effects-and-tweens/corner-pinning.html)

**MapMap**
- **Triangle:** an exact affine map, drawn as GL_TRIANGLES with input texcoords — [MapMap ShapeGraphicsItem.cpp](https://github.com/mapmapteam/mapmap/blob/dev/src/gui/ShapeGraphicsItem.cpp); [MapMap Util.cpp](https://github.com/mapmapteam/mapmap/blob/dev/src/core/Util.cpp)
- **Quad/mesh: no homography.** Each cell is subdivided recursively at midpoints until it is near a parallelogram or below `MESH_SUBDIVISION_MIN_AREA = 400`. This converges to a **bilinear** map, not a perspective one — [MapMap ShapeGraphicsItem.cpp](https://github.com/mapmapteam/mapmap/blob/dev/src/gui/ShapeGraphicsItem.cpp); [MapMap MM.h](https://github.com/mapmapteam/mapmap/blob/dev/src/core/MM.h)
  - Issue #1, "Make textures perspective-correct", was closed in 2015 as fixed "using quad division" — [MapMap issue #1](https://github.com/mapmapteam/mapmap/issues/1)
- **Ellipse:** drawn as a fan of up to 100 triangles. Issue #177, "Ellipse center point is perspectively incorrect", is still open; the maintainer called the result "still weird" — [MapMap issue #177](https://github.com/mapmapteam/mapmap/issues/177)

**ofxPiMapper**
- **Quad without perspective:** two triangles with texcoords, which gives a diagonal seam. A user described "a massive distortion line" — [ofxPiMapper QuadSurface.cpp](https://github.com/kr15h/ofxPiMapper/blob/master/src/Surfaces/QuadSurface.cpp); [ofxPiMapper issue #22](https://github.com/kr15h/ofxPiMapper/issues/22)
- **Quad with perspective** (the `p` key): a homography from the bounding box to the 4 corners via `findHomography` (Gaussian elimination), applied with `glMultMatrixf`. This is the same principle as CSS `matrix3d` — [ofxPiMapper QuadSurface.cpp](https://github.com/kr15h/ofxPiMapper/blob/master/src/Surfaces/QuadSurface.cpp); [ofxPiMapper HomographyHelper.cpp](https://github.com/kr15h/ofxPiMapper/blob/master/src/Utils/HomographyHelper.cpp) (MIT)
- **Triangle and grid:** affine, or piecewise-affine per cell — [ofxPiMapper TriangleSurface.cpp](https://github.com/kr15h/ofxPiMapper/blob/master/src/Surfaces/TriangleSurface.cpp)

**LPMT**
- The base quad uses `findHomography` + `glMultMatrixf`. Bezier and grid warps, and polygon masks, are drawn **inside** that transform — [LPMT quad.cpp](https://github.com/hvfrancesco/lpmt/blob/master/src/quad.cpp)

**TouchDesigner**
- Kantan offers a "Perspective" or "Bilinear" mode per quad, and Freeform shapes can be applied "as a mask to the texture" — [Kantan Mapper docs](https://docs.derivative.ca/Palette:kantanMapper)
- stoner applies its 4-point keystone (Perspective or Bilinear) first, then the inner mesh — [stoner docs](https://docs.derivative.ca/Palette:stoner)

**Theory**
- Splitting a quad into two linearly interpolated triangles "produces an ugly seam" unless the quad is a parallelogram. Projective interpolation (a per-vertex q coordinate, divided per pixel) removes the seam.
- Projective interpolation has its own cost: grid spacing becomes uneven, which can create seams between **adjacent** warped quads. The article calls this "pretty much a deal-breaker" for joined quads.
- Source: [Nathan Reed, Quadrilateral Interpolation Part 1](https://www.reedbeta.com/blog/quadrilateral-interpolation-part-1/) (May 2012)

**Photoshop / After Effects UX reference**
- In Photoshop, Free Transform (Ctrl/Cmd+T) puts a bounding box around any layer or shape. Distort and Perspective are driven by its corner handles, and right-click offers Skew, Distort, Perspective and Warp — [Adobe Photoshop web: modify images](https://helpx.adobe.com/photoshop/web/edit-images/transform-and-crop/modify-images.html) (updated Sep 2024); [GoSkills: Editing and Transforming Shapes](https://goskills.com/Course/Adobe-Photoshop-Beginner-to-Pro/Lesson/5020/Editing-and-Transforming-Shapes)
- After Effects renders pixel-based layers as masks first, then effects (Corner Pin is an effect), then transforms. A mask is therefore warped together with its content. This comes from third-party and community sources only; I found no Adobe helpx page confirming it — [ProVideo Coalition: AE render order](https://www.provideocoalition.com/after-effects-render-order-issues/); [Adobe Community thread](https://community.adobe.com/t5/after-effects-discussions/how-do-i-add-a-mask-to-a-rotoscoped-layer/td-p/12518597)

**MadMapper**
- **Quad:** corner drags produce a perspective (corner-pin) distortion when the "Perspective" checkbox is on — [MadMapper docs: Warping and geometry](https://docs.madmapper.com/madmapper/6/4.-surfaces/warping-and-geometry). A right-click "Enable/Disable Perspective" was added in 5.6 (Jun 2024) — [GarageCube forum 5.6](https://forum.garagecube.com/viewtopic.php?f=20&t=36145)
- **Triangle:** the docs only say to adjust, scale and rotate it, and that complex shapes are often better "sliced up into triangles instead of using a Quad". The interpolation is undocumented; three points imply affine, which is an inference — [MadMapper docs: Surface types](https://docs.madmapper.com/madmapper/6/4.-surfaces/surface-types)
- **Circle:** four handle points, and "the perspective is scaled with the center handle". For more control the docs suggest Quad + Mesh Warping > Sphereize — [MadMapper docs: Surface types](https://docs.madmapper.com/madmapper/6/4.-surfaces/surface-types)
- **MadMapper 4.0 (2020) — explicit mask space:**
  - "Quad / Circle Masks can be drawn and attached to the input media (attach to Quad / Input or Nothing)". A mask can therefore follow the surface warp, follow the source texture, or stay fixed in output space.
  - The same release added feathering on all surface types and "Surface Groups remember their perspective transform".
  - Source: [GarageCube forum 4.0](https://forum.garagecube.com/viewtopic.php?f=20&t=35230) (2020)
- 6.0.0 fixed a "uv issue with mesh warping + mask feathering (use intersections with mesh warping segments)". This shows the feather is computed against the warp mesh — [MadMapper v6 release notes](https://docs.madmapper.com/madmapper/6/1.-introduction/what's-new/release-notes-v6)

**HeavyM**
- **Faces are not texture-warped.** Effects are drawn inside the vector outline, and each face's movable "Center +" acts as the vanishing point for compatible effects (Outline, Rotation, Hypnotic, Mosaic, Radial Glow…). This gives a perspective *illusion* without a homography — [HeavyM help: Center and perspective](https://help.heavym.net/hc/en-us/articles/4404439496850-Using-the-Center-to-control-the-perspective-of-effects)
- **Players always have exactly 4 corner points.** Moving them stretches content "in a way that keeps the perspective correct".
  - An optional rows × columns grid (Linear, or Bezier since 2.13) stacks on top and "evenly stretches" content.
  - "Make circle" fits the grid to a dome.
  - Source: [HeavyM help: Drawing and editing Players](https://help.heavym.net/hc/en-us/articles/360018687700-Drawing-and-editing-Players)
- **Per-screen output warping** combines Perspective (corners) and Points mode (1–15 subdivisions per axis, Linear or Bezier). It changes only the output, not the canvas — [HeavyM help: Output warping](https://help.heavym.net/hc/en-us/articles/4410182398098-Distorting-the-Output-with-the-Warping-module)

### Inferences
- **The browser tool's current unified model is already the "pro" answer** for non-quad perspective. A shape kept in content space with its outline passed through the same homography is what ofxPiMapper (circle), LPMT (masks), Millumin (layer masks) and Photoshop (bounding box) do. Resolume explicitly does *not* offer it for poly slices, and that is a recurring complaint there.
- **Keep the bounding quad as the warp handle set for every shape type.** Expose vertex editing as a separate "edit shape" mode in content space, as Photoshop does with Free Transform vs Direct Selection. Do not expose a triangle's three vertices as the warp control, because three points cannot express perspective.
- **Offer a piecewise-affine "Linear" warp as an option, not the default.** Some users want to drag polygon vertices directly, as in Resolume poly slices or MapMap. Implement it as per-vertex texture mapping via triangulation in WebGL.
- **When a WebGL renderer is added**, use homography plus grid in a shader rather than subdividing into GL triangles. Provide a "Perspective Correction / Bilinear" toggle for grid cells, as WATCHOUT and Kantan do. Warn, or blend continuously, where adjacent perspective-warped cells meet (Reed's caveat).
- **Add an explicit, separate output-space mask layer** (WATCHOUT, Millumin canvas masks, Resolume output masks). This answers the classic confusion of "my mask moved when I warped" (the Millumin 2014 thread).

### Gaps
- No primary Adobe documentation on After Effects render order was found; the claim rests on ProVideo Coalition and Adobe Community posts.
- disguise does not document whether its FeedRect mask texture is applied before or after DeformStack warps.
- Kantan's .tox source is not public, so whether its "Perspective" mode is a true homography is unverified.
- MadMapper's texture interpolation for Triangle surfaces is undocumented. Affine is inferred from the 3-point geometry, not confirmed.
- I found no 2024–2026 vendor docs describing a Photoshop-style "perspective on any shape via its bounding quad" as a named feature. ofxPiMapper's circle-in-quad and MadMapper's mask "attach to Quad" are the closest documented equivalents.

---

## 3. Multi-projector: edge blending, colour, outputs, virtual screens

### Takeaway
Edge blending is table stakes in every commercial tool. The parameter vocabulary has converged on Paul Bourke's model:
- per-side blend width,
- curve exponent ("power"),
- midpoint luminance,
- gamma (often per RGB),
- black-level compensation.

The tools differ in three ways:
- **Placement:** blending is applied per slice (Resolume), per quad with "Auto Setup" (MadMapper), per screen with "Auto width" (HeavyM Pro), per canvas layout (Millumin), detected automatically from overlaps (WATCHOUT 2D), or computed from 3D projector poses (disguise Dynamic Blend, Splash).
  - Black-level compensation is still uncommon: Resolume and disguise have it, and MadMapper only gained it in the 6.2 beta (Oct 2026).
- **Virtual screens / render-to-texture outputs** are universal and are the bridge to LED and multi-stage mapping.
- **Per-output colour correction** (brightness, contrast, RGB or white point) is universal.

### Cited Findings

**Theory**
- Bourke's blend function is `f(x)=0.5(2x)^p` for x≤0.5 and `1−0.5(2(1−x))^p` for x≥0.5. A luminance-at-centre variant uses the parameter `a`. Gamma is compensated with `f(x)^(1/G)`, per R, G and B channel.
- Bourke attributes the remaining visible band to projector black level and says the only remedy is better projectors; there is no software fix in the article.
- Source: [Paul Bourke, Edge blending](https://paulbourke.net/miscellaneous/edgeblend/) (March 2004)

**Resolume**
- Edge blending is set **per slice** (Arena only) and auto-centres within the overlap — [Resolume Edge Blending](https://resolume.com/support/en/edge-blending)
  - Parameters: "Gamma Red, Green and Blue", "Power", "Luminance" and "Gamma".
  - "Black Level Compensation" sits on the output tab.
  - Recommended overlap is at least 15%.
- Per-slice colour: Brightness, Contrast, R, G and B. Also "Is Key" (outputs luminance as a key) and Black BG — [Resolume Output Transformation](https://resolume.com/article/52)
- Per-screen colour, plus a 0–100 ms Delay — [Resolume Screens](https://resolume.com/support/en/screens)
- Virtual screens with custom size can be prepared before arriving on site. Syphon, Spout and NDI outputs can be separate screens with their own warping — [Resolume Screens](https://resolume.com/support/en/screens); [Resolume Syphon/Spout](https://resolume.com/support/en/syphonspout)
- 10-bit output arrived in 7.24 (Jan 2026) — [Resolume 7.24 blog](https://resolume.com/blog/32999)
- Known issue in 7.23.2: the number of displays is limited to 8 on macOS — [Resolume 7.23 blog](https://resolume.com/blog/30807)

**Millumin**
- **Soft-edge** comes from the canvas layout (2×1, 1×2, or matrix 2×2+). "Soft-edge amount" is set in px roughly equal to the overlap, and "Smoothness" removes the white band — [Millumin Soft-edge](https://help.millumin.com/docs/display/softedge/)
  - Recommended overlap is 5–10%, and all projectors must share one resolution.
  - No gamma or black-level controls are documented.
- Matrix soft-edge and curved output warping arrived in 4.12 (Nov 2021); soft-edge inside video routing in 4.18 (Nov 2023) — [Millumin v4 change log](https://help.millumin.com/v4/general/change-log/)
- **Outputs:** displays, Blackmagic, AJA, Syphon with alpha, NDI, RTMP and HDR 10-bit — [Millumin Outputs](https://help.millumin.com/docs/display/outputs/). The homepage lists displays up to 16K — [Millumin homepage](https://www.millumin.com/)

**WATCHOUT 7**
- **Automatic soft edges:**
  - Overlaps are detected on the stage, with a gamma slider from 0.5 to 1.5.
  - Not available for 3D projector-type displays.
  - **No black-level compensation**; the docs refer you to projector settings and physical masks.
  - Per-display White Point R/G/B; 10–20% overlap suggested.
  - Source: [WATCHOUT Edge Blending](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/edge-blending.html)
- **Sync:** NTP across nodes, plus GenLock/Frame Lock on NVIDIA RTX PRO with a Sync board — [WATCHOUT Time Sync](https://docs.dataton.com/watchout-7-new/watchout/network-setup/time-synchronization.html)
- **Licence capacity:** one licence covers up to 8× DCI 4K (70.8 MP) — [Dataton knowledge base](https://knowledge.dataton.com/knowledge/how-many-watchout-7-licenses-do-i-need-in-my-setup)
- **Redundancy:** a redundant Director pair, and Runners keep playing if the Director is lost — [WATCHOUT 6 vs 7](https://docs.dataton.com/watchout-7-new/watchout/getting-started/architectural-differences-watchout-6-vs-7.html)

**disguise**
- **Dynamic Blend** is automatic, computed from calibrated 3D projector poses — [disguise Dynamic Blend](https://help.disguise.one/designer/stage-setup/projector-simulation/dynamic-blend)
  - Parameters: Gamma, **Black Level Curve Power** (default 1.0, 2.0 recommended), **Black Level of Centre**, Blend Sharpness, and per-projector gamma bias.
- A warning appears above 12 projectors per blend (r33.2.2) — [disguise r33 release notes](https://help.disguise.one/designer/release-notes/r33)
- Output soft-edge and mask textures are set per output head at head resolution, with a global gamma and composited blend modes — [disguise Blending/masking outputs](https://help.disguise.one/designer/feed-outputs/blending-masking-outputs)

**Splash**
- **Automatic per-vertex blending** on the 3D model, with an option to recompute every frame for moving objects. It needs OpenGL 4.3 — [Splash geometric calibration](https://splashmapper.xyz/en/how-to/calibration/geometrical_calibration.html)
- Tested up to 8 outputs on 2 GPUs — [Splash README](https://gitlab.com/splashmapper/splash)

**TouchDesigner projectorBlend**
- NxM arrays with per-side overlap, blend, luminance, RGB gamma, HSV and blankout, following Bourke and ofxProjectorBlend. All projectors must share one resolution — [projectorBlend docs](https://docs.derivative.ca/Palette:projectorBlend)

**LPMT**
- The blend shader computes `blend = a<0.5 ? L*pow(2a,exp) : 1-(1-L)*pow(2(1-a),exp); blend = pow(blend,1/gamma)` with per-side amounts. Defaults are exponent 1.0 and gamma 1.8 — [LPMT blend.frag](https://github.com/hvfrancesco/lpmt/blob/master/bin/data/shaders/blend.frag)

**MapMap and ofxPiMapper**
- Neither has multi-output or edge blending; both are open requests — [MapMap issue #80](https://github.com/mapmapteam/mapmap/issues/80); [MapMap issue #117](https://github.com/mapmapteam/mapmap/issues/117); [ofxPiMapper issue #171](https://github.com/kr15h/ofxPiMapper/issues/171)

**Browser platform**
- The Window Management API (`getScreenDetails()`, plus `requestFullscreen({screen})`) lets a page enumerate displays and go fullscreen on a specific screen. It is "Experimental" and not Baseline, needs a secure context, and requires one user gesture per `window.open()` — [MDN Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API)

**MadMapper**
- **Outputs:**
  - "As many projector outputs as your GPU can handle" (16× Full HD tested on one PC).
  - "8k maximum output resolution per projector".
  - Spout, Syphon and NDI, in and out.
  - Source: [MadMapper features](https://madmapper.com/madmapper/features)
- **Output types** are Video, Laser, DMX, Video Buffer and Laser Buffer (buffers in 8-bit/16f/32f). A Loopback can feed an output back into the Media Bin — [MadMapper docs: Outputs](https://docs.madmapper.com/madmapper/6/6.-outputs). Buffers arrived in 6.1 (2026-04) — [GarageCube forum 6.1](https://forum.garagecube.com/viewtopic.php?f=20&t=36432)
- **Soft edge:**
  - Quads only, with Width and "Power (gamma curve)" per edge.
  - **"Auto Setup"** computes overlaps for selected quads.
  - Non-straight overlaps use feathered internal masks. 10–20% overlap is recommended.
  - Source: [MadMapper docs: Soft-edge blending](https://docs.madmapper.com/madmapper/6/6.-outputs/soft-edge-blending)
- **Black level compensation** for soft-edge arrives in the 6.2.0 beta (2026-10-09) — [GarageCube forum 6.2 beta](https://forum.garagecube.com/viewtopic.php?f=20&t=36481)
- **No per-video-output colour correction is documented.** Colour is per surface via the "Color Controls" FX — [MadMapper docs: Outputs](https://docs.madmapper.com/madmapper/6/6.-outputs); [MadMapper docs: Surface inspector](https://docs.madmapper.com/madmapper/6/4.-surfaces/surface-inspector)

**HeavyM**
- **Canvas and screens:**
  - One canvas (default 1920×1080) holds "Screens", which are rectangles on the canvas, each sent to a display or NDI.
  - Each screen has rotation and Blackout/Solo.
  - Pro+ allows "virtually unlimited" screens.
  - Sources: [HeavyM help: Output Setup](https://help.heavym.net/hc/en-us/articles/35039776578834-The-Output-Setup); [HeavyM help: Multiple displays](https://help.heavym.net/hc/en-us/articles/4410179583762-Configuring-an-advanced-projection-setup-with-multiple-displays-Pro)
- **Edge blending (Pro):**
  - Per-side strip width in px, plus Gamma Correction and Smooth.
  - **"Auto width"** computes the overlap.
  - Since 2.13 a single screen can be blended on its own, which allows blending across separate computers.
  - Source: [HeavyM help: Edge Blending](https://help.heavym.net/hc/en-us/articles/4410174789522-Blending-displays-seamlessly-with-the-Edge-Blending-module-Pro)
- No black-level compensation or per-output colour correction was found.
- NDI per screen, with warping, arrived in 2.15.1 (2026-03) — [HeavyM 2.15 update](https://www.heavym.net/heavym-2-15-update/)

### Inferences
- **Minimum credible blending feature set** (the Resolume parity set): per-edge width; power/exponent; midpoint luminance; gamma (global plus per RGB); black-level compensation (raise non-overlap black); a test card with diagonal lines for alignment; per-output brightness, contrast and RGB.
  - LPMT's shader, Bourke's formula and Resolume's parameter names give a ready spec.
- **Blending belongs in an output/screen stage.** Today soft-edge feathering exists on frames, but projector blending must happen after per-output warping, on an output-sized canvas. This argues for a "Screens/Outputs" object model (a fixed composition, then N outputs, each with slices and an input selection) before more per-frame features are added.
- **Multi-display output** in the browser is feasible on Chromium via the Window Management API, opening one fullscreen window per projector. It is still experimental, so a fallback is needed: a single spanned window, or NDI/hardware splitters such as Datapath. The latter is an assumption about deployment, not sourced.
- **Automatic overlap detection** (WATCHOUT) is a cheap UX win once outputs are placed on a shared stage canvas: blend zones can be computed from rectangle intersections.

### Gaps
- No documented maximum outputs for Resolume besides the macOS 8-display known issue; no documented maximums for Millumin.
- Millumin soft-edge gamma and black-level controls are not documented. They may exist in the UI.

---

## 4. Calibration: camera-based auto-calibration, structured light, 3D mapping and projector pose

### Takeaway
**Manual point-pair projector pose solving is mainstream.** The user clicks at least 6 model points onto reality and the tool solves the projector's position, orientation, FOV and lens shift against a 3D model. It is found in:
- MadMapper, with OBJ "Calibrate" and a live RMS error
- Millumin, which auto-places points after 6
- WATCHOUT 7, with at least 6 virtual points and a reprojection error readout
- disguise QuickCal, with roughly 10–15 points
- Splash, with at least 6 (7 recommended)
- TouchDesigner camSchnappr, which uses OpenCV `calibrateCamera`

**True camera-based structured-light auto-calibration is rare.**
- disguise OmniCal is native.
- WATCHOUT and TouchDesigner Pro rely on third parties (VIOSO, Scalable).
- Resolume, Millumin and HeavyM have none.
- Splash removed its broken Calimiro integration in 2025.

**MadMapper is the mid-tier exception, with partial camera tools:**
- **Space Scanner** projects stripe patterns, captured by a webcam, USB camera or DSLR. It produces a high-resolution projector-view "calibration map" to trace over. It does not produce an automatic warp/blend or a 3D model.
- **LED Scanner** auto-places LED fixtures by camera.

**HeavyM has no camera calibration and no automatic shape detection.** This contradicts the brief's premise: nothing was found in its help centre. The closest feature is a background photo taken from the projector position, for tracing.

### Cited Findings

**Millumin "Structure"**
- Import OBJ or DAE, drag mesh corners onto the real object in output mode, and "Once 6 points have been mapped, you can click the 'auto-place points'".
- Then set the audience viewpoint, for anamorphosis.
- Source: [Millumin Structure](https://help.millumin.com/docs/display/structure/)
- Nobody replied to a May 2024 forum question about camera-based auto-blending, comparing VIOSO with Pixera — [Millumin forum 2211](https://forum.millumin.com/discussion/2211/camera-auto-blending-system-for-millumin-is-there-any)

**WATCHOUT 7**
- **Point solve:** virtual points on the model, matched to reality points in projector output, with at least 6 points. Solve is Manual or Continuous, reprojection error is reported, and lens shift or throw can be locked.
- Gamepad editing is supported, and there is no built-in automatic camera calibration.
- Source: [WATCHOUT Display Calibration](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/display-calibration.html)
- **External tool hook:** an NDI "Calibration Stream" input, plus an HTTP trigger (`POST /v0/inputs displaycalibration`) for external tools such as VIOSO — [WATCHOUT Display Calibration](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/display-calibration.html)
- MPCDI 1.0 import arrived in 7.1.2 (2024-03-25) — [WATCHOUT release notes](https://dataton.com/watchout/release-notes)
- VIOSO exports MPCDI v2 to WATCHOUT 7 (undated page, around 2022) — [VIOSO docs](https://docs.vioso.com/guide/mediaservers/dataton/watchout-v.7)

**disguise OmniCal**
- **How it works:** camera-based structured light builds a point cloud and solves projectors, cameras and surfaces together.
  - QuickAlign for manual wireframe alignment; Mesh Deform conforms the model to the point cloud; RigCheck re-solves when projectors move.
  - Capture is "one-button", typically under a minute. PoE cameras come in kits of up to 4 or 8.
- **Requirements:** opaque, non-reflective surfaces and low, constant ambient light.
- Source: [disguise OmniCal overview](https://help.disguise.one/workflows/calibration-projection/omnical-overview)
- Every surface point must be seen by at least 2 cameras (search snippet) — [disguise OmniCal Capture](https://help.disguise.one/en/Content/Calibrating/OmniCal/Capture.htm)
- **QuickCal:** about 10–15 reference points per projector, at least 6 recommended, with mesh accuracy of ±5 mm — [disguise QuickCal overview](https://download.disguise.one/workflows/calibration-projection/quickcal-overview); [disguise QuickCal ref points](https://help.disguise.one/workflows/calibration-projection/quickcal-ref-points)
- OmniCal Score and the RigCheck API arrived in r32.4 (2026-03-11) — [disguise r32 release notes](https://help.disguise.one/designer/release-notes/r32)

**Splash**
- **Geometric:** at least 6 vertex/pixel pairs (7 recommended), solved by minimizing squared reprojection error. Calibration points are model-independent — [Splash geometric calibration](https://splashmapper.xyz/en/how-to/calibration/geometrical_calibration.html)
- **Colour calibration** is experimental and uses an HDR GPhoto camera — [Splash colorimetric calibration](https://splashmapper.xyz/en/how-to/calibration/colorimetric_calibration.html)
- **Calimiro removed:** 0.11.8 (2025-08-31) removed Calimiro, the structured-light library, as "non-functional for years" — [Splash News.md](https://gitlab.com/splashmapper/splash/-/blob/master/News.md). The standalone library still exists — [Calimiro](https://gitlab.com/splashmapper/calimiro)

**TouchDesigner**
- **camSchnappr** is a MAPAMOK port: at least 6 points are solved with OpenCV `calibrateCamera` into a Camera COMP, with optional distortion locks. Auto Blend uses Light COMPs — [camSchnappr docs](https://docs.derivative.ca/Palette:camSchnappr)
- **Pro-only** Vioso TOP and Scalable Display TOP provide camera-based auto-calibration — [TouchDesigner Products](https://docs.derivative.ca/TouchDesigner_Products)

**Resolume**
- No camera auto-calibration or OBJ/3D mapping appears in the docs or release notes from 7.19 to 7.28. Forum users are pointed to external tools such as Nestmap, or a third-party glTF plugin (search snippets) — [Resolume forum p=80652](https://www.resolume.com/forum/viewtopic.php?p=80652); [Resolume forum p=105130](https://resolume.com/forum/viewtopic.php?p=105130)
- A test card generator source arrived in 7.23 (Jul 2025) — [Resolume 7.23 blog](https://resolume.com/blog/30807)

**MadMapper**
- **Space Scanner:**
  - Projects black/white stripe patterns, captured by a webcam, USB camera or Canon DSLR.
  - Produces a high-resolution "calibration map" from the projector's point of view, used as a background layer. It does **not** build a 3D model.
  - The demo crops the map to 1/4 resolution.
  - Sources: [MadMapper docs: Space Scanner](https://docs.madmapper.com/madmapper/6/4.-surfaces/tools-space-scanner); [MadMapper docs: Licensing options](https://docs.madmapper.com/madmapper/6/13.-setup-and-installation/licensing-options)
- **LED Scanner:** a camera watches each LED flash and fixtures are auto-placed. **Laser Scanner** (5.5) uses a 16×16 dot matrix — [MadMapper docs: Special tools and auto-calibration](https://docs.madmapper.com/madmapper/6/12.-advanced/special-tools-and-auto-calibration)
- **3D Surface:** OBJ import only. A **"Calibrate"** toggle pairs model points with real-object points and shows live RMS error, then "Fix Position". 3D lighting adds lights and shadows — [MadMapper docs: Advanced 3D and scanning](https://docs.madmapper.com/madmapper/6/4.-surfaces/advanced-3d-and-scanning)
- OBJ files without UVs can use Triplanar, Planar or Spherical mapping — [GarageCube forum 4.0](https://forum.garagecube.com/viewtopic.php?f=20&t=35230) (2020)
- **No automatic camera-based multi-projector warp/blend.**
  - A user asked in Sep 2025, citing VIOSO at about $15k for 8 projectors.
  - Staff replied such tools are costly because the user base is small, and that "it would have to cost roughly the same".
  - Source: [GarageCube forum t=36342](https://forum.garagecube.com/viewtopic.php?f=29&t=36342)

**HeavyM**
- **No camera calibration, auto shape detection or 3D mapping was found.** The closest feature is a "Background Image", a photo taken from the projector's position to trace over — [HeavyM help: Background Image](https://help.heavym.net/hc/en-us/articles/4407417575186-The-Background-Image)
- "HeavyM is still a 2D software". The 3D Textures added in 2.14 are normal-mapped materials, not geometry — [HeavyM help: 3D textures](https://help.heavym.net/hc/en-us/articles/27332334294674-Applying-3D-textures-on-shapes)

### Inferences
- **Point-pair pose solving is a well-trodden next step after corner-pin**, with a consistent UX across vendors: at least 6 points, an error readout, and lockable intrinsics.
  - In a browser it can be done with opencv.js (`solvePnP`/`calibrateCamera`) or a small Levenberg-Marquardt solver. three.js handles the projector frustum render.
  - It unlocks "3D mapping" (OBJ/glTF onto objects) without a camera.
- **Camera-based structured light is a differentiator.** Only disguise ships it natively, and the open-source attempt (Calimiro) was abandoned.
  - A browser tool has `getUserMedia` webcams for free, so Gray-code structured light for 2D surface/grid capture is a plausible differentiator.
  - Point clouds and multi-camera capture are hard; disguise needs at least 2 cameras per point.
  - This is a speculative opportunity, not a proven path.
- **MPCDI import** (WATCHOUT and VIOSO) is a cheap interoperability feature: it lets third-party calibration systems feed warps, blends and masks.

### Gaps
- Camera models used by OmniCal are not confirmed. The spec sheet reportedly mentions Allied Vision Mako; not verified.
- No public data was found on how reliable the browser-side `getUserMedia` resolution and exposure control are for structured light. That would need a prototype.

---

## 5. LED & lighting: pixel mapping, DMX / Art-Net / sACN, fixtures, hardware

### Takeaway
**Commercial tools treat LED mapping as "fixtures sampled from the composition".** The fixture grid has a colour order, wiring (zigzag or straight), gamma and a universe layout. Output goes over Art-Net, sACN and sometimes USB DMX.

| Tool | Approach | Protocols |
|---|---|---|
| Resolume | Lumiverses + Fixture Editor | Art-Net only (no USB, no documented sACN) |
| Millumin | Mapping layer + Open Fixture Library light plot | Art-Net, sACN (2048 universes), Enttec, DMXking |
| disguise | DMX Screens + Sockpuppet | Art-Net, sACN, Enttec, KiNET |
| WATCHOUT 7 | Keyframed Art-Net fixture cues; LED walls via virtual displays and grid setup | No video→DMX pixel mapping found |

**MadMapper is the strongest mid-tier LED tool:**
- Art-Net 4 and sACN, up to 4096 universes, and USB DMX.
- Line, Circle and Bezier fixtures, plus a camera LED Scanner.
- MiniMad standalone hardware.

**HeavyM has DMX/Art-Net input only**, with no pixel mapping output.

### Cited Findings

**Resolume**
- **Lumiverses** are virtual sets of 512-channel universes:
  - Art-Net only, auto-discovered nodes, unicast or broadcast; Enttec USB is not supported in Arena 6+.
  - ArtSync supported; adjustable framerate; default 40 ms delay to sync with projectors.
  - Source: [Resolume DMX](https://resolume.com/support/en/dmx)
- **Fixture Editor:**
  - Pixel grid W×H; RGB, RGBW, RGBWA, CMY, mono and alpha.
  - 16 distribution orders including zigzag; gamma defaults to 2.5.
  - No 16-bit, UV or non-grid layouts.
  - Source: [Resolume Fixture Editor](https://resolume.com/support/en/fixture-editor)
- **sACN** is not documented. A 2021 staff reply on a feature-request thread mentions 256 universes per IP and 1024 Lumiverses (search snippet) — [Resolume forum p=101255](https://resolume.com/forum/viewtopic.php?p=101255); [Resolume forum p=96149](https://www.resolume.com/forum/viewtopic.php?p=96149)

**Millumin**
- **Protocols:** Art-Net (v1/v2, broadcast or unicast), sACN, Enttec USB Pro/Mk2, DMXking, MIDI/MSC, OSC/OSCQuery, Arduino and Teensy — [Millumin Devices](https://help.millumin.com/docs/connect/devices/)
  - sACN with up to 2048 universes arrived in 3.14 (Oct 2019) — [Millumin v4 change log](https://help.millumin.com/v4/general/change-log/)
- **LED mapping:**
  - A DMX layer samples the layers below it.
  - RGB, BGR and mono in 8 or 16 bit; custom fixtures; zigzag or straight wiring; curves.
  - Source: [Millumin LED mapping](https://help.millumin.com/docs/lighting/led-mapping/)
  - A Grid script for LED tiles arrived in 5.14 — [Millumin change log](https://help.millumin.com/docs/general/change-log/)
- **Light plot:** fixtures come from Open-Fixture-Library, with per-column light states and HTP merge — [Millumin Light plot](https://help.millumin.com/docs/lighting/light-plot/)

**disguise**
- DMX Screens output a screen's RGB over Art-Net, sACN, Enttec, Soundlight or KiNET.
  - RGB, RGBA, RGBW and CMY(K) only; no personality library; DMXShare to split control with a desk.
  - Source: [disguise DMX screens](https://help.disguise.one/designer/stage-setup/dmx-screens-lights/dmx-screens-lights-overview)
- **Sockpuppet** exposes layers as console fixtures — [disguise Sockpuppet](https://help.disguise.one/workflows/sockpuppet/sockpuppet-overview)
- GDTF export arrived in r32.2; 16-bit mono and custom DMX fixture types in r34.0 — [disguise r32](https://help.disguise.one/designer/release-notes/r32); [disguise r34](https://help.disguise.one/designer/release-notes/r34)

**WATCHOUT 7**
- **ArtNet Fixture Cues** send keyframed channel values at a fixed 44 fps; there is an Art-Net Recorder and GDTF import — [WATCHOUT Art-Net fixture cues](https://docs.dataton.com/watchout-7-new/watchout/timeline-and-cues/artnet-fixture-cues.html)
- **LED walls:** use a virtual display matched to the processor input — [WATCHOUT Virtual Displays](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/virtual-displays.html). Display Grid Setup tiles identical panels — [WATCHOUT Display Grid Setup](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/display-grid-setup.html)

**Protocol facts**
- Art-Net uses UDP port 6454 (0x1936) — [ETC Hog 4 support](https://support.etcconnect.com/HES/Consoles/Hog_4/Networking/What_port_number_does_Hog_4_use_to_send_Art-Net)
- Art-Net universes are 0–32767 per the specification — [QLC+ Art-Net docs](https://docs.qlcplus.org/v4/plugins/art-net)

**Browser platform**
- The Web Serial API can talk to USB-serial devices from HTTPS pages after a user gesture via `navigator.serial.requestPort()`. It is not Baseline — [MDN Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)

**MadMapper (MadLight is its lighting side)**
- Since v6, DMX fixtures sample the output composition through auto-created or user-defined DMX canvases — [MadMapper docs: v6 what's new](https://docs.madmapper.com/madmapper/6/1.-introduction/what's-new/madmapper-v6)
- **Fixtures:**
  - Types are DMX Fixture, Line, Circle and Bezier.
  - Sampling filters are None, Box and Anamorphic, plus a response curve.
  - Definitions are .mmfl files with RGB, RGBW or Custom pixel types in LED Strip or Matrix mode.
  - Source: [MadMapper docs: DMX fixtures](https://docs.madmapper.com/madmapper/6/5.-dmx-and-led-mapping/dmx-fixtures)
- **Protocols:** Art-Net 4, sACN, universe sync, up to 4096 universes, up to 1000 fps DMX, CSV fixture import and moving heads — [MadMapper features](https://madmapper.com/madmapper/features)
- **USB DMX devices:** garageCube, ShowJockey, Enttec Pro/Pro MK2, DMXking eDMX2 Pro — [MadMapper docs: DMX fundamentals](https://docs.madmapper.com/madmapper/6/5.-dmx-and-led-mapping/dmx-fundamentals)
- **6.2 beta:** CIE xy and HSI fixture colour, and a MadLight player track — [GarageCube forum 6.2 beta](https://forum.garagecube.com/viewtopic.php?f=20&t=36481)
- **MiniMad hardware (€229 + tax):**
  - Raspberry Pi 2 with one HDMI output; mapped video up to 1080p25.
  - Quad, Triangle, Circle and Mask surfaces with MeshWarping.
  - Up to 30 units network-synced; Light mode outputs up to 64 Art-Net universes.
  - Source: [MiniMad product page](https://madmapper.com/minimad/product)
  - Plays one media at a time, with no Lines, 3D surfaces or FX — [MadMapper docs: MiniMad](https://docs.madmapper.com/madmapper/6/6.-outputs/minimad)
- No Philips Hue support was found.

**HeavyM**
- **DMX input over Art-Net only** (Pro, since 2.6), for control from a lighting desk — [HeavyM help: DMX/Art-Net](https://help.heavym.net/hc/en-us/articles/4415013301010-Controlling-HeavyM-via-DMX-Art-Net-Pro)
- The pricing comparison lists only "DMX input via Art-Net"; no pixel mapping or DMX output — [HeavyM pricing](https://www.heavym.net/pricing)

### Inferences
- **For a browser tool, LED pixel mapping is mostly a sampling-and-encoding problem.** Read back fixture pixel positions from the composition (WebGL `readPixels` on a small fixture texture), apply gamma and colour order, and pack 512-byte universes.
- **Transport is the hard part:**
  - Web pages have no raw UDP socket, so Art-Net and sACN need a local bridge: an Electron/Tauri shell, or a tiny companion app receiving WebSocket.
  - The other route is a Web Serial USB DMX interface. Enttec DMX USB Pro-class devices appear as serial ports, and Millumin supports Enttec, which shows the device class is relevant.
  - The no-UDP point is general platform knowledge, not a sourced claim in these notes.
- **Recommended order:** fixture model plus preview overlay first, then output via a bridge. Resolume's Fixture Editor feature list is a good MVP spec: grid W×H, colour modes, distribution orders, gamma, universe auto-span.

### Gaps
- Resolume's sACN support status in 7.28 is unconfirmed; it is not in the docs.
- WATCHOUT 7 video-to-DMX pixel mapping: none found.
- No browser-specific DMX product benchmarks were found.

---

## 6. Show control: timelines, cues, timecode, scheduling, unattended operation, APIs

### Takeaway
Show control splits into two camps:
- **Timeline/cue-centric tools** (WATCHOUT, Millumin, disguise) offer LTC/MTC chase, cue lists, redundancy and HTTP APIs.
- **Clip/column-centric VJ tools** (Resolume) offer autopilot, SMPTE follow, REST/OSC and, new in 2026, MCP servers.

MadMapper 6 now spans both camps: keyframe timelines, a Conductor synced to MTC/LTC/Art-Net timecode, Scenes/Cues, and an ICS **Calendar Scheduler**. HeavyM Pro+ has explicit installation automation: start at boot, auto-play, and remote project update.

Elsewhere, time-of-day scheduling is rarely built in, and installers rely on OS scheduling or external show controllers. APIs are moving toward HTTP + WebSocket/SSE and, in 2026, MCP (Resolume 7.26 and the MapMap dev branch).

### Cited Findings

**Resolume**
- SMPTE/LTC follow (Arena only) — [Resolume SMPTE](https://resolume.com/article/46)
- Column autopilot and a global clock arrived in 7.22 (Dec 2024) — [Resolume 7.22 blog](https://resolume.com/blog/27125)
- REST API and webserver on port 8080, with a custom index.html web UI and a WebSocket subscription API — [Resolume REST API](https://resolume.com/article/132)
- **7.26 (Apr 2026)** added local **MCP servers** for Arena/Avenue and Wire, a REST "monitors" endpoint for live output snapshots, and batch operations — [Resolume 7.26 blog](https://resolume.com/blog/34484)
- **Unattended use** (old forum, search snippet): Arena reloads the last composition and output configuration, and the layer option "Trigger first clip when composition has loaded" helps installations — [Resolume forum p=37451](https://www.resolume.com/forum/viewtopic.php?p=37451); [Resolume forum p=49949](https://resolume.com/forum/viewtopic.php?p=49949)

**Millumin**
- **Timecode:** receives LTC, MTC and NTC with freewheel. Since 5.12 (Apr 2025) it also **generates** MTC, LTC and NTC — [Millumin Timecodes](https://help.millumin.com/docs/connect/timecodes/); [Millumin change log](https://help.millumin.com/docs/general/change-log/)
- **Timelines:** segments per column and multi-canvas timelines — [Millumin Timeline](https://help.millumin.com/docs/playback/timeline/)
- **5.14 (Nov 2025)** added "Silent Edition", for editing a show without the audience seeing it — [Millumin change log](https://help.millumin.com/docs/general/change-log/)
- OSC covers "(almost) any feature"; there is no first-party web UI — [Millumin OSC API](https://help.millumin.com/docs/connect/osc-api/)
- No time-of-day scheduler is documented — [Millumin Interactions](https://help.millumin.com/docs/connect/interactions/)

**WATCHOUT 7**
- **Show structure and control:** timelines, cues, conditional cues and cue sets; OSC, Art-Net input, MIDI Bridge, LTC Bridge, PosiStageNet and MSC — [WATCHOUT User Guide index](https://docs.dataton.com/watchout-7-new/watchout/index.html)
- **HTTP REST API on port 3019:** play, pause, jump-to-time and jump-to-cue, the whole show as JSON, and SSE/NDJSON event streams. No authentication by default — [WATCHOUT HTTP REST API](https://docs.dataton.com/watchout-7-new/watchout/external-control/http-rest-api.html)
- **Redundancy:** a redundant Director pair with standby takeover "within seconds" — [WATCHOUT 6 vs 7](https://docs.dataton.com/watchout-7-new/watchout/getting-started/architectural-differences-watchout-6-vs-7.html)

**disguise**
- **Transports:** LTC and MTC chase, MIDI, MSC, OSC and Art-Net — [disguise Transports overview](https://help.disguise.one/designer/timeline-tracks-transports/transports-overview)
- **HTTP/JSON Service and Session APIs** with OpenAPI docs — [disguise API intro](https://developer.disguise.one/api/introduction/)
- **Understudy machines** pair 1:1 with licences — [disguise X-series FAQ](https://help.disguise.one/disguise-x-series/disguise-x-series-faqs)

**Open source**
- **Splash:** OSC on port 9090, a WebSocket controller (0.12.2), Python scripting and LTC — [Splash OSC](https://splashmapper.xyz/en/how-to/controls/osc_controller.html); [Splash News.md](https://gitlab.com/splashmapper/splash/-/blob/master/News.md)
- **MapMap:** OSC with wildcard names, plus an opt-in embedded MCP server on the 2026 dev branch — [MapMap OSC](https://github.com/mapmapteam/mapmap/blob/dev/docs/informations/osc.md); [MapMap McpServer.h](https://github.com/mapmapteam/mapmap/blob/dev/src/control/McpServer.h)

**MadMapper**
- **Scenes and Cues:** a Scene is a full snapshot and a Cue holds selected parameters, with fades and launch quantize — [MadMapper docs: Scenes and cues](https://docs.madmapper.com/madmapper/6/10.-timelines/scenes-and-cues)
- **v6 timelines:**
  - Any parameter can be keyframed; montage tracks, audio with FFT and beat tracking, markers with follow actions.
  - The **Conductor** master timeline syncs to MTC, LTC or Art-Net timecode.
  - Export covers movie per output, ILDA and MadLight sequences.
  - Source: [MadMapper v6 release notes](https://docs.madmapper.com/madmapper/6/1.-introduction/what's-new/release-notes-v6)
- **Scheduling:** Timeline Automation and Timeline Scheduler modules, plus a **Calendar Scheduler** that imports ICS and works offline, 365 days ahead — [MadMapper docs: Scheduling and automation](https://docs.madmapper.com/madmapper/6/9.-master-settings/scheduling-and-automation)
- **Control:** MIDI and OSC in/out, OSC Query, Ableton Link, Stream Deck — [MadMapper features](https://madmapper.com/madmapper/features)
- **"Tasks"** (a GO-button cue list) is in the 6.2 beta — [GarageCube forum 6.2 beta](https://forum.garagecube.com/viewtopic.php?f=20&t=36481)
- No OS-level launch-at-boot setting is documented.

**HeavyM**
- **Sequencer:** a grid of Sequences, each with its own Map and transition. Timeline with cues (Pro), Audio Analysis and Autopilot — [HeavyM help: Sequencer](https://help.heavym.net/hc/en-us/articles/9172061701138-The-Sequencer)
- **Control:** MIDI, OSC API (Pro) and Ableton Link — [HeavyM help: OSC API](https://help.heavym.net/hc/en-us/articles/11763711559058-OSC-API-Pro)
- **Pro+ startup automation:** start at boot, open a project, auto-play Timeline or Autopilot, suppress pop-ups, and remote project update via a cloud-synced folder — [HeavyM help: Automating startup](https://help.heavym.net/hc/en-us/articles/12172939050642-Automating-project-startup-and-updating-remotely-Pro)
- **"HeavyM Server"** is a turnkey media server, sold by quote, with remote control, automatic power on/off and restart after a power cut — [HeavyM Server](https://www.heavym.net/heavym-server/)

### Inferences
- **A web-native tool has an advantage in remote control:** a built-in REST/WebSocket API and a web remote are natural. Resolume and WATCHOUT treat these as pro features.
- **An MCP endpoint is now a precedent** (Resolume 7.26, MapMap dev) and is cheap for a JS app.
- **For installations, the minimum set is:**
  - autostart of the last project into present mode,
  - a "trigger first clip on load" equivalent,
  - a time-of-day schedule (MadMapper's ICS Calendar Scheduler is the benchmark),
  - a heartbeat/health endpoint,
  - a REST output snapshot (as in Resolume 7.26) for remote monitoring.
- **Timecode** in a browser: LTC can be decoded from audio input via Web Audio, and MTC arrives via Web MIDI. Both are inferences about feasibility, not sourced.

### Gaps
- Unattended-operation features such as watchdogs and auto-restart are poorly documented for all desktop tools. Most rely on OS-level solutions.
- No WATCHOUT 7 scheduler documentation was found.

---

## 7. Ease-of-use features for beginners

### Takeaway
HeavyM is the beginner benchmark:
- vector "Faces" filled with built-in generative effects, so no media is needed
- preset shapes and the Magnet for shared vertices
- presets and Random
- an in-app tutorial and 10 UI languages
- AI image and video generation (2.15)

It does **not** offer camera-based automatic shape detection (none found in its docs). MadMapper offers templates (video wall, 4-output soft-edge), drag-to-create quads at media aspect, a test-pattern generator and MadAI.

Pro tools offer UX accelerators rather than wizards:
- snapping and match-shape (Resolume)
- auto-place points after 6 (Millumin)
- quick output warping by double-click (Millumin 5.12)
- automatic overlap detection (WATCHOUT)
- virtual screens for pre-production (Resolume, disguise)
- SVG import/export of shapes (Millumin)

### Cited Findings

**Resolume**
- Snapping (Ctrl disables it), math in numeric fields, Match Input/Output Shape and multi-select bounding box — [Resolume Input Selection](https://resolume.com/article/50); [Resolume article 51](https://resolume.com/article/51)
- The Transform widget on the preview monitor arrived in 7.21 (Jul 2024) — [Resolume 7.21 blog](https://resolume.com/blog/24836)
- Forum users find the Slice Transform effect hard to grasp (search snippet) — [Resolume forum p=64103](https://resolume.com/forum/viewtopic.php?p=64103)

**Millumin**
- "Auto-place points", surface corner snapping and attaching, SVG import/export, "Copy Mapping Only", and quick output warping (5.12) — [Millumin Structure](https://help.millumin.com/docs/display/structure/); [Millumin Surfaces](https://help.millumin.com/docs/display/surfaces/); [Millumin change log](https://help.millumin.com/docs/general/change-log/)

**WATCHOUT 7**
- Automatic soft edges from overlap detection — [WATCHOUT Edge Blending](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/edge-blending.html)
- Gamepad editing of calibration points — [WATCHOUT Display Calibration](https://docs.dataton.com/watchout-7-new/watchout/displays-and-outputs/display-calibration.html)

**Kantan Mapper**
- Forum users asked for a cursor X/Y readout, a home-view button, pixel-unit crop editing instead of 0–1, and easier-to-grab handles — [Derivative forum: Kantan issues and proposals](https://forum.derivative.ca/t/kantan-mapper-issues-and-proposals/218454) (2021–22)

**Vendor positioning**
- HeavyM's own comparison positions HeavyM as "easiest for beginners" and not designed for monumental projects — [HeavyM: Best MadMapper alternatives](https://www.heavym.net/best-madmapper-alternatives-for-projection-mapping/). This is a vendor source, so it is biased.

**HeavyM**
- **Shapes and effects:** preset shapes, drag-dropped media auto-creates a Player, the Magnet, and a large effect and shader library.
- **Discovery tools:** Presets and Random (2.12, Dec 2023), an in-app tutorial (2.4, 2021), and 10 languages (2.13.5, Feb 2025).
- **AI generation** (2.15, 2026-03): image and 4-second loop video generation on HeavyM servers.
- Sources: [HeavyM update history](https://www.heavym.net/update-history/); [HeavyM 2.15 update](https://www.heavym.net/heavym-2-15-update/); [HeavyM software](https://www.heavym.net/heavym-software/)

**MadMapper**
- **Templates and helpers:** project templates (Video Wall, "SoftEdge Blending 4 Outputs"), a Grid Generator and a Test Pattern generator — [MadMapper docs: Video wall setup](https://docs.madmapper.com/madmapper/6/4.-surfaces/video-wall-setup); [MadMapper docs: Loopback and advanced output](https://docs.madmapper.com/madmapper/6/6.-outputs/loopback-and-advanced-output-techniques)
- **Drag to create:** dropping media on the stage creates a quad at the media's aspect — [MadMapper docs: Assigning content](https://docs.madmapper.com/madmapper/6/4.-surfaces/assigning-content-to-surfaces)
- **MadAI** (5.7, 2025-06-19) generates Materials and FX from text prompts, using paid credits — [GarageCube forum 5.7](https://forum.garagecube.com/viewtopic.php?f=20&t=36318)
- **Demo:** all features, but with a watermark, no saving, and a DMX blackout every 30 s — [MadMapper docs: Licensing options](https://docs.madmapper.com/madmapper/6/13.-setup-and-installation/licensing-options)

### Inferences
- **The browser tool can own "zero-install beginner + pro output stage".** Combine HeavyM-style draw-on-surface, effects and audio-reactivity with the Resolume parity set of input/output split and blending.
- **Cheap wins from the Kantan complaints:**
  - pixel-unit numeric fields (already on the TODO as "numeric warp"),
  - cursor coordinate readout,
  - a reset-view button,
  - larger hit areas for handles.

### Gaps
- No independent usability studies were found. Evidence is vendor claims and forum anecdotes.

---

## 8. Pricing, licensing and target audience (2026)

### Takeaway
Pricing tiers:

| Tier | Products and prices |
|---|---|
| Free / open source | MapMap, Splash, LPMT (GPL-3); ofxPiMapper (MIT) |
| Low (under €100) | 4mapper €39 one-time (browser competitor) |
| Mid (€300–800) | Resolume Avenue €299, Arena €799; Millumin lifetime from €399 (or rental from €29/7 days); TouchDesigner Commercial $600; MadMapper 6 €479 perpetual (2 seats) or €44/month rental; HeavyM Live €219 / Pro €439 / Pro+ €539 perpetual |
| High (thousands) | WATCHOUT 7 €3,200 per node; TouchDesigner Pro $2,200; disguise Designer Pro $1,500/yr; disguise X-series $6k–15k/yr; disguise hardware by quote (used VX 4 around $40k) |

Licensing models:
- **Perpetual + rental/rent-to-own** is the mid-tier norm (Resolume, Millumin, MadMapper, HeavyM, TouchDesigner).
  - Resolume and HeavyM include 12 months of updates.
  - MadMapper perpetual covers the current major version.
  - Dongles are optional (Resolume) or absent (MadMapper, Millumin).
- **Subscription** for software: disguise.

### Cited Findings

**Resolume**
- Avenue €299, Arena €799, Wire €399, per computer, with 12 months of updates — [Resolume shop](https://resolume.com/shop)
- "Your last eligible update will always continue working". The trial carries a watermark and a robot-voice overlay. Education discount is 50% — [Resolume shop](https://resolume.com/shop)
- Renewal is optional, not a subscription — [Resolume article 88](https://resolume.com/article/88)
- The dongle is optional (7.16+). Software keys phone home every 30 days — [Resolume article 84](https://resolume.com/article/84)
- The renewal price of €219 for Arena dates from 2019 — [Resolume blog 2019](https://resolume.com/blog/18695)
- A Nov 2025 review says the upgrade discount fell from 50% to 35% — [Projectile Objects comparison](https://projectileobjects.com/2025/11/28/resolume-vs-vdmx-vs-madmapper-vs-touchdesigner-which-live-visuals-software-and-why/)

**Millumin**
- Rental is 7 days €29, 30 days €69, 1 year €199 per computer. Lifetime "starts at 399€" and covers V1–V5. The upgrade to V5 starts at €85 — [Millumin homepage](https://www.millumin.com/)
- 30-day trial, macOS only (Big Sur 11+) — [Millumin homepage](https://www.millumin.com/)
- Seats are counted as simultaneous activations, payment goes through Paddle, and no dongle is mentioned — [Millumin License](https://help.millumin.com/docs/general/license/)

**WATCHOUT 7**
- RRP is €3,200 per licence; the upgrade from 6 is €1,950 — [Dataton FAQ: WATCHOUT 7 cost](https://www.dataton.com/downloads/faq-watchout-7/what-does-watchout-7-cost)
- Producer is free, and each media server needs a licence — [Dataton knowledge base](https://knowledge.dataton.com/knowledge/how-many-watchout-7-licenses-do-i-need-in-my-setup)

**disguise**
- **Designer:** Starter is free and watermarked. Pro is $159/month or $1,500/year; the tiered model started 2025-04-01 — [disguise Designer pricing](https://www.disguise.one/en/products/designer/pricing); [disguise licensing FAQ](https://www.disguise.one/en/designer-licensing-faqs)
- **X-series** (dongle on your own hardware): X1 $6,000/yr, X2 $10,000/yr, X3 $15,000/yr — [disguise X Series](https://www.disguise.one/en/products/x-series)
- A used VX 4 sells for $39,995 without a licence — [usedlighting.com listing](https://www.usedlighting.com/61157/disguise-vx-4-media-server)
- Older hardware moved to End of Support in r33.0 (2026-04-01) — [disguise r33](https://help.disguise.one/designer/release-notes/r33)

**TouchDesigner**
- Non-Commercial is free, capped at 1280×1280. Educational is $300, Commercial $600, Pro $2,200 — [TouchDesigner Licensing](https://derivative.ca/UserGuide/Licensing); [TouchDesigner Products](https://docs.derivative.ca/TouchDesigner_Products)
- Licences are perpetual with 1 year of updates; additional updates cost $300/yr — [TouchDesigner Commercial product page](https://derivative.ca/product/touchdesigner-commercial/34)

**Open source**
- MapMap GPL-3.0 — [MapMap repo](https://github.com/mapmapteam/mapmap)
- Splash GPLv3 — [Splash](https://gitlab.com/splashmapper/splash)
- ofxPiMapper MIT — [ofxPiMapper LICENSE](https://github.com/kr15h/ofxPiMapper/blob/master/LICENSE.md)
- LPMT GPL-3.0 — [LPMT repo](https://github.com/hvfrancesco/lpmt)

**Browser competitor 4mapper**
- Runs in Chrome or Edge. The free tier is 1 project, 10 files and 100 MB; PRO is €39 one-time — [4mapper vs MadMapper](https://4mapper.com/madmapper-alternative/)
- This is a vendor page, and it does not document its warping, blending or output features.

**MadMapper**
- **Live checkout prices** (FastSpring, EU/Austria IP, 2026-10-15, excluding tax):
  - Rent: €44 for 1 month/1 seat; €74 for 2 months/1 seat.
  - **Perpetual MadMapper 6:** €479 for 2 seats (one is a spare); €704 for 3 seats.
  - Upgrade to v6 "from 159€".
  - Source: [MadMapper software page](https://madmapper.com/madmapper/software)
- **Conflicting static prices:** the same page's static HTML says "From 39€/month" and "From 399€". This may be a stale fallback or regional pricing.
- **MadBundle (with MadLaser):** "From 49€/month" or "From 519€" — [MadBundle](https://madmapper.com/madbundle)
- **Licence rules:**
  - A seat is one computer; temporary licences never auto-renew.
  - Perpetual covers the current major version (6.x) only.
  - **No hardware dongle**, and every licence type has identical features.
  - Source: [MadMapper docs: Licensing options](https://docs.madmapper.com/madmapper/6/13.-setup-and-installation/licensing-options)
- **Education:** 30% off, except upgrades — [MadMapper education](https://madmapper.com/education)
- **Older upgrade price:** the v6 preorder upgrade was $99, rising to $129 — [CDM](https://cdm.link/madmapper-6-brings-timelines-markers-clips-more/) (2024-12-04)
- **Third-party figures:** a Nov 2025 review cites €479 standalone and €599 for the MadMapper + Laser bundle — [Projectile Objects comparison](https://projectileobjects.com/2025/11/28/resolume-vs-vdmx-vs-madmapper-vs-touchdesigner-which-live-visuals-software-and-why/)
- **MiniMad hardware** is €229 + tax — [MiniMad product page](https://madmapper.com/minimad/product)

**HeavyM** (live pricing page, 2026-10-15)
- **Pay Once** (perpetual, with 1 year of updates): Live €219, Pro €439, Pro+ €539.
- **Rent-to-Own:** Live €49/mo, Pro €99/mo, Pro+ €119/mo.
- **Editions:**
  - Live: 1 output, capped at 1920×1200.
  - Pro: unlimited outputs, Timeline, edge blending, NDI, OSC, DMX input.
  - Pro+: video export, startup automation, remote update, backup seat.
- Source: [HeavyM pricing](https://www.heavym.net/pricing)
- **Conflicting rent-to-own terms:** the pricing page says 6 payments, but a help article updated 2026-06-14 says the licence becomes perpetual after "12 consecutive monthly payments" — [HeavyM help: cancelling monthly payment](https://help.heavym.net/hc/en-us/articles/24941831045138-What-happens-to-my-license-if-I-cancel-my-monthly-payment)
- **Seats:** Live and Pro allow 1 computer, Pro+ allows 2 at once — [HeavyM help: multiple computers](https://help.heavym.net/hc/en-us/articles/24935419036946-Can-I-use-my-license-on-multiple-computers)
- **Education:** 50% off — [HeavyM help: education pricing](https://help.heavym.net/hc/en-us/articles/24935011263762-Are-there-special-prices-for-students-and-teachers)
- **Demo:** no save/load, and a watermark — [HeavyM help: Demo limitations](https://help.heavym.net/hc/en-us/articles/24915622270098-What-are-the-limitations-of-the-Demo-version)

**Target audiences (as positioned)**
- Resolume suits live VJ/music; MadMapper suits mapping, LED and installations — [r/vjing comment via mirror](https://cal1.lr.ggtyler.dev/r/vjing/comments/1g0lx08/first_vj_gig) (Oct 2024)
- Millumin suits theatre and timeline shows on Mac — [Millumin homepage](https://www.millumin.com/)
- WATCHOUT suits multi-display installations and shows — [Dataton homepage](https://www.dataton.com/)
- disguise suits touring, broadcast and xR at the premium end — [disguise X Series](https://www.disguise.one/en/products/x-series)

### Inferences
- **A browser tool's natural price position** is the gap between free OSS and HeavyM/Resolume Avenue, or a freemium model.
- **Its strongest differentiators against mid-tier desktop tools:** no dongle, cross-platform (Millumin is Mac-only), instant share and remote control.

### Gaps
- Resolume's 2026 renewal price is unknown (only 2019 figures).
- Millumin's per-seat lifetime prices beyond "starts at €399" are unknown.
- disguise hardware list prices are not public.
- WATCHOUT licence term (perpetual vs subscription) is not stated on the pricing page.

---

## 9. Common user complaints and feature requests

### Takeaway
The recurring pain points across forums and issue trackers are:
1. Perspective and warping limits on non-quad shapes: Resolume poly slices, the MapMap ellipse, the ofxPiMapper quad seam.
2. Mask coordinate-space confusion: Millumin.
3. Missing camera auto-calibration/auto-blend: Millumin, Resolume.
4. Missing 3D/OBJ import: Resolume.
5. Multi-output and edge blending missing in open source: MapMap, ofxPiMapper.
6. Handle and grab UX: Kantan, and MadMapper users asking for Figma-style edge handles.
7. Calibration and geometry entangled with scenes/cues: MadMapper.
8. Lock slices: Resolume.
9. sACN: Resolume.
10. Price and upgrade cost: Resolume.

Reddit was inaccessible for direct reading; see Gaps.

### Cited Findings

**Resolume**
- Polygon slice edits warp content (search snippet) — [Resolume forum p=58585](https://www.resolume.com/forum/viewtopic.php?p=58585)
- No perspective on polygons (search snippet) — [Resolume forum p=93004](https://resolume.com/forum/viewtopic.php?p=93004)
- Request for interior polygon points (search snippet) — [Resolume forum p=82331](https://www.resolume.com/forum/viewtopic.php?p=82331)
- Subdivision distortion (search snippet) — [Resolume forum p=72791](https://resolume.com/forum/viewtopic.php?p=72791)
- Lock slices requested around 2015 and on the 2020 wish list (search snippets) — [Resolume forum p=57385](https://www.resolume.com/forum/viewtopic.php?p=57385); [Resolume forum p=79944](https://www.resolume.com/forum/viewtopic.php?p=79944)
- OBJ/FBX import request (search snippet) — [Resolume forum p=105130](https://resolume.com/forum/viewtopic.php?p=105130)
- Z-axis fixtures request (search snippet) — [Resolume forum p=79682](https://www.resolume.com/forum/viewtopic.php?p=79682)
- sACN request (search snippet) — [Resolume forum p=101255](https://resolume.com/forum/viewtopic.php?p=101255)
- A Nov 2025 review criticises the yearly upgrade cost and the DXV codec lock-in — [Projectile Objects comparison](https://projectileobjects.com/2025/11/28/resolume-vs-vdmx-vs-madmapper-vs-touchdesigner-which-live-visuals-software-and-why/)
- Since 2024 there have been no major Advanced Output features, only incremental Slice Transform and Keystone Mask changes. The 7.28 blog promises "a few new slice effects" in 7.29 — [Resolume 7.28 blog](https://resolume.com/blog/34630)

**Millumin**
- No camera auto-blend (May 2024, unanswered) — [Millumin forum 2211](https://forum.millumin.com/discussion/2211/camera-auto-blending-system-for-millumin-is-there-any)
- MilluNode at scale: users want automatic display and resolution matching (Mar 2025) — [Millumin forum comment 6281](https://forum.millumin.com/discussion/comment/6281/)
- Masks drawn in pre-mapping coordinates confuse users (2014) — [Millumin forum comment 1341](https://forum.millumin.com/discussion/comment/1341/)

**WATCHOUT 7**
- Undated forum complaints (search snippets): 2D calibration "force function" missing in v7, HDR issues in 7.7.1, little learning material, no multi-operator editing — [Dataton forum: HDR in 7.7.1](https://forum.dataton.com/topic/81453-hdr-not-working-in-watchout-7-771); [Dataton forum: is v7 ready](https://forum.dataton.com/topic/74067-thoughts-is-version-7-ready-for-show-environments/)

**Kantan Mapper**
- Freeforms won't close, the viewport "flip-out" is show-stopping, handles are hard to grab, and texture IDs are not saved (2021–22) — [Derivative forum: Kantan issues](https://forum.derivative.ca/t/kantan-mapper-issues-and-proposals/218454)

**MapMap**
- Open requests: soft edges, multiple outputs, edge blending, timeline, brightness/contrast — [MapMap issue #66](https://github.com/mapmapteam/mapmap/issues/66); [MapMap issue #80](https://github.com/mapmapteam/mapmap/issues/80); [MapMap issue #117](https://github.com/mapmapteam/mapmap/issues/117); [MapMap issues](https://github.com/mapmapteam/mapmap/issues)

**ofxPiMapper**
- Quad diagonal seam, Pi 4 support, edge blending, and 1080p performance — [ofxPiMapper issue #22](https://github.com/kr15h/ofxPiMapper/issues/22); [ofxPiMapper issue #169](https://github.com/kr15h/ofxPiMapper/issues/169); [ofxPiMapper issue #171](https://github.com/kr15h/ofxPiMapper/issues/171)

**Splash**
- Platform and launch bugs (Ubuntu 25.10 Flatpak, Windows swapBuffer) and a crash in Compute Blending on Windows — [Splash issues](https://gitlab.com/splashmapper/splash/-/issues); [Splash issue #160](https://gitlab.com/splashmapper/splash/-/issues/160)

**HeavyM** (third-party, low reliability)
- A comparison lists cons as poor suitability for complex 3D mapping or organic shapes, limited cue automation and external control, and a free-plan watermark — summarized from a search result; [Techjockey HeavyM](https://www.techjockey.com/detail/heavym)

**MadMapper**
- **Scenes store surface geometry and masks.** Remapping a 40-scene project at the venue means updating every scene; workarounds are cues, batch record mode, or copy/paste of output geometry (Mar 2026) — [GarageCube forum t=36417](https://forum.garagecube.com/viewtopic.php?f=20&t=36417)
- **Calibration is entangled with content in cues;** users separate them with loopbacks (2025) — [GarageCube forum t=36243](https://forum.garagecube.com/viewtopic.php?f=20&t=36243)
- **Wishlist (Nov 2025):**
  - Figma/Resolume-style transform handles: "I often accidentally move a single vertex when I intend to grab an entire edge".
  - Rulers, a colour picker, and FX stacking.
  - Staff replied these are planned quality-of-life work.
  - Source: [GarageCube forum t=36370](https://forum.garagecube.com/viewtopic.php?f=29&t=36370)
- **Camera-based multi-projector auto-calibration** was requested (Sep 2025) — [GarageCube forum t=36342](https://forum.garagecube.com/viewtopic.php?f=29&t=36342)
- **Missing changelog:** none was posted for 6.1.5 — [GarageCube forum t=36470](https://forum.garagecube.com/viewtopic.php?f=20&t=36470)
- **No new surface types or warp models in 2024–2026.** Release work went to timelines, LED, buffers and integrations: 6.2 beta adds Notch blocks, TouchDesigner .tox, MediaPipe tracking and web pages as media — [GarageCube forum 6.0](https://forum.garagecube.com/viewtopic.php?f=20&t=36371); [GarageCube forum 6.1](https://forum.garagecube.com/viewtopic.php?f=20&t=36432); [GarageCube forum 6.2 beta](https://forum.garagecube.com/viewtopic.php?f=20&t=36481)

**HeavyM**
- No first-party user forum threads were found, and Reddit is behind a login wall.
- The only concrete issue found is the inconsistent rent-to-own terms (see section 8).

### Inferences
- **Several top complaints are things the browser tool already does, or is one step from:** unified non-quad perspective, undo, snap and numeric entry.
- **Locking**, separate output-space masks, and 3D/OBJ import are under-served even in paid tools, and are clear opportunities.

### Gaps
- Reddit (r/projectionmapping, r/vjing) could not be read directly: reddit.com and old.reddit.com fetches and the JSON API were blocked.
- No 2025–2026 Reddit threads surfaced via search. Community sentiment here is therefore drawn from vendor forums (via search snippets) and GitHub issues, not Reddit.

---

## 10. Consolidated feature matrix and build-order implications for the browser tool

### Takeaway
The browser tool already matches or exceeds open-source mappers on non-quad perspective, masks, feathering and undo.

**Largest gaps against the mid-tier (Resolume Arena, MadMapper, Millumin):**
1. A screen/output stage with input selection vs output transformation and output-space masks.
2. Grid/Bezier mesh warp beyond 4 corners (needs WebGL).
3. Projector edge blending with gamma and black-level controls, plus per-output colour.
4. Multiple physical outputs.
5. LED fixture pixel mapping with Art-Net/sACN.
6. Point-pair 3D projector calibration.

Camera auto-calibration is a high-end feature (disguise) and a potential differentiator later.

### Cited Findings
Legend: ✓ = documented; ✗ = documented absent or not found; ~ = partial/third-party; ? = unknown. The sources are the ones cited in sections 1–9.

| Feature | MadMapper | Millumin 5.14 | HeavyM | Resolume Arena 7.28 | WATCHOUT 7.8 | disguise r34 | MapMap | Splash 0.12 | ofxPiMapper | LPMT | Kantan/stoner | **Browser tool (now)** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Quad perspective (homography) | ✓ (Perspective checkbox) | ✓ | ✓ (Players, 4 corners) | ✓ (regular slices) | ✓ (cue corner pin; mesh "Perspective Correction") | ✓ (3D projector) | ✗ (bilinear via subdivision) | ✓ (via 3D camera) | ✓ (`p` mode) | ✓ | ✓ (Perspective/Bilinear) | ✓ (CSS matrix3d) |
| Triangle / polygon with perspective | ~ (triangle surface, interpolation undocumented; masks attachable to quad/input/output ✓) | ✗ triangle affine (slices/surfaces); masks pre-warp ✓ | ✗ (Faces not texture-warped; "Center +" effect perspective) | ✗ (poly = linear only) | n/a (masks output-space) | n/a (3D meshes) | ✗ (affine/fan) | n/a | ✗ (affine); circle = quad + mask ✓ | ✓ masks inside homography | ~ (shape as mask) | ✓ (shape through same homography) |
| Grid/mesh warp | ✓ (Bezier, "unlimited points", precision) | ✓ (division, Bezier) | ✓ (Player + output grid, Linear/Bezier, 1–15 subdiv.) | ✓ (linear + Bezier points) | ✓ (Bezier mesh, presets 2×2–3×3+) | ✓ (4pt/9pt/custom/grid) | ✓ (mesh) | ✓ (Bezier patch 4×4) | ✓ (linear) | ✓ (Bezier 4×4, grid 7×6) | ✓ (Bezier/Linear) | ✗ |
| Input vs output split | ✓ (Input view UVs; Link Input/Output Mesh) | ✓ (slice editor + mapping) | ~ (Slice Selector crop) | ✓ (Input Selection / Output Transformation) | ~ (stage → display) | ✓ (feed rects / UV) | ✓ (input/output shapes) | n/a (UV) | ✓ (texture vs surface mode) | ~ | ✓ (texture editor) | ✗ |
| Masks with feather | ✓ (multiple Bezier masks per surface, feather) | ✓ (px feather) | ~ (masks; no feather documented; Player soft edge) | ~ (masks, no feather documented; per-slice soft edge) | ✓ (per-junction alpha + gamma) | ✓ (soft-edge textures) | ✗ | n/a | ✗ | ~ (polygon masks) | ✓ (softedge) | ✓ |
| Output-space masks | ✓ (Global Mask surfaces; attach to "Nothing") | ✓ (canvas masks) | ~ (group-scoped masks) | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ |
| Edge blending | ✓ quads only (width, power, Auto Setup; BLC in 6.2 beta) | ✓ (amount, smoothness) | ✓ Pro (width, gamma, smooth, auto width) | ✓ (gamma RGB, power, luminance, BLC) | ✓ auto (gamma; no BLC) | ✓ auto 3D (gamma, black-level curve) | ✗ | ✓ auto per-vertex | ✗ | ✓ (shader) | ✓ projectorBlend | ✗ |
| Multiple outputs / virtual screens | ✓ (as many as GPU; Video Buffer outputs, Loopback) | ✓ / video routing | ✓ Pro (screens on canvas; NDI per screen) | ✓ / ✓ virtual + routing | ✓ / ✓ virtual displays | ✓ | ✗ (1 window) | ✓ (8 outputs tested) | ✗ | ~ | ~ (1 window) | ✗ |
| Per-output colour correction | ~ (per-surface Color Controls FX) | ✓ | ✗ (not found) | ✓ (screen + slice) | ✓ (white point) | ✓ | ✗ | ✓ (exp. colour cal.) | ✗ | ✓ (colorize) | ~ | ✗ |
| Point-pair 3D projector pose | ✓ (OBJ Calibrate, RMS) | ✓ (≥6 pts auto-place) | ✗ | ✗ | ✓ (≥6 pts) | ✓ QuickCal | ✗ | ✓ (≥6 pts) | ✗ | ✗ | ✓ camSchnappr | ✗ |
| Camera auto-calibration | ~ (Space Scanner calibration map; LED Scanner) | ✗ | ✗ (no auto shape detection found) | ✗ | ~ (VIOSO via NDI/MPCDI) | ✓ OmniCal | ✗ | ✗ (removed 2025) | ✗ | ✗ | ~ (Pro: Vioso/Scalable) | ✗ |
| LED pixel mapping | ✓ (Line/Circle/Bezier fixtures) | ✓ | ✗ | ✓ (fixtures) | ~ (virtual display → LED processor; Art-Net cues) | ✓ DMX screens | ✗ | ✗ | ✗ | ✗ | ~ (TD generic) | ✗ |
| Art-Net / sACN / USB DMX | ✓ / ✓ / ✓ | ✓ / ✓ / ✓ | input only / ✗ / ✗ | ✓ / ✗? / ✗ | ✓ / ? / ? | ✓ / ✓ / ✓ | ✗ | ✗ | ✗ | ✗ | ✓ (TD generic) | ✗ |
| Timeline / cues | ✓ (v6 timelines, scenes/cues; Tasks in 6.2β) | ✓ | ✓ (Sequencer + Timeline Pro) | ~ (columns, autopilot) | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ~ | ✗ (on TODO) |
| Timecode in | ✓ MTC/LTC/Art-Net TC | ✓ LTC/MTC/NTC + generate | ? (not found) | ✓ SMPTE | ✓ LTC (bridge) | ✓ LTC/MTC | ✗ | ✓ LTC | ✗ | ? | ✓ (TD generic) | ✗ |
| OSC / HTTP API | ✓ OSC/OSCQuery/MIDI (no HTTP API found) | ✓ OSC | ✓ OSC (Pro), MIDI | ✓ OSC + REST/WS + MCP | ✓ OSC + REST/SSE | ✓ REST | ✓ OSC (+MCP dev) | ✓ OSC/WS | ~ TCP JSON | ✓ OSC | ✓ | ? |
| 3D model import | ✓ OBJ | ✓ OBJ/DAE | ✗ (2D only) | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Platform | Win/macOS (+MiniMad Pi) | macOS | Win/macOS | Win/macOS | Win | Win (disguise hw / X-series) | Win/mac/Linux | Linux (+early Win) | Pi/oF | Linux (+forks) | Win/mac | Browser |

### Inferences
Suggested build order for the browser tool. This is my synthesis; each step cites the precedent above.

1. **WebGL compositor with an Output/Screen stage.** This is already the top TODO candidate.
   - Fixed composition → N screens.
   - Each screen holds slices with an **Input Selection** rect or polygon in composition space, an **Output Transformation**, and **output-space masks**.
   - Precedents: Resolume, Millumin canvases, WATCHOUT displays.
2. **Mesh warp inside the corner-pin.** Use an N×M grid with Linear/Bezier points and a "Perspective vs Bilinear" toggle, rendered in a shader.
   - Bake to a UV/displacement texture, as stoner and Kantan output UV maps.
   - Port the homography math from ofxPiMapper (MIT). Write the Bezier patch evaluation fresh, as in Splash and LPMT (both GPL).
3. **Projector blending and per-output colour.**
   - Per-edge width, power, luminance, gamma (RGB) and black-level compensation, using the Resolume vocabulary and the Bourke/LPMT formula.
   - Auto-detect overlaps between screens placed on a shared stage, as WATCHOUT does.
   - Add a test card with alignment diagonals.
4. **Multi-display output** via the Window Management API: one fullscreen window per screen, plus a fallback single spanned window.
5. **Virtual screens and screen-to-screen routing.** This enables multi-stage warping, as with Resolume slice routing and WATCHOUT virtual displays, and is the substrate for LED mapping.
6. **LED fixtures:** a Fixture Editor with grid, colour order, zigzag and gamma, sampled from the composition. Output through a local Art-Net/sACN bridge, or Web Serial USB-DMX.
7. **Show control:** cue list/timeline, autostart into present mode, schedule, REST/WebSocket API and remote output snapshots. MCP is optional, with Resolume 7.26 and MapMap as precedent.
8. **3D mapping:** OBJ/glTF import and projector pose from at least 6 point pairs (opencv.js), then 3D auto-blend from projector frusta (disguise/Splash style).
9. **Camera calibration** via webcam structured light. This is a stretch goal and differentiator; only disguise does it natively.

Parallel quick wins (cheap, from the complaints):
- lock layer or slice
- pixel-unit numeric warp
- cursor readout
- "match input/output shape"
- SVG import/export of masks and shapes (Millumin)
- MPCDI import (WATCHOUT, VIOSO)

Additional lessons from MadMapper and HeavyM:
- **Keep calibration/geometry separate from content and cues.** MadMapper users' top structural complaint is that scenes store surface geometry ([GarageCube forum t=36417](https://forum.garagecube.com/viewtopic.php?f=20&t=36417)). The browser tool's project model should keep "stage/outputs/calibration" as a separate document from "scenes/cues/content".
- **Give every mask an explicit "attach to" option** — content/surface (follows warp), input, or output (fixed) — as MadMapper 4.0 did ([GarageCube forum 4.0](https://forum.garagecube.com/viewtopic.php?f=20&t=35230)).
- **Add edge-level transform handles** (grab an edge, not only vertices), as requested in [GarageCube forum t=36370](https://forum.garagecube.com/viewtopic.php?f=29&t=36370).
- **HeavyM's canvas → screens model** (rectangles on one canvas, each with its own perspective+grid warp, soft edge, rotation and NDI) is the closest template to the browser tool's fixed-composition architecture ([HeavyM help: Output Setup](https://help.heavym.net/hc/en-us/articles/35039776578834-The-Output-Setup)).
- **Mapping geometry is mature and not where competitors invest in 2024–2026.** Both mid-tier vendors put recent releases into show control, LED, integrations and AI content generation (MadAI; HeavyM 2.15 AI). The browser tool should reach parity on geometry quickly and differentiate on workflow, sharing and remote control.

### Gaps
- MadMapper and HeavyM columns: see the per-section notes. Where marked "?", primary documentation was not found.
- No benchmarking data on WebGL/WebGPU mesh-warp performance at 4K or with multiple outputs in browsers; this needs prototyping.
