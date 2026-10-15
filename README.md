# Video Mapper

A high-performance web-based video mapping application built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui.

**Live Demo**: [https://videomapper.symbolicinterfaces.com](https://videomapper.symbolicinterfaces.com)

## Features

### 🎥 Media Management
- **Multiple Media Types**: Support for both videos and images
- **Persistent Media Library**:
  - Media files are stored in browser IndexedDB (persists across sessions)
  - Up to 2 GB per file; the total is limited by the browser's storage quota
  - Thumbnail previews for all media
  - Filter by video/image type
- **Linked media folders** (Chromium): play files straight from a folder on disk — nothing is copied, no size limit; one click reconnects the folder after a browser restart
- **Flexible Input Methods**:
  - Draw frames directly on canvas (rectangle, circle, or polygon shapes)
  - Add media via URL input
  - Drag & drop files onto the canvas
  - Select from Media Library

### 🎨 Frame Manipulation
- **Transform Controls**:
  - Drag to move frames anywhere on the canvas
  - Resize using 8 directional handles (corners and edges) on every shape
  - Rotate using the green circular handle above each frame
- **Shape Options**:
  - Rectangle frames (default)
  - Circle/ellipse frames with proper clipping
  - **Freeform Polygon frames** with vertex editing
    - Click to place vertices, double-click (or click the first point) to close
    - Drag purple handles to edit vertex positions; the frame box refits to the shape afterwards
    - The polygon cuts the media; a convex 4-vertex polygon can **stretch the media onto the quad** (its vertices become corner pins)

### ⚙️ Advanced Controls (Hover to Access)
- **Video Controls**:
  - Loop toggle
  - Playback speed adjustment (0.25x - 3x)
  - Audio mute/unmute
- **Visual Controls**:
  - Opacity adjustment
  - Blend modes (16 CSS blend modes, mixed against everything below the layer)
  - Shape switching (rectangle ↔ circle ↔ polygon); layer order lives in the layers panel
- **Frame Actions**:
  - Delete individual frames
  - Settings panel with all adjustments

### 💾 Project Management
- **Multiple projects** in IndexedDB: create, rename, duplicate, delete and switch in the *Projects* dialog (the previous single autosave slot is migrated into the first project)
- **Auto-save** of the open project ~1 s after every change; a failed save (e.g. storage full) shows a notice with an export shortcut
- **Versions**: kept automatically every 5 minutes while you work, plus on demand (*Version* button or **Cmd/Ctrl+S**); restoring keeps the current state as a version first and can be undone
- **Export**: the project file (JSON, media referenced by id) or a portable **package** (zip with project.json and every media file)
- **Import**: project files and packages always open as a *new* project — the open one is never overwritten; broken layers are skipped and reported

### 📱 Progressive Web App (PWA)
- **Offline Support**: Works without internet connection
- **Installable**: Can be installed as a desktop/mobile app
- **Persistent Storage**: Media and projects persist in IndexedDB (persistent storage is requested on the first upload)
- **Fast Loading**: Service Worker caching for instant loads
- **Show-safe updates**: a new version is offered as a small notice in the editor — never a blocking dialog or an automatic reload, and never on the output

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will start at `http://localhost:5173` (default Vite port).

### Build for Production

```bash
npm run build
```

### Performance benchmark

Open `/?benchmark` (or *Performance benchmark* in the control panel) on the show machine. It plays 1–16 corner-pinned video layers through the same render path as the output — with a generated 1080p/4K test clip, your own file, or a clip from the media library — and reports display fps, p95/p99 frame times, stutter, dropped video frames, the highest stable layer count, the GPU and hardware-decode support per codec. Results export as JSON.

### Tests & Lint

```bash
npm test        # unit tests (Vitest) for geometry and project migration
npm run lint
```

### Preview Production Build

```bash
npm run preview
```

## PWA Installation

### Desktop Installation
1. Open the application in Chrome, Edge, or Firefox
2. Look for the install icon in the browser's address bar
3. Click the icon and select "Install" or "Add to Home Screen"
4. The app will be installed and accessible from your desktop

### Mobile Installation (iOS)
1. Open the application in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. The app will appear on your home screen

### Mobile Installation (Android)
1. Open the application in Chrome
2. Tap the menu button (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Confirm by tapping "Add" or "Install"
5. The app will appear on your home screen

## Usage Guide

### Creating Frames

1. **Draw Mode**:
   - Click "Rectangle" or "Circle" in the control panel
   - Click and drag on the canvas to create a frame
   - The frame will be created when you release the mouse

2. **Add from URL**:
   - Click "Add from URL" in the control panel
   - Select media type (Video or Image)
   - Enter the URL and click "Add"
   - Draw a frame on the canvas where you want the media to appear

3. **Drag & Drop**:
   - Drag video or image files directly onto the canvas
   - Frames will be created automatically at the drop position

### Manipulating Frames

- **Move**: Click and drag inside the frame's shape
- **Resize**: Click and drag the yellow square handles on the edges/corners
- **Rotate**: Click and drag the green circular handle above the frame
- **Delete**: Hover over frame → Click trash icon
- **Settings**: Hover over frame → Click layers icon

### Keyboard Shortcuts

- **P**: Toggle presentation mode
- **F**: Toggle fullscreen
- **B**: Blackout (kill all output — picture and sound — instantly)
- **G** / **Shift+G**: Toggle grid / snap-to-grid
- **Delete/Backspace**: Delete selection
- **Arrow keys**: Nudge selection by 1px (Shift = grid-size steps)
- **Cmd/Ctrl+Z** / **Shift+Cmd/Ctrl+Z**: Undo / redo
- **Cmd/Ctrl+C / X / V**: Copy / cut / paste frames
- **Cmd/Ctrl+D**: Duplicate selection
- **Cmd/Ctrl+A**: Select all frames
- **ESC**: Exit presentation mode, cancel draw mode, or deselect

### Composition & Output (Resolume-style)

- **Fixed composition resolution** (default 1920×1080, presets up to 4K + custom) — frames are stored in composition coordinates, so projects are portable across machines and map 1:1 onto the projector
- The editor letterboxes and scales the composition to your window; Present mode maps it to the output
- **Output window**: opens the composition in its own window for the projector while you keep editing. In Chromium browsers, *Detect screens* lets you pick the target display (Window Management API); elsewhere drag the window over. The output mirrors the editor live, shows no editor UI, hides the cursor, keeps the display awake and starts from the autosaved project (it keeps its last picture if the editor reloads). In the output window: click or **F** for fullscreen, **B** for blackout. While an output is live the editor preview is muted.
- **Master fader** dims the whole output (and scales audio volume); **Blackout (B)** kills picture and sound instantly
- **Test card**: global output test pattern, plus a per-frame test pattern to calibrate individual surfaces without content
- **Soft edge masks**: per-edge feathering on frames for blending overlapping projectors

### Warping (unified corner pin)

- Corner pin works the same on **every shape** (Photoshop-style): the four pins sit on the frame's box and define one homography; the media, the shape outline, the editing grid, vertex and resize handles, the selection outline and the click area all go through it — polygons/triangles keep straight edges, circles warp as conics
- Polygons with corner pin: double-click the shape (or use the pen button) to switch between editing the **corner pins** and the **shape's vertices**; vertices stay under the cursor even on a warped frame
- Pins cannot be dragged into a folded or mirrored quad
- A warped editing grid renders inside the frame while corner-pin editing, Resolume slice-style
- Corner-pin handles and polygon vertices snap to the canvas grid when snapping is on
- Typing W/H in the layers panel scales the pins like the resize handles do

### Layers & Selection

- **Layers panel** (right dock): visibility toggles, rename (double-click), reorder, duplicate/delete, plus numeric X/Y/W/H/rotation, opacity and blend mode for the selected frame
- **Multi-select**: shift+click frames or drag a marquee on empty canvas (hit-testing follows the warped shape); group drag, nudge, duplicate, copy/paste and delete all operate on the selection
- **Undo/redo** across frames, background and composition changes (gestures coalesce into single steps)

### Grid & Snapping

- Toggle the grid overlay and snap-to-grid from the "Grid" section in the control panel (or **G** / **Shift+G**)
- Grid size is selectable (8–128 px); accent lines mark every 5th cell
- Snapping applies to drawing, dragging, resizing (rotation-aware), corner-pin handles, polygon vertices, and file drops
- Optionally keep the grid visible in presentation mode for projector alignment

## Offline Usage

Thanks to PWA capabilities, Video Mapper works offline:

1. **First Visit**: Visit the app once while connected to the internet
2. **Service Worker**: The service worker will cache all necessary files
3. **Offline Access**: The app will work even without an internet connection
4. **Media Storage**: All media is stored in IndexedDB and persists offline
5. **Project Storage**: Projects are saved to localStorage and work offline

**Note**: Media loaded from URLs will only be cached if visited once while online. For full offline capability, upload your media files directly or ensure they're cached by visiting them first.

## Performance

The current renderer is DOM/CSS based:

- **Hardware Acceleration**: CSS transforms (including `matrix3d` corner pin) are composited on the GPU
- **Video**: each frame uses its own native `<video>` element, so the same clip on N frames is decoded N times
- **Memory**: one object URL per stored media for the whole session, revoked when the media is deleted
- **Known limits**: every pointer move during a drag re-renders all frames (no memoization yet); a GPU compositor (WebGPU/WebGL2) is the planned next step
- **Service Worker Caching**: Assets are cached for fast offline access

### Recommended Best Practices

- Keep video file sizes reasonable (< 50MB per video)
- Use modern video codecs (H.264, VP9, AV1)
- Limit simultaneous videos to 5-10 for best performance
- Use lower resolution videos for background elements
- Consider using images instead of videos where animation isn't needed

## Technology Stack

- **React 19**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui** + **Radix UI** primitives (slider, slot)
- **Lucide React**: Icon library
- **Vitest**: Unit tests
- **vite-plugin-pwa**: Progressive Web App support
- **Workbox**: Service Worker caching strategies

## Browser Support

- Chrome/Edge (recommended for best performance)
- Firefox
- Safari
- Any modern browser with ES2022 support

## Project Structure

```
src/
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── Canvas.tsx           # Stage, gestures, history, persistence
│   ├── MediaFrame.tsx       # Frame content + editor overlay (handles, outlines, hit area)
│   ├── ControlPanel.tsx     # Left control panel
│   ├── LayersPanel.tsx      # Right layers dock with numeric properties
│   ├── MediaLibrary.tsx     # IndexedDB media library modal
│   ├── BackgroundSettings.tsx
│   ├── TestCard.tsx         # Calibration test pattern
│   ├── UpdatePrompt.tsx     # Service worker registration + update notice
│   └── ErrorBoundary.tsx    # Show-safe crash fallback (black output)
├── lib/
│   ├── geometry.ts          # Homography, corner pin, refit, shape helpers (+ tests)
│   ├── projectSchema.ts     # Project format validation + migrations (+ tests)
│   ├── projectRepository.ts # Projects + versions in IndexedDB (+ tests)
│   ├── storage.ts           # Serialization, JSON export, zip packages, import (+ tests)
│   ├── mediaStorage.ts      # IndexedDB media library
│   ├── mediaFolders.ts      # Linked media folders (File System Access)
│   └── utils.ts
├── types.ts                 # TypeScript type definitions
├── App.tsx                  # Root component
├── main.tsx                 # Entry point
└── index.css                # Global styles
```

## Future Enhancements

- [x] Grid and snap-to-grid
- [x] More keyboard shortcuts (delete, nudge, duplicate, clipboard, undo)
- [x] Multi-select frames (shift+click, marquee)
- [x] Copy/paste frames
- [x] Undo/redo functionality
- [x] Fixed composition resolution with letterboxed editing
- [x] Unified corner pin for all shapes + warped editing grid
- [x] Layers panel with numeric transform properties
- [x] Soft edge blending, test patterns, master fader & blackout
- [x] Export with embedded media (portable project files)
- [ ] Timeline for synchronized playback
- [ ] Audio waveform visualization
- [ ] Export as video file
- [ ] Advanced polygon warp with mesh deformation (WebGL)
- [ ] Bezier curve mask edges

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
