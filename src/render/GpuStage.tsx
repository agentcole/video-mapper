import React, { useEffect, useRef } from 'react';
import type { RenderScene } from './types';
import { Gl2Compositor } from './webgl/Gl2Compositor';

interface GpuStageProps {
  scene: RenderScene;
  // Device pixels per composition px (stage scale × devicePixelRatio)
  pixelsPerUnit: number;
  // WebGL2 missing or the compositor failed — the caller falls back to CSS
  onUnavailable: (reason: string) => void;
}

// Draws the composition content (background + frames) with the WebGL2
// compositor. Sits in the stage like the DOM content would, in composition
// coordinates; editor overlays stay DOM on top.
export const GpuStage: React.FC<GpuStageProps> = ({ scene, pixelsPerUnit, onUnavailable }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<Gl2Compositor | null>(null);
  const sceneRef = useRef(scene);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let compositor: Gl2Compositor | null = null;
    try {
      compositor = Gl2Compositor.create(canvas);
    } catch (error) {
      onUnavailableRef.current(`GPU renderer failed to start: ${(error as Error).message}`);
      return;
    }
    if (!compositor) {
      onUnavailableRef.current('WebGL2 is not available in this browser');
      return;
    }
    compositorRef.current = compositor;
    let raf = 0;
    let failed = false;
    const loop = () => {
      try {
        compositor!.render(sceneRef.current);
      } catch (error) {
        if (!failed) {
          failed = true;
          onUnavailableRef.current(`GPU renderer error: ${(error as Error).message}`);
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      compositor!.dispose();
      compositorRef.current = null;
    };
  }, []);

  const width = scene.composition.width * pixelsPerUnit;
  const height = scene.composition.height * pixelsPerUnit;
  useEffect(() => {
    compositorRef.current?.resize(width, height);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      data-canvas-bg="true"
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
};
