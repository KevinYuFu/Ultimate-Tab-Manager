import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Full View opens this same page in its own browser tab (?view=full). Flag it
// on <body> so the CSS can render a centered card instead of a corner popup.
if (new URLSearchParams(window.location.search).get('view') === 'full') {
  document.body.classList.add('full-view')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
