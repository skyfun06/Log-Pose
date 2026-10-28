import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { demarrerSynchro } from './state/synchro'

// On récupère d'abord les données des autres appareils (téléphone / PC), pour
// que l'appli s'ouvre directement à jour.
void demarrerSynchro().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
