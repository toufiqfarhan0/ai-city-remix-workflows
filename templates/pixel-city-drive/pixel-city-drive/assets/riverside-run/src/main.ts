// Entry: styles, then the page shell (src/drive/app.js) with the Skill identity for the capture API.
import './style.css'
import { SLUG, VERSION } from './config'
import { start } from './drive/app.js'

start({ SLUG, VERSION })
