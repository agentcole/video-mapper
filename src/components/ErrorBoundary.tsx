import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

// Show-safe crash fallback: if rendering fails, the output goes black instead
// of turning into a white page or a browser error. A discreet reload button
// appears on hover; autosave restores the project on reload.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Video Mapper crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-screen h-screen bg-black relative">
          <div className="absolute bottom-4 right-4 flex items-center gap-3 text-xs text-white/80 bg-white/10 rounded px-3 py-2 opacity-0 hover:opacity-100 transition-opacity">
            <span>Something went wrong: {this.state.error.message}</span>
            <button onClick={() => window.location.reload()} className="underline">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
