import { Canvas } from './components/Canvas'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

function App() {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <ErrorBoundary>
        <Canvas />
      </ErrorBoundary>
    </div>
  )
}

export default App
