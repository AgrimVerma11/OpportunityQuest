import { createRoot } from 'react-dom/client'
import './tokens.css'
import './global.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ConfirmProvider } from './components/ConfirmProvider.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ConfirmProvider>
      <App/>
    </ConfirmProvider>
  </BrowserRouter>
)
