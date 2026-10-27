import { createRoot } from 'react-dom/client'
import App from './App'
import { installScene, signalError } from './capture'
import { params, t } from './params'
import './style.css'

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

installScene()
if (params.capture) document.body.dataset.capture = '1'
const root = createRoot(document.getElementById('root')!)
if (hasWebGL2()) {
  root.render(<App />)
} else {
  root.render(<p className="webgl-missing">{t.webglMissing}</p>)
  signalError()
}
