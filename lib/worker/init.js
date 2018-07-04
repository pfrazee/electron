'use strict'

const events = require('events')
const path = require('path')
const Module = require('module')

process.type = 'renderer' // DEBUG we need to be a renderer so that process.atomBinding gets the right modules

// We modified the original process.argv to let node.js load the
// init.js, we need to restore it here.
process.argv.splice(1, 1)

// Clear search paths.
require('../common/reset-search-paths')

// Import common settings.
require('../common/init')

// Expose public APIs.
Module.globalPaths.push(path.join(__dirname, 'api', 'exports'))

// The global variable will be used by ipc for event dispatching
var v8Util = process.atomBinding('v8_util')

v8Util.setHiddenValue(global, 'ipc', new events.EventEmitter())

// Process command line arguments.
let nodeIntegrationInWorker = false
let preloadScripts = []
for (let arg of process.argv) {
  if (arg.indexOf('--node-integration-in-worker') === 0) {
    nodeIntegrationInWorker = true
  } else if (arg.indexOf('--preload-scripts') === 0) {
    preloadScripts = arg.substr(arg.indexOf('=') + 1).split(path.delimiter)
  }
}

if (nodeIntegrationInWorker) {
	// Export node bindings to global.
	global.require = require
	global.module = module

	// Set the __filename to the path of html file if it is file: protocol.
	if (self.location.protocol === 'file:') {
	  let pathname = process.platform === 'win32' && self.location.pathname[0] === '/' ? self.location.pathname.substr(1) : self.location.pathname
	  global.__filename = path.normalize(decodeURIComponent(pathname))
	  global.__dirname = path.dirname(global.__filename)

	  // Set module's filename so relative require can work as expected.
	  module.filename = global.__filename

	  // Also search for module under the html file.
	  module.paths = module.paths.concat(Module._nodeModulePaths(global.__dirname))
	} else {
	  global.__filename = __filename
	  global.__dirname = __dirname
	}
} else {
  // Delete Node's symbols after the Environment has been loaded.
  process.once('loaded', function () {
    delete global.process
    delete global.Buffer
    delete global.setImmediate
    delete global.clearImmediate
    delete global.global
  })
}

// Load the preload scripts.
for (const preloadScript of preloadScripts) {
  try {
    require(preloadScript)
  } catch (error) {
    console.error('Unable to load preload script: ' + preloadScript)
    console.error(error.stack || error.message)
  }
}