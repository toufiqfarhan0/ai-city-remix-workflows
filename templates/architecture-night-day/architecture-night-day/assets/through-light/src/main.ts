// Entry: styles, then the page shell (src/scene/app.js) with the Skill identity for the capture API.
import './style.css'
import { SLUG, VERSION } from './config'
import { start } from './scene/app.js'

start({ SLUG, VERSION })
