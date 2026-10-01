// Must be the FIRST import — installs a `require` shim so @thryvlabs/dex-react
// can resolve its Rolldown-stubbed CJS calls in the browser.
import './dex-require-shim'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import '@thryvlabs/dex-react/style.css'
import { DexProvider } from '@thryvlabs/dex-react'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DexProvider>
      <App />
    </DexProvider>
  </React.StrictMode>
)
