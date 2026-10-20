import React from 'react';
import type { CompositionSettings, Screen } from '../types';
import { homographyToCSS } from '../lib/geometry';
import { isValidQuad, sliceHomography } from '../state/screens';

interface ScreenDomProps {
  screen: Screen;
  composition: CompositionSettings;
  // The composition's content in composition px; `audible` is true for the
  // first slice only, so sound doesn't play once per slice
  renderComposition: (audible: boolean) => React.ReactNode;
}

/**
 * A screen with the CSS renderer: each slice is a copy of the composition,
 * clipped to its input rectangle and warped onto its four output corners
 * (matrix3d). Every slice plays its own copy of the media — the GPU
 * renderer draws the composition once and samples it instead.
 */
export const ScreenDom: React.FC<ScreenDomProps> = ({ screen, composition, renderComposition }) => {
  const shown = screen.slices.filter(s => s.enabled && isValidQuad(s.output));
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {shown.map((slice, i) => {
        const h = sliceHomography(slice);
        if (!h) return null;
        return (
          <div
            key={slice.id}
            className="absolute overflow-hidden"
            style={{
              left: 0,
              top: 0,
              width: slice.input.width,
              height: slice.input.height,
              transform: homographyToCSS(h),
              transformOrigin: '0 0',
            }}
          >
            {/* Only the composition: an input reaching past it shows nothing there */}
            <div
              className="absolute overflow-hidden"
              style={{ left: -slice.input.x, top: -slice.input.y, width: composition.width, height: composition.height }}
            >
              {renderComposition(i === 0)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
