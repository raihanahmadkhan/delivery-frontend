import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RouteLab from './lab/RouteLab'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouteLab />
  </StrictMode>,
)
