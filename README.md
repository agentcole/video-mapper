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

- **ESC**: Cancel draw mode (coming soon)
- **Delete**: Delete selected frame (coming soon)

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

- [ ] Multi-select frames
- [ ] Copy/paste frames
- [ ] Undo/redo functionality
- [ ] Timeline for synchronized playback
- [ ] Audio waveform visualization
- [ ] Grid and snap-to-grid
- [ ] More keyboard shortcuts
- [ ] Export as video file
- [ ] Advanced polygon warp with mesh deformation
- [ ] Bezier curve mask edges
- [ ] Background sync for offline changes
- [ ] Push notifications for project updates

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
