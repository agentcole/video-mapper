# Video Mapper

A high-performance web-based video mapping application built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui.

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

## Performance Optimization

This application is built with performance in mind:

- **Hardware Acceleration**: CSS transforms use GPU acceleration
- **Efficient Rendering**: React components are optimized to minimize re-renders
- **Video Optimization**: 
  - Videos use the native `<video>` element for best browser performance
  - Poster frames and lazy loading can be added for better initial load times
- **Event Throttling**: Mouse events are efficiently handled to prevent performance issues
- **Memory Management**: Object URLs are properly managed to prevent memory leaks

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
│   └── storage.ts       # localStorage management
├── types/
│   └── index.ts         # TypeScript type definitions
├── App.tsx              # Root component
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

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
