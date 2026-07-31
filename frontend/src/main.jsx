import { createRoot } from 'react-dom/client'
import './tokens.css'
import './global.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ConfirmProvider } from './components/ConfirmProvider.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <App/>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
)
