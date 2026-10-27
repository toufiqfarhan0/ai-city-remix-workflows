// Entry: styles, then the page shell (src/landmark/app.js) with the Skill identity for the capture API.
import './style.css'
import { SLUG, VERSION } from './config'
import { start } from './landmark/app.js'

start({ SLUG, VERSION })
