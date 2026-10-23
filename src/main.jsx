import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './play.css'
import App from './App.jsx'
import { installTapHaptics } from './logic/feedback'
import { applyTheme } from './logic/theme'

const RigLab = lazy(() => import('./screens/RigLab.jsx'))
const lab = import.meta.env.DEV && new URLSearchParams(window.location.search).has('lab')

applyTheme()
installTapHaptics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {lab ? (
      <Suspense fallback={null}>
        <RigLab />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
