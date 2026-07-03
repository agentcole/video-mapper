# Video Mapper

A high-performance web-based video mapping application built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui.

**Live Demo**: [https://videomapper.symbolicinterfaces.com](https://videomapper.symbolicinterfaces.com)

## Features

### 🎥 Media Management
- **Multiple Media Types**: Support for both videos and images
- **Persistent Media Library**:
  - Media files are stored in browser IndexedDB (persists across sessions)
  - 50MB per file limit, 500MB total storage
  - Thumbnail previews for all media
  - Filter by video/image type
- **Flexible Input Methods**:
  - Draw frames directly on canvas (rectangle, circle, or polygon shapes)
  - Add media via URL input
  - Drag & drop files onto the canvas
  - Select from Media Library

### 🎨 Frame Manipulation
- **Transform Controls**:
  - Drag to move frames anywhere on the canvas
  - Resize using 8 directional handles (corners and edges)
  - Rotate using the green circular handle above each frame
- **Shape Options**:
  - Rectangle frames (default)
  - Circle/ellipse frames with proper clipping
  - **Freeform Polygon frames** with vertex editing
    - Click to place vertices, double-click to close
    - Drag purple handles to edit vertex positions
    - Choose between Clip mode (cuts media) or Warp mode (stretches media)

### ⚙️ Advanced Controls (Hover to Access)
- **Video Controls**:
  - Loop toggle
  - Playback speed adjustment (0.25x - 3x)
  - Audio mute/unmute
- **Visual Controls**:
  - Opacity adjustment
  - Z-index layering control
  - Shape switching (rectangle ↔ circle)
- **Frame Actions**:
  - Delete individual frames
  - Settings panel with all adjustments

### 💾 Project Management
- **Auto-save**: Automatic saving to localStorage
- **Manual Save**: Save current project state
- **Export**: Download project as JSON file
- **Import**: Load previously exported projects

### 📱 Progressive Web App (PWA)
- **Offline Support**: Works without internet connection
- **Installable**: Can be installed as a desktop/mobile app
- **Persistent Storage**: Media and projects persist across sessions using IndexedDB
- **Fast Loading**: Service Worker caching for instant loads
- **Background Sync**: Automatic updates available when online

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

- **Move**: Click and drag the frame content
- **Resize**: Click and drag the blue square handles on the edges/corners
- **Rotate**: Click and drag the green circular handle above the frame
- **Delete**: Hover over frame → Click trash icon
- **Settings**: Hover over frame → Click layers icon

### Keyboard Shortcuts

- **P**: Toggle presentation mode
- **F**: Toggle fullscreen
- **B**: Blackout (kill all output instantly)
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
- **Master fader** dims the whole output; **Blackout (B)** kills it instantly
- **Test card**: global output test pattern, plus a per-frame test pattern to calibrate individual surfaces without content
- **Soft edge masks**: per-edge feathering on frames for blending overlapping projectors

### Warping (unified corner pin)

- Corner pin works on **every shape**: the shape's outline warps through the same homography as the content (Photoshop-style — polygons/triangles keep straight edges, circles warp as conics)
- A warped editing grid renders inside the frame while corner-pin editing, Resolume slice-style
- Corner-pin handles and polygon vertices snap to the canvas grid when snapping is on
- Polygon **warp** texture mode stretches media onto 4-vertex polygons (quads)

### Layers & Selection

- **Layers panel** (right dock): visibility toggles, rename (double-click), reorder, duplicate/delete, plus numeric X/Y/W/H/rotation, opacity and blend mode for the selected frame
- **Multi-select**: shift+click frames or drag a marquee on empty canvas; group drag, nudge, duplicate, copy/paste and delete all operate on the selection
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

## Performance Optimization

This application is built with performance in mind:

- **Hardware Acceleration**: CSS transforms use GPU acceleration
- **Efficient Rendering**: React components are optimized to minimize re-renders
- **Video Optimization**: 
  - Videos use the native `<video>` element for best browser performance
  - Poster frames and lazy loading can be added for better initial load times
- **Event Throttling**: Mouse events are efficiently handled to prevent performance issues
- **Memory Management**: Object URLs are properly managed to prevent memory leaks
- **Service Worker Caching**: Assets are cached for fast offline access

### Recommended Best Practices

- Keep video file sizes reasonable (< 50MB per video)
- Use modern video codecs (H.264, VP9, AV1)
- Limit simultaneous videos to 5-10 for best performance
- Use lower resolution videos for background elements
- Consider using images instead of videos where animation isn't needed

## Technology Stack

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: High-quality component library
- **Lucide React**: Icon library
- **Radix UI**: Accessible component primitives
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
│   ├── ui/              # shadcn/ui components
│   ├── Canvas.tsx       # Main canvas component
│   ├── MediaFrame.tsx   # Individual frame component
│   └── ControlPanel.tsx # Control panel UI
├── lib/
│   ├── utils.ts         # Utility functions
│   ├── storage.ts       # localStorage management
│   └── mediaStorage.ts  # IndexedDB media management
├── types/
│   └── index.ts         # TypeScript type definitions
├── App.tsx              # Root component
├── main.tsx             # Entry point with SW registration
└── index.css            # Global styles
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
- [ ] Background sync for offline changes
- [ ] Push notifications for project updates

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
