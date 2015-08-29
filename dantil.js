/*!
 * dantil v0.0.1
 * Copyright (C) 2015 Danny Nemer
 * Available under MIT license <http://mths.be/mit>
 */

var fs = require('fs')
var util = require('util')
var colors = require('colors/safe')

/**
 * Project-agnostic utility functions for Node.js.
 * @module
 * @example
 * var dantil = require('./dantil/dantil.js')
 */


/**
 * Checks if an options object adheres to a schema. Simulates static function arguments (i.e., type checking and parameter count). Prints descriptive, helpful errors when `opts` is ill-formed.
 *
 * @param {Object} schema Definition of required or optional properties and their expected values in `opts`.
 * @param {Object} opts The options object to check if conforms to `schema`.
 * @return {Boolean} `true` if `opts` is ill-formed, else `false`.
 * @example
 * var schema = {
 *   num: Number,                                  // Must be of type `Number`
 *   list: { type: Array },                        // Must be of type `Array` (identical to previous parameter)
 *   strings: { type: Array, arrayType: String },  // Must be `Array` containing only String
 *   str: { type: String, optional: true },        // Parameter can be omitted
 *   val: [ 'red', 'yellow', 'blue' ]              // Must be one of predefined values
 * }
 *
 * function myFunc(opts) {
 *   if (dantil.illFormedOpts(schema, opts)) {
 *     // Prints descriptive, helpful error messages
 *     // Handle ill-formed `opts` how you choose
 *     throw new Error('ill-formed opts')
 *   }
 *
 *   // ...stuff...
 * }
 */
exports.illFormedOpts = function (schema, opts) {
  // Check if missing an opts parameter required by schema
  for (var prop in schema) {
    var val = schema[prop]

    if (!val.optional && !opts.hasOwnProperty(prop)) {
      exports.logErrorAndLine('Missing \'' + prop + '\' property')
      return true
    }
  }

  // Check if passed parameters conform to schema
  for (var prop in opts) {
    // Unrecognized property
    if (!schema.hasOwnProperty(prop)) {
      exports.logErrorAndLine('Unrecognized property:', prop)
      return true
    }

    var optsVal = opts[prop]
    var schemaVal = schema[prop]
    var schemaPropType = schemaVal.type || schemaVal

    // Accidentally passed an `undefined` object; ex: `undefined`, `[]`, `[ 1, undefined ]`
    if (optsVal === undefined || (Array.isArray(optsVal) && (optsVal.length === 0 || optsVal.indexOf(undefined) !== -1))) {
      exports.logErrorAndLine('undefined ' + prop + ':', optsVal)
      return true
    }

    // Schema contains an `Array` of predefined accepted values
    if (Array.isArray(schemaPropType)) {
      // Unrecognized value for parameter with predefined values
      if (schemaPropType.indexOf(optsVal) === -1) {
        exports.logError('Unrecognized value for ' + prop + ':', optsVal)
        exports.log('       Accepted values for ' + prop + ':', schemaPropType)
        exports.log('  ' + exports.getLine())
        return true
      }
    } else {
      // Passed value of incorrect type; ex: `num: String`, `str: Array`
      if (optsVal.constructor !== schemaPropType) {
        exports.logErrorAndLine('\'' + prop + '\' not of type ' + schemaPropType.name + ':', optsVal)
        return true
      }

      // Passed Array contains elements not of `arrayType` (if `arrayType` is defined)
      if (Array.isArray(optsVal) && schemaVal.arrayType && !optsVal.every(function (el) { return el.constructor === schemaVal.arrayType })) {
        exports.logErrorAndLine('\'' + prop + '\' not an array of type ' + schemaVal.arrayType.name + ':', optsVal)
        return true
      }
    }
  }

  // No errors
  return false
}

/**
 * Synchronously writes the output of a function to a file instead of the console. Overwrites the file if it already exists. Restores output to console if an error is thrown.
 *
 * @param {String} path The path where to write output.
 * @param {Function} callback The function producing output.
 * @return {Mixed} The value returned by `callback`, if any.
 * @example
 * // Prints to console
 * console.log('Begin output to file')
 *
 * // Redirects process output from console to file
 * dantil.redirectOutputToFile('~/Desktop/out.txt', function () {
 *   // Writes to '~/Desktop/out.txt'
 *   console.log('Numbers:')
 *   for (var i = 0; i < 100; ++i) {
 *     console.log(i)
 *   }
 * })
 * // Restores output to console and prints: "Output saved to: ~/Desktop/out.txt"
 *
 * // Prints to console (after restoring output)
 * console.log('Output to file complete')
 */
exports.redirectOutputToFile = function (path, callback) {
  // Expand '~' if present
  path = exports.expandHomeDir(path)

  // Create file if does not exist, overwrite existing file if exists, or throw an error if `path` is a directory
  fs.writeFileSync(path)

  // Redirect `process.stdout` to `path`
  var writable = fs.createWriteStream(path)
  var oldWrite = process.stdout.write
  process.stdout.write = function () {
    writable.write.apply(writable, arguments)
  }

  try {
    // Write output to `path`
    var returnVal = callback()

    // Restore `process.stdout`
    process.stdout.write = oldWrite

    exports.log('Output saved to:', fs.realpathSync(path))

    return returnVal
  } catch (e) {
    // Restore `process.stdout`
    process.stdout.write = oldWrite

    throw e
  }
}

/**
 * Writes an object to a JSON file.
 *
 * @param {String} path The path to write file.
 * @param {Object} obj The object to save to file.
 */
exports.writeJSONFile = function (path, obj) {
  // Expand '~' if present
  path = exports.expandHomeDir(path)

  fs.writeFileSync(path, JSON.stringify(obj, function (key, val) {
    // Convert RegExp to strings for `JSON.stringify()`
    return val instanceof RegExp ? val.source : val
  }, '\t'))

  exports.log('File saved:', fs.realpathSync(path))
}

/**
 * Replaces `'~'` in a path (if present and at the path's start) with the home directory path.
 *
 * @param {String} path The file path.
 * @return {String} `path` with `'~'` (if present) replaced with the home directory path.
 * @example
 * dantil.expandHomeDir('~/Desktop') // -> '/Users/Danny/Desktop'
 */
exports.expandHomeDir = function (path) {
  return path.replace(/^~/, process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'])
}

/**
 * Executes the passed function within a `try` block. If an error is thrown, removes parentheses surrounding file paths in its stack trace for the iTerm open-file-path shortcut, and colors the error type name (e.g., `TypeError`) red.
 *
 * @param {Function} callback The function to execute within a `try` block.
 * @param {Boolean} rethrow Specify rethrowing an error (after printing the stack trace) if caught from `callback`.
 * @return {Mixed} The value returned by `callback`, if any.
 * @example
 * // Catches thrown error and prints a formatted stack trace
 * dantil.tryCatchWrapper(function () {
 *   // ...stuff...
 *   throw new Error('test failed')
 * })
 */
exports.tryCatchWrapper = function (callback, rethrow) {
  try {
    return callback()
  } catch (e) {
    // Print leading blank line
    console.log()

    if (e.stack) {
      // Error message without source code (if present)
      var message = e.message.split('\n').pop()

      e.stack.split('\n').forEach(function (stackFrame) {
        if (e.message.indexOf(stackFrame) !== -1) {
          exports.log(stackFrame)
        } else if (stackFrame.indexOf(message) !== -1) {
          // Color error type name red
          exports.log(stackFrame.replace(e.name, colors.red(e.name)))
          message = null
        } else {
          // Remove parentheses surrounding file paths for the iTerm open-file-path shortcut
          exports.log(stackFrame.replace(/[()]/g, ''))
        }
      })
    } else {
      exports.log(e)
    }

    if (rethrow) throw e
  }
}

/**
 * Deletes modules from cache, forcing them to be reloaded at next `require()` call. Without removing a module from cache, subsequent `require()` calls to the same module will not enable changes to its file(s). This is useful for enabling changes on a server without restarting the server.
 *
 * @param {...String} pathN The paths of modules to remove from cache.
 * @example
 * // Load module
 * var myModule = require('./myModule.js')
 *
 * // Remove module from cache
 * dantil.deleteModuleCache('./myModule.js')
 *
 * // Load module again, enabling changes to './myModule.js'
 * myModule = require('./myModule.js')
 */
exports.deleteModuleCache = function () {
  Array.prototype.slice.call(arguments).forEach(function (path) {
    delete require.cache[fs.realpathSync(path)]
  })
}

/**
 * Gets the file path and line number of the first frame in the stack of the parent module from where this function was called. This is useful for logging where an object is instantiated.
 *
 * @param {Boolean} getCallingLine Specify getting the line where `getLine()` is called instead of the line of the parent module.
 * @return {String} The file path and line number of calling line.
 */
exports.getLine = function (getCallingLine) {
  // Get stack without lines for `Error` and this file
  var stack = Error().stack.split('\n').slice(3)
  var callingFileName

  for (var i = 0, stackLength = stack.length; i < stackLength; ++i) {
    var line = stack[i]

    // `line` must contain a file path
    if (!/\//.test(line)) continue

    // Ignore if `getLine()` called from this file
    if (line.indexOf(__filename) !== -1) continue

    // Remove parentheses surrounding file paths in the stack trace for the iTerm open-file-path shortcut
    if (getCallingLine || (callingFileName && line.indexOf(callingFileName) === -1)) {
      return line.replace(/[()]/g, '').slice(line.lastIndexOf(' ') + 1)
    }

    // Name of file from which `getLine()` was called
    callingFileName = line.slice(line.indexOf('/') + 1, line.indexOf(':'))
  }

  // Could not find line in stack for file from which function calling `getLine()` was called
  // exports.logError('Sought-after line not found in stack trace (trace limited to 10 most recent)')
  // exports.logTrace()
}

/**
 * Prints objects in color, recursing 2 times while formatting the object (which is identical to `console.log()`). Prints objects on separate lines if multi-lined when formatted, else concatenates objects and values to print on the same line if shorter than 80 characters when concatenated.
 *
 * @param {...Mixed} [valN] The values to print.
 */
exports.log = function () {
  prettyPrint(arguments, { colors: true })
}

/**
 * Prints objects in color, recursing indefinitely while formatting the object. This is useful for inspecting large, complicated objects. Prints objects on separate lines if multi-lined when formatted, else concatenates objects and values to print on the same line if shorter than 80 characters when concatenated.
 *
 * @param {...Mixed} [valN] The values to print.
 */
exports.dir = function () {
  prettyPrint(arguments, { depth: null, colors: true })

  // Print trailing blank line
  console.log()
}

/**
 * Prints objects according to the formatting options of `opts` (as defined for `util.inspect()`). Prints objects on separate lines if multi-lined when formatted, else concatenates objects and values to print on the same line if shorter than 80 characters when concatenated.
 *
 * @private
 * @param {Object} args The `arguments` object (passed to the callee) with the values to print.
 * @param {Object} opts The options object (as defined for `util.inspect()`).
 */
function prettyPrint(args, opts) {
  var formattedArgs = []

  Array.prototype.slice.call(args).forEach(function (arg, i, args) {
    var prevArg = args[i - 1]

    // Print strings passed as arguments (i.e., not Object properties) without styling
    var formattedArg = typeof arg === 'string' ? arg : util.inspect(arg, opts)

    // Print objects on separate lines if multi-lined when formatted
    if (i === 0 || /,\n/.test(formattedArg)) {
      formattedArgs.push(formattedArg)
    } else {
      var prevFormattedArgIdx = formattedArgs.length - 1
      var prevFormattedArg = formattedArgs[prevFormattedArgIdx]

      // Concatenate other objects and values to print on the same line if shorter than 80 characters when  concatenated
      if (getStylizedStringLength(prevFormattedArg) + getStylizedStringLength(formattedArg) + 1 > 80) {
        formattedArgs.push(formattedArg)
      } else {
        formattedArgs[prevFormattedArgIdx] += ' ' + formattedArg
      }
    }
  })

  formattedArgs.forEach(function (formattedArg) {
    console.log(formattedArg)
  })
}

/**
 * Gets the length of a stylized string when printed without the Unicode characters for color stylization.
 *
 * @private
 * @param {String} string The stylized string.
 * @return {Number} The length of the stylized string when printed.
 */
function getStylizedStringLength(string) {
  return string.replace(/\u001b\[\d\d?m/g, '').length
}

/**
 * Prints like `console.log()` prepended with red-colored "Error: ".
 *
 * @param {...Mixed} valN The values to concatenate and print following "Error: ".
 */
exports.logError = function () {
  printWithColoredLabel('Error', 'red', arguments)
}

/**
 * Prints like `console.log()` prepended with yellow-colored "Warning: ".
 *
 * @param {...Mixed} valN The values to concatenate and print following "Warning: ".
 */
exports.logWarning = function () {
  printWithColoredLabel('Warning', 'yellow', arguments)
}

/**
 * Prints like `console.log()`, but colors first argument and prepends with a label (e.g., "Error: ").
 *
 * @private
 * @param {String} label The label to prepend to `args` (e.g., "Error").
 * @param {String} color The color to stylize `label`.
 * @param {Array} args The values to concatenate and print following `label`.
 */
function printWithColoredLabel(label, color, args) {
  // Temporarily remove ':' to avoid coloring it
  if (label[label.length - 1] === ':') {
    label = label.slice(0, -1)
  }

  // Color `label` and append with `args`
  exports.log.apply(null, [ colors[color](label) + ':' ].concat(Array.prototype.slice.call(args)))
}

/**
 * Prints error message like `dantil.logError()` followed by the file path and line number from which the parent function was called .
 *
 * @param {Boolean} [getCallingLine] Specify getting the line where `getLine()` is called instead of the line of the parent module.
 * @param {...Mixed} [valN] The optional values to print following "Error: ".
 */
exports.logErrorAndLine = function (getCallingLine) {
  var args = Array.prototype.slice.call(arguments, getCallingLine === true ? 1 : 0)
  var stackLine = exports.getLine(getCallingLine === true)

  if (args.length > 0) {
    exports.logError.apply(null, args)
    exports.log('  ' + stackLine)
  } else {
    exports.logError(stackLine)
  }
}

/**
 * Prints the stack trace to the current position. Removes parentheses surrounding file paths for the iTerm open-file-path shortcut.
 *
 * @param {String} [msg] The optional message to print above the stack trace.
 */
exports.logTrace = function (msg) {
  exports.log('Trace' + (msg ? ': ' + msg : ''))

  // Get stack without lines for `Error` and this file
  var stack = Error().stack.split('\n').slice(3).join('\n')

  // Remove parentheses surrounding file paths for the iTerm open-file-path shortcut
  exports.log(stack.replace(/[()]/gm, ''))
}

/**
 * Prints calling file path and line number to mark reaching a section of code, prepended by `msg`.
 *
 * @param {String} [msg] The optional message to prepend line.
 * @example
 * if (rareConditionIsTrue) {
 *   // Prints: "Condition met: /Users/Danny/test.js:9:12"
 *   dantil.assert('Condition met')
 * }
 */
exports.assert = function (msg) {
  exports.log(colors.red(msg || 'Reached') + ':', exports.getLine(true))
}

/**
 * Prints calling file path and line number if `value` is truthy, prepended by `msg`.
 *
 * @param {Boolean} value The value to check if truthy.
 * @param {String} [msg] The optional message to prepend line.
 * @example
 * // If `myNumber > 100` is `true`, prints: "Condition met: /Users/Danny/test.js:9:12"
 * dantil.assertTrue(myNumber > 100, 'Condition met')
 */
exports.assertTrue = function (value, msg) {
  if (value) exports.assert(msg)
}

 /**
  * Key-value map used by `time()`.
  *
  * @private
  * @type Map
  */
var _times = new Map()

/**
 * Starts a high-resolution timer (with precision in microseconds) identified by `label`. Use `dantil.timeEnd(label)` to print the timer's current value.
 *
 * @param {String} label The identifier of the timer.
 * @example
 * // Start timer
 * dantil.time('my test')
 *
 * // ...stuff...
 *
 * // Prints "my test: 13.264ms"
 * dantil.timeEnd('my test')
 *
 * // ...more stuff...
 *
 * // Prints "my test: 31.183ms"
 * dantil.timeEnd('my test')
 */
exports.time = function (label) {
  _times.set(label, process.hrtime())
}

/**
 * Prints the current high-resolution value of a timer initiated with `dantil.time(label)`.
 *
 * @param {String} label The identifier of the timer.
 */
exports.timeEnd = function (label) {
  var time = _times.get(label)

  if (!time) {
    throw new Error('No such label:', label)
  }

  var durationTuple = process.hrtime(time)
  var duration = durationTuple[0] * 1e3 + durationTuple[1] / 1e6
  exports.log(label + ':', duration.toFixed(3) + 'ms')
}

/**
 * Key-value map used by `dantil.count()`.
 *
 * @private
 * @type Map
 */
var _counts = new Map()

/**
 * Counts the number of times a section of code is reached, identified by `label`. Use `dantil.countEnd(label)` to print value. This is useful for profiling complex programs.
 *
 * @param {String} label The id to refer to a section of code.
 * @example
 * for (var i = 0; i < 100; ++i) {
 *   if (i % 2 === 0) dantil.count('even')
 * }
 *
 * // Prints "even: 50"; resets count for 'even' to 0
 * dantil.countEnd('even')
 */
exports.count = function (label) {
  var val = _counts.get(label) || 0
  _counts.set(label, val + 1)
}

/**
 * Prints (and resets the value of) the number of calls of `dantil.count(label)`.
 *
 * @param {String} label The id to refer to calls to `dantil.count()`.
 */
exports.countEnd = function (label) {
  // Print even if no value to acknowledge never being reached
  var count = _counts.get(label) || 0
  exports.log(label + ':', count)

  // Reset count
  _counts.delete(label)
}

/**
 * Prints (and resets) the values of all counters used on `dantil.count()`. Will not print counters that are never reached (and never have their keys initialized).
 * @example
 * for (var i = 0; i < 100; ++i) {
 *   if (i % 2 === 0) dantil.count('even')
 *   if (i % 2 === 1) dantil.count('odd')
 *   if (i > 100) dantil.count('never reached')
 * }
 *
 * // Prints: "even: 50
 * //          odd: 50"
 * // Resets all counts to 0
 * dantil.countEndAll()
 */
exports.countEndAll = function () {
  _counts.forEach(function(count, label) {
    exports.log(label + ':', count)
  })

  // Reset all counts
  _counts.clear()
}

/**
 * Performs a shallow comparison between two arrays to determine if they are equivalent.
 *
 * @param {Array} a The array to compare.
 * @param {Array} b The other array to compare.
 * @return {Boolean} `true` if the arrays are equivalent, else `false`.
 * @example
 * dantil.arraysEqual([], []) // -> true
 *
 * dantil.arraysEqual([1, 2, 3, 'danny'], [1, 2, 3, 'danny']) // -> true
 *
 * dantil.arraysEqual([ false, true ], [ true ]) // -> false
 *
 * // A shallow comparison will not compare object properties
 * var objA = { prop: 'val' }
 * var objB = { prop: 'val' }
 * dantil.arraysEqual([ 1, 2, objA ], [ 1, 2, objB ]) // -> false
 *
 * // Rather, objects are only equal if they are the same instance
 * dantil.arraysEqual([ objA, objB ], [ objA, objB ]) // -> true
 */
exports.arraysEqual = function (a, b) {
  // Identical arrays (or, both undefined)
  if (a === b) return true

  // One of two is undefined
  if (!a || !b) return false

  var aLength = a.length

  // Different lengths
  if (aLength !== b.length) return false

  for (var i = 0; i < aLength; ++i) {
    if (a[i] !== b[i]) return false
  }

  return true
}

/**
 * Removes extraneous digits from numbers resulting from operations limited by JavaScript's floating point number precision, such as `0.1 * 0.2` (which does not equal `0.02`). This limitation results from being unable to map `0.1` to a finite binary floating point number.
 *
 * @param {Number} number The number to trim.
 * @return {Number} The number trimmed.
 * @example
 * var number = 0.1 * 0.2 // -> 0.020000000000000004
 * number = dantil.cleanFloat(number) // -> 0.02
 */
exports.cleanNumber = function (number) {
  // JavaScript's floating point number precision 13 digits after the decimal point
  return Number(number.toFixed(13))
}

/**
 * Converts a dash-separated string to camelCase.
 *
 * @param {String} dashedString The dash-separated string to convert.
 * @return {String} The input string in camelCase.
 * @example
 * dantil.camelCase('my-long-variable-name') // -> 'myLongVariableName'
 */
exports.dashedToCamelCase = function (dashedString) {
  return dashedString.replace(/-(\w)/g, function (match, group1) {
    return group1.toUpperCase()
  })
}