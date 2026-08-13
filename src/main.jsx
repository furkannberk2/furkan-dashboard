import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './components/AuthProvider'
import { PreferencesProvider } from './components/PreferencesProvider'
import './index.css'
import './i18n'

import { applyTheme, getInitialTheme } from './theme'
applyTheme(getInitialTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)