(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],2:[function(require,module,exports){
function createSpanElement(value, clasz) {
    return createElement(value, 'span', clasz);
}

function createElement(value, tag, classes) {
    let element = document.createElement(tag);
    if (classes) {
        classes.split(' ').forEach(clasz => {
            element.classList.add(clasz);    
        });
    }
    element.innerHTML = value;
    return element;
}

function createElementWithChildren(tag, ...children) {
    let element = document.createElement(tag);
    element.replaceChildren(...children);
    return element;
}

module.exports = { createSpanElement, createElement, createElementWithChildren}
},{}],3:[function(require,module,exports){
'use strict';

const log = require('loglevel');

const { EVENT_M32_TEXT_RECEIVED } = require('./m32-communication-service');

class KochMorseTutor {
    constructor(m32CommunicationService, inputHandler) {
        this.morsePlayer = new jscw();
        this.inputHandler = inputHandler;
        this.currentLesson = 0;
        this.lessonCharacters = 'KMRSUAPTLOWI.NJEF0Y,VG5/Q9ZH38B?427C1D6X';
        this.speed = 15; // Default speed
        this.groupSize = 5; // Default group size
        this.displayElement = document.getElementById('kochDisplay');
        this.currentCharElement = document.getElementById('currentChar');
        this.groupResultElement = document.getElementById('kochResult');
        this.speedControlElement = document.getElementById('kochSpeedControl');
        this.speedDisplayElement = document.getElementById('kochSpeedDisplay');
        this.displayOptionElement = document.getElementById('kochDisplayOption');
        this.inputElement = document.getElementById('kochInput');

        this.m32CommunicationService = m32CommunicationService;

        // Flexible pause settings
        this.standardPause = 1; // Standard pause between characters at high speeds (in seconds)
        this.maxPause = 5; // Maximum pause at low speeds (in seconds)
        this.transitionSpeed = 18; // WPM at which we reach standard pause

        // Farnsworth timing
        this.useFarnsworth = false;
        this.farnsworthSpeed = 18; // Character speed for Farnsworth timing
        this.farnsworthToggleElement = document.getElementById('farnsworthToggle');
        this.farnsworthSpeedElement = document.getElementById('farnsworthSpeed');
        this.farnsworthSpeedDisplayElement = document.getElementById('farnsworthSpeedDisplay');

        this.initializeUI();
        this.setMorseSpeed(this.speed);

        this.activeMode = false;
    }

            

    initializeUI() {
        if (this.speedControlElement) {
            this.speedControlElement.addEventListener('input', (event) => {
                this.setMorseSpeed(parseInt(event.target.value));
                this.speedDisplayElement.innerText = this.speedControlElement.value;
            });
        }

        if (this.farnsworthToggleElement) {
            this.farnsworthToggleElement.addEventListener('change', (event) => {
                this.setFarnsworth(event.target.checked);
            });
        }

        if (this.farnsworthSpeedElement) {
            this.farnsworthSpeedElement.addEventListener('input', (event) => {
                this.setFarnsworthSpeed(parseInt(event.target.value));
            });
        }
    }

    // sets speed of morse
    setMorseSpeed(speed) {
        this.speed = speed;
        this.dit = 1200 / speed;
        this.dah = this.dit * 3;
        this.pauseBetweenLetters = this.dit * 3;
        this.pauseBetweenWords = this.dit * 7;
        console.log(`Speed set to ${speed} WPM`);
    }

    startLesson() {
        console.log('Starting Koch Method lesson');
        this.displayElement.style.display = 'block';
        //this.morsePlayer.init();
        this.playNextGroup();
        this.inputElement.focus();
    }

    async playNextGroup() {
        let group = '';
        for (let i = 0; i < this.groupSize; i++) {
            group += this.lessonCharacters[Math.floor(Math.random() * (this.currentLesson + 1))];
        }

        let noKM = /[A-J]|[L]|[N-Z]/;
        let noKMResult;

        console.log(this.displayOptionElement.checked);
        
        if(this.displayOptionElement.checked)
        {
            console.log("Hi!")
            noKMResult = group.match(noKM);
            this.currentCharElement.textContent = noKMResult;
        }
        //this.currentCharElement.textContent = group;
        await this.morsePlayer.play(group);
        
        const userInput = await this.getInput();
        console.log("Is this working?" + " "  + userInput);
        this.checkInput(group, userInput);
        //debugger
    }

    textReceived(value) {
        if (this.activeMode) {
            this.inputElement.value += value;
        }
    }

    getInput()
    {
        return new Promise((resolve) => {
            const keyInputs = [];
            this.inputElement.addEventListener('keydown', (event) => {
                //debugger
                const keyInput = event.key;
                //let numInput = 0;
                if(keyInput != 'Backspace' && keyInput != ' ' && keyInput != 'F1' && keyInput != 'F11')
                {
                    keyInputs.push(keyInput);
                }
                else
                {
                    event.preventDefault()
                    return false;
                }
                let result = keyInputs.join("");
                if(this.inputElement.value)
                {
                    this.inputElement.value = "";
                }
                if(result.length == 5)
                {
                    resolve(result);
                }
                

                //const keyInput = event.key;
                console.log(keyInput + ' was pressed!');
                //resolve(console.log(keyInput + ' was pressed!'));
                //resolve(keyInputs[numInput]);
            })
            //console.log(keyInputs);
            this.inputElement.addEventListener('keyup', (e) => {
                e = this.inputElement.setSelectionRange(0,0);
            })

            this.m32CommunicationService.addEventListener(EVENT_M32_TEXT_RECEIVED, this.textReceived.bind(this));
        })
    }

    checkInput(expected, actual) {
        //debugger
        let result = '';
        console.log(expected.length);
        for (let i = 0; i < expected.length; i++) {
            if (i < actual.length) {
                if (expected[i].toLowerCase() === actual[i].toLowerCase()) {
                    result += `<span class="correct">${expected[i]}</span>`;
                } else {
                    result += `<span class="wrong">${expected[i]}</span>`;
                }
            } else {
                result += `<span class="missing">${expected[i]}</span>`;
            }
        }
        this.groupResultElement.innerHTML = result;

        if (expected.toLowerCase() === actual.toLowerCase()) {
            console.log('Correct!');
            //if (Math.random() < 0.2) { // 20% chance to advance to next lesson
                this.currentLesson = Math.min(this.currentLesson + 1, this.lessonCharacters.length - 1);
            //}
        } else {
            console.log('Incorrect. Try again.');
        }
        
        setTimeout(() => this.playNextGroup(), 3000); // Wait 3 seconds before next group
    }

    setSpeed(speed) {
        //debugger
        this.speed = speed;
        const pause = this.calculatePause(speed);
        if (this.useFarnsworth) {
            this.morsePlayer.setWpm(this.farnsworthSpeed);
            this.morsePlayer.setEffectiveWpm(speed);
        } else {
            this.morsePlayer.setWpm(speed);
        }
        //this.morsePlayer.setCharacterPause(pause);
        if (this.speedDisplayElement) {
            this.speedDisplayElement.textContent = speed;
        }
        console.log(`Speed set to ${speed} WPM, character pause: ${pause.toFixed(2)} seconds, Farnsworth: ${this.useFarnsworth}`);
    }

    calculatePause(speed) {
        if (this.useFarnsworth) {
            // Use a fixed pause for Farnsworth timing
            return this.standardPause;
        } else if (speed >= this.transitionSpeed) {
            return this.standardPause;
        } else {
            // Linear interpolation between maxPause and standardPause
            const factor = (this.transitionSpeed - speed) / this.transitionSpeed;
            return this.standardPause + (this.maxPause - this.standardPause) * factor;
        }
    }

    setFarnsworth(useFarnsworth) {
        this.useFarnsworth = useFarnsworth;
        this.setSpeed(this.speed); // Recalculate timing
        log.info(`Farnsworth timing ${useFarnsworth ? 'enabled' : 'disabled'}`);
    }

    setFarnsworthSpeed(speed) {
        this.farnsworthSpeed = speed;
        if (this.useFarnsworth) {
            this.setSpeed(this.speed); // Recalculate timing
        }
        if (this.farnsworthSpeedDisplayElement) {
            this.farnsworthSpeedDisplayElement.textContent = speed;
        }
        log.info(`Farnsworth character speed set to ${speed} WPM`);
    }

    setGroupSize(size) {
        this.groupSize = size;
        log.info(`Group size set to ${size}`);
    }
}

module.exports = KochMorseTutor;

},{"./m32-communication-service":4,"loglevel":19}],4:[function(require,module,exports){
'use strict';

let log = require("loglevel");

const events = require('events');

const { M32CommandSpeechHandler } = require('./m32protocol-speech-handler');
const { M32State, M32CommandStateHandler } = require('./m32protocol-state-handler')
const { M32CommandUIHandler} = require('./m32protocol-ui-handler');
const { M32Translations } = require('./m32protocol-i18n');

const MORSERINO_START = 'vvv<ka> ';
const MORSERINO_END = ' +';
const STATUS_JSON = 'status-m32-json-received';
const STATUS_TEXT = 'status-m32-text-received';


const EVENT_M32_CONNECTED = "event-m32-connected";
const EVENT_M32_DISCONNECTED = "event-m32-disconnected";
const EVENT_M32_CONNECTION_ERROR = "event-m32-connection-error";
const EVENT_M32_TEXT_RECEIVED = "event-m32-text-received";
const EVENT_M32_JSON_ERROR_RECEIVED = "event-m32-json-error-received";

const M32_MENU_CW_GENERATOR_FILE_PLAYER_ID = 8;

class M32CommunicationService {

    constructor(autoInitM32Protocol = true) {
        //Define outputstream, inputstream and port so they can be used throughout the sketch
        this.outputStream;
        this.inputStream;
        this.port = null;
        this.inputDone;
        this.outputDone;

        this.autoInitM32Protocol = autoInitM32Protocol;

        this.timer = ms => new Promise(res => setTimeout(res, ms))

        this.eventEmitter = new events.EventEmitter();

        // speech & m3 protocol handler
        this.m32Language = 'en';
        this.m32State = new M32State();
        this.m32translations = new M32Translations(this.m32Language);
        this.speechSynthesisHandler = new M32CommandSpeechHandler(this.m32Language);
        this.commandUIHandler = new M32CommandUIHandler(this.m32Language, this.m32translations);
        this.protocolHandlers = [
            new M32CommandStateHandler(this.m32State), 
            this.commandUIHandler, 
            this.speechSynthesisHandler];

            this.waitForReponseLock = new Lock();


        this.m32StreamParser = new M32StreamParser(this.m32Received.bind(this));

        //M32StreamParser.test();
    }

    addProtocolHandler(protcolHandler) {
        this.protocolHandlers.push(protcolHandler);
    }

    addEventListener(eventType, callback) {
        this.eventEmitter.addListener(eventType, callback);
        //log.debug("number of event listeners",eventType, this.eventEmitter.listenerCount(eventType));
    }

    isConnected() {
        return this.port !== null;
    }

    enableVoiceOutput(enabled) {
        log.debug("speech synthesis, enable voice output", enabled);
        this.speechSynthesisHandler.enabled = enabled;
    }

    disableVoiceOuputTemporarily(type) {
        this.speechSynthesisHandler.disableVoiceOuputTemporarily(type);
    }

    setLanguage(language) {
        this.m32Language = language;
        this.speechSynthesisHandler.language = language;
        this.commandUIHandler.language = language;
    }

// navigator.serial.addEventListener('connect', e => {
//     console.log('connect event triggered')
//     statusBar.innerText = `Connected to ${e.port}`;
//     statusBar.className = 'badge bg-success';
//     connectButton.innerText = 'Disconnect';
// });

// navigator.serial.addEventListener('disconnect', e => {
//     console.log('disconnect event triggered')
//     statusBar.innerText = `Disconnected`;
//     statusBar.className = 'badge bg-danger';
//     connectButton.innerText = 'Connect';
// });

//Connect to Morserino
    async connect() {
        log.debug("connecting to morserino");

        const baudRate = 115200;

        //Optional filter to only see relevant boards
        const filter = {
            // morserino32
            // Product ID: 0xea60
            // Vendor ID: 0x10c4  (Silicon Laboratories, Inc.)
            usbVendorId: 0x10c4
        };

        //Try to connect to the Serial port
        try {
            this.port = await navigator.serial.requestPort({ filters: [filter] });
            // Continue connecting to |port|.

            // - Wait for the port to open.
            log.debug("connecting to port ", this.port);
            await this.port.open({ baudRate: baudRate });

            this.eventEmitter.emit(EVENT_M32_CONNECTED);

            // eslint-disable-next-line no-undef
            let decoder = new TextDecoderStream();
            this.inputDone = this.port.readable.pipeTo(decoder.writable);
            this.inputStream = decoder.readable;

            // eslint-disable-next-line no-undef
            const encoder = new TextEncoderStream();
            this.outputDone = encoder.readable.pipeTo(this.port.writable);
            this.outputStream = encoder.writable;

            this.reader = this.inputStream.getReader();

            this.readLoop();

            if (this.autoInitM32Protocol) {
                this.initM32Protocol();
            }

        } catch (e) {
            let msg = e;

            //If the pipeTo error appears; clarify the problem by giving suggestions.
            if (e == 'TypeError: Cannot read property "pipeTo" of undefined') {
                msg += '\n Use Google Chrome and enable-experimental-web-platform-features'
            }
            this.eventEmitter.emit("m32-connected", msg);

        }
    }

    //Write to the Serial port
    async writeToStream(line) {
        log.debug('send command', line);
        const writer = this.outputStream.getWriter();
        writer.write(line);
        writer.write('\n');
        writer.releaseLock();
    }

    //Disconnect from the Serial port
    async disconnect() {

        if (this.reader) {
            await this.reader.cancel();
            await this.inputDone.catch(() => { });
            this.reader = null;
            this.inputDone = null;
        }
        if (this.outputStream) {
            await this.outputStream.getWriter().close();
            await this.outputDone;
            this.outputStream = null;
            this.outputDone = null;
        }
        //Close the port.
        if (this.port) {
            await this.port.close();
        }
        this.port = null;
        this.eventEmitter.emit(EVENT_M32_DISCONNECTED);
    }

    //Read the incoming data
    async readLoop() {

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { value, done } = await this.reader.read();
            if (done === true) {
                break;
            }

            this.m32StreamParser.append(value);
            this.m32StreamParser.process(); // calls m32Received as callback
        }
    }

    // is called from M32StreamParser
    m32Received(result) {
        log.debug('m32protocol received:', result);
        if (result.status === STATUS_JSON) {
            this.waitForReponseLock.locked = false;
            try {
                // fix wrong encoding of new lines in json from morserino:
                result.content = result.content.replaceAll(/\n/g,"\\n").replaceAll(/\r/g, "").replaceAll("\\c","\\\\c");
                let jsonObject = JSON.parse(result.content);
                this.protocolHandlers.forEach(handler => {
                    handler.handleM32Object(jsonObject);
                }); 
            } catch(e) {
                log.error('json parse failed: ', e);
                this.eventEmitter.emit(EVENT_M32_JSON_ERROR_RECEIVED, result.error + ' when parsing "' + result.content + '"');
                this.eventEmitter.emit(EVENT_M32_TEXT_RECEIVED, result.content);
            }
        } else if (result.status === STATUS_TEXT) {
            log.debug("text values received", result.content);
            this.eventEmitter.emit(EVENT_M32_TEXT_RECEIVED, result.content);
        }
    }

    async sendM32Command(command, waitForResponse = true) {
        if (command && command.trim()) {
            console.log('sending command', command, 'wait', waitForResponse);
            if(waitForResponse) {
                while(this.waitForReponseLock.locked) {
                    log.debug('Waiting for response');
                    await this.timer(50);
                }
            }
            this.writeToStream(command.trim());
            if (waitForResponse) {
                this.waitForReponseLock.locked = true;
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    initM32Protocol() {
        //sendM32Command('PUT device/protocol/off', false); // force device info on next PUT
        this.sendM32Command('PUT device/protocol/on');
        // enable serial output ALL as default
        this.sendM32Command('PUT config/Serial Output/5', false);
        //sendM32Command('GET device');
        this.sendM32Command('GET control/speed');
        this.sendM32Command('GET kochlesson');
        //sendM32Command('GET control/volume');
        this.sendM32Command('GET menu');
    }



    connected() {
        log.debug("Connected Test");
    }
}

class M32StreamParser {
    constructor(callback = this.callback.bind(this)) {
        this.callback = callback;
        this.toProcess = '';
    }

    static test() {
        let testM32Parser = new M32StreamParser();
        log.debug("test text");
        testM32Parser.set('foobar');
        testM32Parser.process();

        log.debug("test text json");
        testM32Parser.set('foobar{ "foo": 2}');
        testM32Parser.process();

        log.debug("test text json text");
        testM32Parser.set('foobar{ "foo": 2}baz');
        testM32Parser.process();

        log.debug("test multiple json");
        testM32Parser.set('foobar{ "foo": 2}{"foo": 3}baz');
        testM32Parser.process();

        log.debug("test split json");
        testM32Parser.set('bar{ "foo":');
        testM32Parser.process();
        testM32Parser.append('1}baz');
        testM32Parser.process();

        log.debug("test quoted simple");
        testM32Parser.set('bar{ "foo":"}1"}baz');
        testM32Parser.process();

        log.debug("test quoted split");
        testM32Parser.set('bar{ "foo":"');
        testM32Parser.process();
        testM32Parser.append('}1{"}baz');
        testM32Parser.process();
    }

    set(text) {
        this.toProcess = text;
    }

    append(text) {
        this.toProcess = this.toProcess + text;
    }

    process() {
       while(this.doProcess());
    }

    doProcess() {
        // handle strings like: foobar{"bar":1}{"foo":2}{"foo":"}2{"}baz
        let inQuote = false;
        let prefixLength = this.toProcess.indexOf('{');
        if (prefixLength == 0) {
            // JSON follows
            let braceCount = 0;
            for (var index = 0; index < this.toProcess.length; index++) {
                const char = this.toProcess[index];
                if (char == '"') {
                    inQuote = !inQuote;
                }
                if (!inQuote) {
                    if (char == '{') {
                        braceCount += 1;
                    } else if (char == '}') {
                        braceCount -= 1;
                    }
                }
                if (braceCount == 0) {
                    let jsonString = this.toProcess.substring(0, index + 1);
                    this.callback({status: STATUS_JSON,  content: jsonString});

                    this.toProcess = this.toProcess.substring(index + 1);
                    if (this.toProcess.length > 0) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
            return false;
        } else if (prefixLength > 0) {
            // TEXT  + JSON follows
            let prefix = this.toProcess.substring(0, prefixLength);
            this.callback({status: STATUS_TEXT,  content: prefix});
            this.toProcess = this.toProcess.substring(prefixLength);
            if (this.toProcess.length > 0) {
                return true;
            } else {
                return false;
            }
        } else {
            // text only
            this.callback({status: STATUS_TEXT,  content: this.toProcess});
            this.toProcess = '';
            return false;
        }
    }

    callback(result) {
        if (result.status == STATUS_JSON) {
            try {
                let jsonObject = JSON.parse(result.content);
                log.debug(result, jsonObject);
            } catch(e) {
                log.debug(result, 'JSON parse error', e);
            }
        } else {
            log.debug(result);
        }
    }

}

class Lock {
    constructor() {
        this.locked = false;
    }
}

module.exports = { M32CommunicationService, EVENT_M32_CONNECTED, EVENT_M32_DISCONNECTED, 
    EVENT_M32_CONNECTION_ERROR, EVENT_M32_TEXT_RECEIVED, EVENT_M32_JSON_ERROR_RECEIVED, MORSERINO_START, MORSERINO_END,
    M32_MENU_CW_GENERATOR_FILE_PLAYER_ID }

},{"./m32protocol-i18n":14,"./m32protocol-speech-handler":15,"./m32protocol-state-handler":16,"./m32protocol-ui-handler":17,"events":1,"loglevel":19}],5:[function(require,module,exports){
'use strict';

const log  = require ('loglevel');
const { createElement } = require('./dom-utils');

class M32Config {
    constructor(value) {
        this.name = value['name'];
        this.value = value['value'];
        this.description = value['description'];
        this.minimum = value['minimum'];
        this.maximum = value['maximum'];
        this.step = value['step'];
        this.isMapped = value['isMapped'];
        this.mappedValues = value['mapped values'];
        this.displayed = value['displayed'];
    }

    merge(value) {
        this.value = value['value'];
        this.displayed = value['displayed'];
    }
}

class ConfigurationUI {
    constructor(m32CommunicationService, configRootElement) {
        this.m32CommunicationService = m32CommunicationService;
        this.m32CommunicationService.addProtocolHandler(this);
        this.configNames = [];
        this.configMap = {};
        this.configRootElement = configRootElement;
        this.m32translations = m32CommunicationService.m32translations;

        document.getElementById('m32-config-reload-button').addEventListener('click', this.readConfigs.bind(this));

        document.getElementById('m32-config-wifi1-button').addEventListener('click', this.saveWifi.bind(this));
        document.getElementById('m32-config-wifi2-button').addEventListener('click', this.saveWifi.bind(this));
        document.getElementById('m32-config-wifi3-button').addEventListener('click', this.saveWifi.bind(this));

        document.getElementById('m32-select-wifi1-button').addEventListener('click', this.selectWifi.bind(this));
        document.getElementById('m32-select-wifi2-button').addEventListener('click', this.selectWifi.bind(this));
        document.getElementById('m32-select-wifi3-button').addEventListener('click', this.selectWifi.bind(this));

        document.getElementById('m32-config-snapshots-select').addEventListener('change', this.changedSnapshot.bind(this));

        document.getElementById('m32-config-snapshot-button-store').addEventListener('click', this.storeSnapshot.bind(this));
        
        document.getElementById('m32-config-cw-school-setup-snaphot1-button').addEventListener('click', this.setupCwSchoolSnapshot1.bind(this));
        document.getElementById('m32-config-cw-school-setup-snaphot2-button').addEventListener('click', this.setupCwSchoolSnapshot2.bind(this));
        document.getElementById('m32-config-cw-school-setup-snaphot3-button').addEventListener('click', this.setupCwSchoolSnapshot3.bind(this));
        document.getElementById('m32-config-cw-school-setup-snaphot4-button').addEventListener('click', this.setupCwSchoolSnapshot4.bind(this));
        document.getElementById('m32-config-cw-school-setup-snaphot5-button').addEventListener('click', this.setupCwSchoolSnapshot5.bind(this));
        document.getElementById('m32-config-cw-school-setup-snaphot6-button').addEventListener('click', this.setupCwSchoolSnapshot6.bind(this));
        document.getElementById('m32-config-cw-school-setup-snaphot7-button').addEventListener('click', this.setupCwSchoolSnapshot7.bind(this));
        document.getElementById('m32-config-cw-school-setup-snaphot8-button').addEventListener('click', this.setupCwSchoolSnapshot8.bind(this));
        
        document.getElementById('m32-device-info-button').addEventListener('click', this.requestDeviceInfo.bind(this));

        this.snapshotRecallButton = document.getElementById('m32-config-snapshot-button-recall');
        this.snapshotRecallButton.addEventListener('click', this.recallSnapshotClicked.bind(this));
        this.snapshotClearButton = document.getElementById('m32-config-snapshot-button-clear');
        this.snapshotClearButton.addEventListener('click', this.clearSnapshotClicked.bind(this));
    }

    readConfigs() {
        this.m32CommunicationService.sendM32Command('GET wifi');
        this.m32CommunicationService.sendM32Command('GET snapshots');
        this.m32CommunicationService.sendM32Command('GET configs'); // triggers a handleM32Object callback
    }

    // callback method for a full json object received
    handleM32Object(jsonObject) {
        console.log('configHandler.handleM32Object', jsonObject);
        const keys = Object.keys(jsonObject);
        if (keys && keys.length > 0) {
            const key = keys[0];
            const value = jsonObject[key];
            switch(key) {
                case 'configs':
                    if (this.configRootElement) {                            
                        console.log(value);
                        console.log(value.length);
                        this.configNames = [];
                        this.configMap = {};
                        for (let index = 0; index < value.length; index++) {
                            let name = value[index]['name'];
                            this.configNames.push(name);
                        }
                        this.fetchFullConfiguration();
                    }
                    break;
                case 'config':
                    if (this.configRootElement) {                            
                        console.log(value);
                        let name = value['name'];
                        let m32Config = this.configMap[name];
                        if (m32Config) {
                            m32Config.merge(value);
                        } else {
                            this.configMap[name] = new M32Config(value);
                        }
                        this.addConfigurationElements(this.configMap[name]);
                    }
                    break;
                case 'wifi':
                    if (this.configRootElement) {                            
                        console.log(value);
                        this.receivedWifis(value);
                    }
                    break;
                case 'snapshots':
                    if (this.configRootElement) {                            
                        console.log(value);
                        this.receivedSnapshots(value);
                    }
                    break;
                case 'device':
                    if (this.configRootElement) {                            
                        console.log(value);
                        this.receivedDevice(value);
                    }
                    break;
        
                }
        } else {
            console.log('cannot handle json', jsonObject);
        }
    }

    fetchFullConfiguration() {
        // FIXME: order is sometimes mixed up!
        log.debug('fetching configuration settings for', this.configNames);
        this.m32CommunicationService.disableVoiceOuputTemporarily('config');
        for (let index = 0; index < this.configNames.length; index++) {
            let configName = this.configNames[index];
            this.m32CommunicationService.sendM32Command('GET config/' + configName);
        }
    }
    
    addConfigurationElements(config) {
        log.debug('add/replace dom element for config', config)

        let i18nName = this.m32translations.translateConfig(config.name, this.m32CommunicationService.m32Language);
        let elementId = this.getIdFromName(config.name);
        let configElement = document.getElementById(elementId);
        if (!configElement) {
            configElement = createElement(null, 'div', 'row');
            configElement.id = elementId;
            this.configRootElement.appendChild(configElement);

            let elements = [];
            let titleColumn = createElement(null, 'div', 'col-md-6');
            titleColumn.replaceChildren(...[createElement(i18nName, 'h4', null), createElement(config.description, 'p', null)]);
            elements.push(titleColumn);
            let selectDivElement = createElement(null, 'div', 'col-md-4');
            let selectElement = createElement(null, 'select', 'form-select');
            //selectElement.disabled = true; // FIXME: remove for edit!
            selectElement.setAttribute('data-m32-config-name', config.name);
            selectElement.addEventListener('change', this.onChangeConfig.bind(this));
            
            let optionElements = [];
            for (let index = config.minimum; index <= config.maximum; index += config.step) {
                let displayValue = config.isMapped ? config.mappedValues[index] : index.toString();
                let optionElement = createElement(displayValue, 'option', null);
                optionElement.value = index;
                if (config.value == index) {
                    optionElement.selected = true;
                }
                optionElements.push(optionElement);
            }
            selectElement.replaceChildren(...optionElements);
            selectDivElement.replaceChildren(...[selectElement]);
            elements.push(selectDivElement);
            configElement.replaceChildren(...elements);
        }
        // if a config element is received on manual user interaction on morserino, a different config
        // element is sent: no mapping, only 'displayed' and 'value' 
        // update the selection
        //if (config.displayed) {
            // not a full config json was received, but only a value and displayed
            let selectorElement = document.querySelector('[data-m32-config-name="' + config.name + '"]');
            let configValue = config.value.toString();
            for (let index = 0; index < selectorElement.length; index += 1) {
                let optionElement = selectorElement[index];
                if (optionElement.value === configValue) {
                    optionElement.selected = true;
                } else {
                    optionElement.selected = false;
                }
            }
        //}
    }

    getIdFromName(configName) {
        return configName.replace(/[ #,/]/g, '_');
    }

    onChangeConfig(event) {
        let configName = event.target.getAttribute('data-m32-config-name');
        let value = event.target.value;
        let command = "PUT config/" + configName + "/" + value;
        log.debug('changed:', configName, value);
        this.m32CommunicationService.sendM32Command(command, false);
    }

    receivedWifis(wifiConfig) {
        let baseId = 'm32-config-wifi';
        for (let index = 1; index < 4; index++) {
            let ssidId = baseId + index + '-ssid';
            let trxPeerId = baseId + index + '-trxpeer';
            document.getElementById(ssidId).value = wifiConfig[index-1]['ssid'];
            document.getElementById(trxPeerId).value = wifiConfig[index-1]['trxpeer'];
        }
    }

    saveWifi(event) {
        let baseId = event.target.id.substring(0, event.target.id.length - '-button'.length);
        let ssidId = baseId + '-ssid';
        let passwordId = baseId + '-password';
        let trxPeerId = baseId + '-trxpeer';
        let wifiNumber = baseId.substring(baseId.length - 1);
        let ssid = document.getElementById(ssidId).value;
        let password = document.getElementById(passwordId).value;
        let trxPeer = document.getElementById(trxPeerId).value;
        this.m32CommunicationService.sendM32Command(`PUT wifi/ssid/${wifiNumber}/${ssid}`, false);
        this.m32CommunicationService.sendM32Command(`PUT wifi/password/${wifiNumber}/${password}`, false);
        this.m32CommunicationService.sendM32Command(`PUT wifi/trxpeer/${wifiNumber}/${trxPeer}`, false);
    }

    selectWifi(event) {
        let baseId = event.target.id.substring(0, event.target.id.length - '-button'.length);
        let wifiNumber = baseId.substring(baseId.length - 1);
        this.m32CommunicationService.sendM32Command(`PUT wifi/select/${wifiNumber}`, false);
    }

    receivedSnapshots(snapshots) {
        let selectElement = document.getElementById('m32-config-snapshots-select');
        let existingSnapshots = snapshots['existing snapshots']
        let optionElements = [];

        for (let index = 0; index < existingSnapshots.length; index++) {
            let snapshotId = existingSnapshots[index];
            let optionElement = createElement(snapshotId.toString(), 'option', null);
            optionElement.value = snapshotId;
            optionElements.push(optionElement);
        }
        selectElement.replaceChildren(...optionElements);
        selectElement.selectedIndex = -1; // no element selected by default
    }

    changedSnapshot(event) {
        //let selectElement = event.target;
        //let newSnapshotId = selectElement.options[selectElement.selectedIndex].value;
        this.snapshotRecallButton.disabled = false;
        this.snapshotClearButton.disabled = false;
    }

    recallSnapshotClicked() {
        let selectedOption = document.getElementById('m32-config-snapshots-select');
        let snapshotId = selectedOption.value;
        if (snapshotId) {
            log.debug("recall snapshot", snapshotId);
            this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
            this.m32CommunicationService.sendM32Command("PUT snapshot/recall/" + snapshotId, false);
            // read new configuration:
            this.m32CommunicationService.sendM32Command("GET configs");
        }
    }

    clearSnapshotClicked() {
        let selectedOption = document.getElementById('m32-config-snapshots-select');
        let snapshotId = selectedOption.value;
        if (snapshotId) {
            log.debug("clear snapshot", snapshotId);
            this.m32CommunicationService.sendM32Command("PUT snapshot/clear/" + snapshotId, false);
            // read new configuration:
            this.m32CommunicationService.sendM32Command("GET snapshots");
        }
    }

    storeSnapshot() {
        let selectedOption = document.getElementById('m32-config-snapshots-store-select');
        let snapshotId = selectedOption.value;
        if (snapshotId) {
            log.debug("store snapshot", snapshotId);
            this.m32CommunicationService.sendM32Command("PUT snapshot/store/" + snapshotId, false);
            // read new configuration:
            this.m32CommunicationService.sendM32Command("GET snapshots");
        }
    }


    setupCwSchoolSnapshot1() {
        // snapshot 1
        log.debug('configure snapshots 1');
        this.m32CommunicationService.sendM32Command("PUT menu/set/20"); // Koch Trainer / CW Generator/Random
        this.m32CommunicationService.sendM32Command("PUT config/InterWord Spc/30", false);
        this.m32CommunicationService.sendM32Command("PUT config/Interchar Spc/3", false);
        this.m32CommunicationService.sendM32Command("PUT config/Random Groups/0", false); // All Chars
        this.m32CommunicationService.sendM32Command("PUT config/Length Rnd Gr/1", false);
        this.m32CommunicationService.sendM32Command("PUT Each Word 2x/0", false);
        this.m32CommunicationService.sendM32Command("PUT config/Max # of Words/20", false);
        this.m32CommunicationService.sleep(1000);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/1", false);

        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }

    setupCwSchoolSnapshot2() {
        log.debug('configure snapshots for CW Schule Graz');
        // snapshot 2
        log.debug('configure snapshots 2');
        this.m32CommunicationService.sendM32Command("PUT menu/set/17"); // Koch Trainer/Select Lesson
        this.m32CommunicationService.sendM32Command("PUT config/InterWord Spc/7", false);
        this.m32CommunicationService.sendM32Command("PUT config/Interchar Spc/3", false);
        this.m32CommunicationService.sendM32Command("PUT config/Random Groups/0", false); // All Chars
        this.m32CommunicationService.sendM32Command("PUT config/Time-out/0", false);
        this.m32CommunicationService.sendM32Command("PUT Each Word 2x/0", false);
        this.m32CommunicationService.sleep(1000);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/2", false);

        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }

    setupCwSchoolSnapshot3() {
        // snapshot 3
        log.debug('configure snapshots 3');
        //this.m32CommunicationService.sendM32Command("PUT menu/set/25"); // Koch Trainer/Echo Trainer/Random
        this.m32CommunicationService.sendM32Command("PUT menu/set/29"); // Koch Trainer/Echo Trainer/Adapt. Rand.
        this.m32CommunicationService.sendM32Command("PUT config/InterWord Spc/7", false);
        this.m32CommunicationService.sendM32Command("PUT config/Interchar Spc/3", false);
        this.m32CommunicationService.sendM32Command("PUT config/Random Groups/0", false); // All Chars
        this.m32CommunicationService.sendM32Command("PUT config/Length Rnd Gr/1", false); // 2-5
        this.m32CommunicationService.sendM32Command("PUT Each Word 2x/0", false);
        this.m32CommunicationService.sendM32Command("PUT config/Max # of Words/20", false);
        this.m32CommunicationService.sleep(1000);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/3", false);

        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }

    setupCwSchoolSnapshot4() {
        // snapshot 4
        log.debug('configure snapshots 4');
        this.m32CommunicationService.sendM32Command("PUT menu/set/20"); // Koch Trainer/CW Generator/Random
        this.m32CommunicationService.sendM32Command("PUT config/InterWord Spc/45", false);
        this.m32CommunicationService.sendM32Command("PUT config/Interchar Spc/15", false);
        this.m32CommunicationService.sendM32Command("PUT config/Random Groups/0", false); // All Chars
        this.m32CommunicationService.sendM32Command("PUT config/Length Rnd Gr/9", false);
        this.m32CommunicationService.sendM32Command("PUT Each Word 2x/0", false);
        this.m32CommunicationService.sendM32Command("PUT config/Max # of Words/15", false);
        this.m32CommunicationService.sleep(1000);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/4", false);

        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }

    setupCwSchoolSnapshot5() {
        // snapshot 5
        log.debug('configure snapshots 5');
        this.m32CommunicationService.sendM32Command("PUT menu/set/1"); // CW Keyer
        this.m32CommunicationService.sleep(1000);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/5", false);

        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }
    
    setupCwSchoolSnapshot6() {
        // snapshot 6
        log.debug('configure snapshots 6');
        this.m32CommunicationService.sendM32Command("PUT menu/set/26"); // Koch Trainer/Echo Trainer/CW Abbrevs
        this.m32CommunicationService.sendM32Command("PUT config/InterWord Spc/7", false);
        this.m32CommunicationService.sendM32Command("PUT config/Interchar Spc/15", false);
        this.m32CommunicationService.sendM32Command("PUT config/Random Groups/0", false); // All Chars
        this.m32CommunicationService.sendM32Command("PUT config/Length Abbrev/2", false);
        this.m32CommunicationService.sendM32Command("PUT Each Word 2x/0", false);
        this.m32CommunicationService.sendM32Command("PUT config/Max # of Words/20", false);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/6", false);

        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }

    setupCwSchoolSnapshot7() {
        // snapshot 7
        log.debug('configure snapshots 7');
        this.m32CommunicationService.sendM32Command("PUT menu/set/8"); // CW Generator/File Player
        this.m32CommunicationService.sendM32Command("PUT config/InterWord Spc/45", false);
        this.m32CommunicationService.sendM32Command("PUT config/Interchar Spc/15", false);
        this.m32CommunicationService.sendM32Command("PUT Each Word 2x/1", false);
        this.m32CommunicationService.sendM32Command("PUT config/Max # of Words/0", false);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/7", false);
        
        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }

    setupCwSchoolSnapshot8() {
        // snapshot 8
        log.debug('configure snapshots 8');
        this.m32CommunicationService.sendM32Command("PUT menu/set/13"); // Echo Trainer / Callsigns
        this.m32CommunicationService.sendM32Command("PUT config/InterWord Spc/25", false);
        this.m32CommunicationService.sendM32Command("PUT config/Interchar Spc/15", false);
        this.m32CommunicationService.sendM32Command("PUT config/Length Calls/1", false); // length = 3
        this.m32CommunicationService.sendM32Command("PUT Each Word 2x/1", false);
        this.m32CommunicationService.sendM32Command("PUT config/Max # of Words/0", false);
        this.m32CommunicationService.sendM32Command("PUT snapshot/store/8", false);
        
        this.m32CommunicationService.sendM32Command("GET snapshots");
        this.m32CommunicationService.sendM32Command("GET configs");
    }

    requestDeviceInfo() {
        this.m32CommunicationService.sendM32Command("GET device");
    }

    receivedDevice(value) {
        let message = 'Hardware: ' + value['hardware'] + ', Firmware: ' + value['firmware'];
        document.getElementById('m32-config-device-info').innerHTML = message;
    }
}

module.exports = { ConfigurationUI }

},{"./dom-utils":2,"loglevel":19}],6:[function(require,module,exports){
'use strict';

const log  = require ('loglevel');
const { EVENT_M32_CONNECTED, EVENT_M32_DISCONNECTED, EVENT_M32_CONNECT_ERROR } = require('./m32-communication-service');
const { EVENT_SETTINGS_CHANGED } = require('./m32-storage');

class M32ConnectUI {
    constructor(m32CommunicationService, m32Storage) {
        this.m32Storage = m32Storage;
        this.m32Storage.addEventListener(EVENT_SETTINGS_CHANGED, this.settingsChanged.bind(this));

        this.connectButton = document.getElementById("connectButton");
        this.voiceOutputCheckbox = document.getElementById("voiceOutputCheckbox");
        this.statusBar = document.getElementById("statusBar");
        this.voiceOutputEnabled = true;
        this.m32CommunicationService = m32CommunicationService;
        this.m32CommunicationService.addEventListener(EVENT_M32_CONNECTED, this.connected);
        this.m32CommunicationService.addEventListener(EVENT_M32_DISCONNECTED, this.disconnected.bind(this));
        this.m32CommunicationService.addEventListener(EVENT_M32_CONNECT_ERROR, this.connectError.bind(this));

        this.connectButton.addEventListener('click', this.clickConnect.bind(this), false);
        if (this.voiceOutputCheckbox) {
            this.voiceOutputCheckbox.addEventListener('change', this.clickVoiceOutputReceived.bind(this));
        }

        // check if serial communication is available at all:
        let serialCommunicationavailable = navigator.serial !== undefined;        
        if (!serialCommunicationavailable) {
            this.disableSerialCommunication();
        }  

        this.cwSchoolGrazEnabled = false;
        this.cwSchoolGrazCheckbox = document.getElementById("cwSchoolGrazCheckbox");
        if (this.cwSchoolGrazCheckbox) {
          this.cwSchoolGrazCheckbox.addEventListener('change', this.clickCwSchoolReceived.bind(this));   
        }

        document.addEventListener("m32Connected", (e) => {
            this.changeAllCwSchoolGrazElements();
        }, false);

    }

    //When the connectButton is pressed
    async clickConnect() {
        if (this.m32CommunicationService.isConnected()) {
            log.debug("disconnecting")
            //if already connected, disconnect
            this.m32CommunicationService.disconnect();

        } else {
            log.debug("connecting")
            //otherwise connect
            await this.m32CommunicationService.connect();
        }
    }

    disableSerialCommunication() {
        this.connectButton.disabled = true;
        document.getElementById('serialCommunicationDisabledInfo').style.display = 'block';
    }


    connected = () => {
        log.debug("Connect-UI, connected");
        this.statusBar.innerText = `Connected`;
        this.statusBar.className = 'badge bg-success';
        this.connectButton.innerText = 'Disconnect';
    }

    disconnected() {
        this.statusBar.innerText = `Disconnected`;
        this.statusBar.className = 'badge bg-danger';
        this.connectButton.innerText = 'Connect';
    }

    connectError(message) {
        this.connectButton.innerText = 'Connect'
        this.statusBar.innerText = message;
    }

    clickVoiceOutputReceived() {
        // saveSettings
        log.debug("voice output changed", this.m32Storage.settings);
        this.voiceOutputEnabled = this.voiceOutputCheckbox.checked;
        this.m32Storage.settings.voiceOutputEnabled = this.voiceOutputEnabled;
        this.m32CommunicationService.enableVoiceOutput(this.voiceOutputEnabled);
        this.m32Storage.saveSettings();
    }

    settingsChanged(settings) {
        log.debug("settings changed event", settings);
        this.voiceOutputEnabled = settings.voiceOutputEnabled;
        this.voiceOutputCheckbox.checked = this.voiceOutputEnabled;
        this.m32CommunicationService.enableVoiceOutput(this.voiceOutputEnabled);

        this.cwSchoolGrazEnabled = settings.showCwSchoolGraz;
        this.cwSchoolGrazCheckbox.checked = this.cwSchoolGrazEnabled;
        this.changeAllCwSchoolGrazElements();

    }

    clickCwSchoolReceived() {
        log.debug('CW School Graz changed');
        this.cwSchoolGrazEnabled = this.cwSchoolGrazCheckbox.checked;
        this.m32Storage.settings.showCwSchoolGraz = this.cwSchoolGrazEnabled;
        this.changeAllCwSchoolGrazElements(this.cwSchoolGrazEnabled);
        this.m32Storage.saveSettings();
    }

    changeAllCwSchoolGrazElements() {
        log.debug('enable all cw-school-graz elements');
        if (this.cwSchoolGrazEnabled && this.m32CommunicationService.commandUIHandler.m32ProtocolEnabled) {
            document.querySelectorAll('.cw-school-graz').forEach(element => element.classList.add('cw-school-graz-enabled'));
        } else {
            document.querySelectorAll('.cw-school-graz').forEach(element => element.classList.remove('cw-school-graz-enabled'));
        }
    }


}

module.exports = { M32ConnectUI }

},{"./m32-communication-service":4,"./m32-storage":12,"loglevel":19}],7:[function(require,module,exports){
'use strict';

const log  = require ('loglevel');
let jsdiff = require('diff');

const { createElement, createSpanElement, createElementWithChildren } = require('./dom-utils')

const { EVENT_M32_TEXT_RECEIVED, MORSERINO_START, MORSERINO_END } = require('./m32-communication-service');

class M32CwGeneratorUI {

    constructor(m32CommunicationService, m32Storage) {

        // define the elements
        this.receiveText = document.getElementById("receiveText");
        this.inputText = document.getElementById("inputText");

        this.showReceivedCheckbox = document.getElementById("showReceivedCheckbox");
        this.ignoreWhitespaceCheckbox = document.getElementById("ignoreWhitespaceCheckbox");
        this.autoHideCheckbox = document.getElementById("autoHideCheckbox");
        this.clearAllButton = document.getElementById("clearAllButton");
        this.clearReceivedButton = document.getElementById("clearReceivedButton");
        this.saveButton = document.getElementById("saveResultButton");
        document.getElementById("speakResultButton").addEventListener("click", this.speakResult.bind(this));

        this.resultComparison = document.getElementById("resultComparison");
        this.inputComparator = document.getElementById("inputComparator");
        this.correctPercentage = document.getElementById("correctPercentage");
        this.compareTextsButton = document.getElementById("compareTextsButton");

        this.lastPercentage;
        this.ignoreWhitespace = false;
        this.ignoreWhitespaceCheckbox.checked = this.ignoreWhitespace;

        this.showReceivedCheckbox.addEventListener('change', this.clickShowReceived.bind(this));
        this.ignoreWhitespaceCheckbox.addEventListener('change', this.clickIgnoreWhitespace.bind(this));
        this.clearAllButton.addEventListener('click', this.clearTextFields.bind(this));
        this.clearReceivedButton.addEventListener('click', this.clearReceivedTextField.bind(this));
        this.compareTextsButton.addEventListener('click', this.compareTexts.bind(this));
        this.saveButton.addEventListener('click', this.saveResult.bind(this));

        this.inputText.oninput = this.compareTexts.bind(this);

        document.getElementById("cw-generator-start-snapshot4-button").addEventListener('click', this.startSnapshot4.bind(this));
        document.getElementById("cw-generator-start-button").addEventListener('click', this.startCwGenerator.bind(this));        

        this.m32CommunicationService = m32CommunicationService;
        this.m32CommunicationService.addEventListener(EVENT_M32_TEXT_RECEIVED, this.textReceived.bind(this));
        this.m32State = this.m32CommunicationService.m32State; // FIXME: use event to publish change in m32State
        
        this.activeMode = true;

        //this.savedResultChart = this.createSavedResultChart();

        this.m32Storage = m32Storage;
        this.showSavedResults(this.m32Storage.getSavedResults());
    }

    textReceived(value) {
        if (this.activeMode) {
            log.debug("cw-generator received text", value);
            this.receiveText.value += value;
            //Scroll to the bottom of the text field
            this.receiveText.scrollTop = this.receiveText.scrollHeight;
            this.compareTexts();
            this.applyAutoHide();    
        }
    }

    applyAutoHide() {
        if (!this.autoHideCheckbox.checked) {
            return;
        }
        let text = this.receiveText.value;
        if (!text || text.length < MORSERINO_START.length) {
            return;
        }
        text = text.trim();
        if (this.showReceivedCheckbox.checked && text.startsWith(MORSERINO_START) && !text.endsWith(MORSERINO_END)) {
            this.showReceivedCheckbox.checked = false;
            this.showReceivedCheckbox.dispatchEvent(new Event('change'));
            log.debug('auto hiding text');
        }
        if (!this.showReceivedCheckbox.checked && text.startsWith(MORSERINO_START) && text.endsWith(MORSERINO_END)) {
            this.showReceivedCheckbox.checked = true;
            this.showReceivedCheckbox.dispatchEvent(new Event('change'));
            log.debug('auto unhiding text');
        }
    }


    clickShowReceived() {
        let shouldShow = this.showReceivedCheckbox.checked;
        log.debug('should show: ', shouldShow);
        if (shouldShow) {
            document.getElementById('morserino_detail').classList.add('show');
            this.resultComparison.classList.add('show');
        } else {
            document.getElementById('morserino_detail').classList.remove('show');
            this.resultComparison.classList.remove('show');
        }
    }
    
    clickIgnoreWhitespace() {
        this.ignoreWhitespace = this.ignoreWhitespaceCheckbox.checked;
        log.debug('ignore whitespace: ', this.ignoreWhitespace);
        this.compareTexts();
    }

    clearTextFields() {
        this.inputText.value = '';
        this.clearReceivedTextField();
    }
    
    clearReceivedTextField() {
        this.receiveText.value = '';
        this.inputComparator.innerHTML = '';
        this.correctPercentage.innerHTML = '';
    }

    compareTexts() {
        let received = this.trimReceivedText(this.receiveText.value).toLowerCase();
        let input = this.inputText.value.trim().toLowerCase();
    
        let [elements, correctCount, totalCount] = this.createHtmlForComparedText(received, input, this.ignoreWhitespace);
    
        this.inputComparator.replaceChildren(...elements);
        this.lastPercentage = received.length > 0 ? Math.round(correctCount / totalCount * 100) : 0;
        
        this.correctPercentage.innerText = 'Score: ' + correctCount + '/' + totalCount + ' correct (' + this.lastPercentage + '%)';
    }

    trimReceivedText(text) {
        text = text.trim();
        if (text.toLowerCase().startsWith(MORSERINO_START)) {
            text = text.substring(MORSERINO_START.length);
        }
        if (text.endsWith(' +')) {
            text = text.substring(0, text.length - MORSERINO_END.length);
        }
        return text;
    }

    speakResult() {
        let received = this.trimReceivedText(this.receiveText.value).toLowerCase();
        let input = this.inputText.value.trim().toLowerCase();
        let output = this.createVoiceTextForComparedText(received, input);

        output = [`${this.lastPercentage}% correct: `, ...output];

        this.m32CommunicationService.speechSynthesisHandler.speak(output.join('--'));
    }
    
    // ------------------------------ compare text and create nice comparison html -------------------------------
    createHtmlForComparedText(received, input, ignoreWhitespace) {
        let elements = [];
        let correctCount = 0;

        if (ignoreWhitespace) {
            received = received.replace(/\s/g,'');
            input = input.replace(/\s/g,'');
        }

        let diff = jsdiff.diffChars(received, input);
        diff.forEach(function (part) {
            // green for additions, red for deletions
            // grey for common parts
            if (part.added) {
                elements.push(createSpanElement(part.value, 'wrong'))
            } else if (part.removed) {
                elements.push(createSpanElement(part.value, 'missing'))
            } else {
                correctCount += part.value.length;
                elements.push(createSpanElement(part.value, 'correct'))
            }
        });
        return [elements, correctCount, received.length];
    }

    modeSelected(mode) {
        this.activeMode = mode === 'cw-generator';
        log.debug("cw generator active", this.activeMode, mode);
    }

    setDebug(debug) {
        if (debug) {
            this.receiveText.readOnly = false;
            this.receiveText.onfocus = null;
        } else {
            this.receiveText.readOnly = true;
            this.receiveText.addEventListener('focus', function(event) {
                event.target.blur();
            });
        }
    }

    createVoiceTextForComparedText(received, input) {
        let elements = [];

        let diff = jsdiff.diffChars(received, input);
        let that = this;
        diff.forEach(function (part) {
            // green for additions, red for deletions
            // grey for common parts
            if (part.added) {
                let letters = that.m32CommunicationService.m32translations.phonetisize(part.value);
                elements.push(`wrong ${letters}`);
            } else if (part.removed) {
                let letters = that.m32CommunicationService.m32translations.phonetisize(part.value);
                elements.push(`missing ${letters}`);
            } else {
                let letters = that.m32CommunicationService.m32translations.phonetisize(part.value);
                elements.push(`correct ${letters}`);
            }
        });
        return elements;
    }


    // ------------------------------ handle save(d) result(s) -------------------------------
    saveResult() {
        let storedResults = this.m32Storage.getSavedResults();
        if (!storedResults) {
            storedResults = [];
        }
        let receivedText = this.trimReceivedText(this.receiveText.value);
        let input = this.inputText.value.trim();
        let result = {
            text: receivedText, 
            input: input, 
            percentage: this.lastPercentage, 
            date: Date.now(), 
            ignoreWhitespace: this.ignoreWhitespace,
            speedWpm: this.m32State ? this.m32State.speedWpm : null
        };
        storedResults.push(result);
        this.m32Storage.saveResults(storedResults);
        this.showSavedResults(storedResults);
    }


    showSavedResults(savedResults) {
        var that = this;

        let resultElement = document.getElementById('savedResults');


        if (savedResults) {
            let tableElement = createElement(null, 'table', 'table');
            let elements = savedResults
                            .map((result, index) => {
                let date = new Date(result.date);
                let rowElement = createElement(null, 'tr', null);
                let cells = [];

                let cellContent = [];
                cellContent.push(createSpanElement(result.text, null));
                cellContent.push(createElement(null, 'br', null));
                if (result.input) {
                    cellContent.push(createSpanElement(result.input, null));
                    cellContent.push(createElement(null, 'br', null));
                    let ignoreWhitespace = result.ignoreWhitespace || false;
                    // eslint-disable-next-line no-unused-vars
                    let [comparedElements, correctCount] = this.createHtmlForComparedText(result.text, result.input, ignoreWhitespace);
                    cellContent.push(...comparedElements);
                }

                let textCell = createElement(null, 'td', null);
                textCell.replaceChildren(...cellContent);
                cells.push(textCell);
                cells.push(createElement((result.percentage ? result.percentage + '%' : ''), 'td', null));
                cells.push(createElement((result.speedWpm ? result.speedWpm + 'wpm' : ''), 'td', null));
                cells.push(createElement((result.date ? ' ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString() : ''), 'td', null));

                let loadElement = createElement('Load', 'button', 'btn btn-outline-primary');
                loadElement.setAttribute('type', 'button');
                loadElement.setAttribute('data-toggle', 'tooltip');
                loadElement.setAttribute('title', 'Load text into input field for CW Keyer mode.')
                loadElement.onclick = ( function(_text) { 
                    return function() { 
                        that.inputText.value = _text;
                        document.getElementsByClassName('inputContainer')[0].scrollIntoView();
                    }
                })(result.text);
                // eslint-disable-next-line no-undef
                new bootstrap.Tooltip(loadElement, { trigger : 'hover' });

                let removeElement = createElement('Remove', 'button', 'btn btn-outline-danger');
                removeElement.setAttribute('type', 'button');
                removeElement.setAttribute('title', 'Remove result from saved results.')
                removeElement.onclick = ( function(_index) { 
                    return function() { 
                        that.removeStoredResult(_index); 
                    }
                })(index);
                // eslint-disable-next-line no-undef
                new bootstrap.Tooltip(removeElement, { trigger : 'hover' });

                let buttonCell = createElement(null, 'td', null);
                buttonCell.replaceChildren(loadElement, createElement(null, 'br', null), removeElement);
                cells.push(buttonCell);

                rowElement.replaceChildren(...cells);
                return rowElement;
            });
            elements = elements.reverse(); // order by date desc

            let headerRow = createElementWithChildren('tr', 
            createElement('Received/Input/Comparison', 'th', null), 
            createElement('Success', 'th', null),
            createElement('Speed', 'th', null),
            createElement('Date/Time', 'th', null),
            createElement('', 'th', null),
            );

            let tableElements = [];
            tableElements.push(createElementWithChildren('thead', headerRow));
            tableElements.push(createElementWithChildren('tbody', ...elements));
            tableElement.replaceChildren(...tableElements);

            resultElement.replaceChildren(tableElement);  

            this.drawSavedResultGraph(savedResults);
        }
        this.showHideSavedResultGraph(savedResults);
    }

    removeStoredResult(index) {
        let savedResults = this.m32Storage.getSavedResults();
        // remove element index from array:
        savedResults = savedResults.slice(0,index).concat(savedResults.slice(index + 1));
        this.m32Storage.saveResults(savedResults);
        this.showSavedResults(savedResults);
    }

    drawSavedResultGraph(savedResults) {
        console.log('Drawing stored result graph');
        let percentageValues = [];
        let speedWpm = [];
        let labels = [];
        // eslint-disable-next-line no-unused-vars
        savedResults.forEach((result, index) => {
            let date = new Date(result.date);
            var dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
            labels.push(dateString);
            percentageValues.push(result.percentage);
            //console.log('speedwpm', index, result.speedWpm);
            speedWpm.push(result.speedWpm);
        });
        this.savedResultChart.data.labels = labels;
        this.savedResultChart.data.datasets[0].data = percentageValues;
        this.savedResultChart.data.datasets[1].data = speedWpm;
        if (!speedWpm.some(x => x)) {
            // if no speed info available, do not show speed axis and values
            this.savedResultChart.options.scales.y1.display = false;
            this.savedResultChart.options.plugins.legend.display = false;
        }
        this.savedResultChart.update();
    }
    
    showHideSavedResultGraph(savedResults) {
        let canvasElement = document.getElementById('savedResultChart');
        if (savedResults && savedResults.length > 0) {
            console.log('showing graph');
            canvasElement.style.display = 'block';
        } else {
            console.log('hiding graph');
            canvasElement.style.display = 'none';
        }
    }

    // ------------------------------ chart -------------------------------
    /*createSavedResultChart() {
        let ctx = document.getElementById('savedResultChart');
        // eslint-disable-next-line no-undef
        return new Chart(ctx, {
            type: 'line',
                    data: {
                        labels: [],
                        datasets: [
                        {
                            label: 'Score',
                            data: [],
                            borderColor: '#0d6efd', // same color as blue buttons
                            tension: 0.3,
                            yAxisID: 'y',
                        }, 
                        {
                            label: "Speed wpm",
                            data: [],
                            borderColor: 'red', 
                            yAxisID: 'y1',
                        }
                        ]
                    },
                    options: {
                        scales: {
                            y: {
                                ticks: {
                                    // eslint-disable-next-line no-unused-vars
                                    callback: function(value, index, ticks) {
                                        return value + '%';
                                    }
                                },
                                beginAtZero: true,
                            },
                            y1: {
                                position: 'right',
                                ticks: {
                                    // eslint-disable-next-line no-unused-vars
                                    callback: function(value, index, ticks) {
                                        return value + ' wpm';
                                    }
                                },
                                beginAtZero: false,
                                suggestedMin: 10,
                                suggestedMax: 25,
                                grid: {
                                    display: false
                                }
                            }
                        },
                        plugins: {
                            title: {
                                display: true,
                                text: 'Score',
                            },
                            legend: {
                                display: true,
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        var label = context.dataset.label || '';        
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += context.parsed.y + '%';
                                        }
                                        return label;
                                    }
                                }
                            }
                        }
                    },

            });


    }*/
    
    startSnapshot4() {
        log.debug("starting snapshot 4");
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT snapshot/recall/4', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start', false);
    }

    startCwGenerator() {
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start/20', false);
    }
}

module.exports = { M32CwGeneratorUI };
},{"./dom-utils":2,"./m32-communication-service":4,"diff":18,"loglevel":19}],8:[function(require,module,exports){
'use strict';

const { M32_MENU_CW_GENERATOR_FILE_PLAYER_ID } = require('./m32-communication-service');


const log  = require ('loglevel');
const { createElement } = require('./dom-utils');

const MAX_NUMBER_MEMORIES = 8;


class CWMemoryUI {
    constructor(m32CommunicationService) {
        
        this.m32CommunicationService = m32CommunicationService;
        this.m32CommunicationService.addProtocolHandler(this);

        document.getElementById("cw-memory-start-snapshot5-button").addEventListener('click', this.startSnapshot5.bind(this));
        document.getElementById("cw-memory-start-button").addEventListener('click', this.startCwKeyer.bind(this));        


        for (var index = 1; index < MAX_NUMBER_MEMORIES + 1; index++) {
            console.log("add click event to memory buttons ", index);
            document.getElementById("m32-cw-memory-" + index + "-save-button").addEventListener('click', this.saveCwMemory.bind(this, index));
            document.getElementById("m32-cw-memory-" + index + "-recall-button").addEventListener('click', this.recallCwMemory.bind(this, index));

            document.getElementById("m32-cw-memory-" + index + "-input").addEventListener('change', this.setInputToChanged.bind(this, index));
        }
    }


    // callback method for a full json object received
    handleM32Object(jsonObject) {
        console.log('cw-memory.handleM32Object', jsonObject);
        const keys = Object.keys(jsonObject);
        if (keys && keys.length > 0) {
            const key = keys[0];
            const value = jsonObject[key];
            switch(key) {
                case 'CW Memories':
                    if (value['cw memories in use']) {
                        const usedIndices = value['cw memories in use'];
                        console.log("received cw memory indices", usedIndices);
                        this.readCwMemoriesForIndices(usedIndices);
                    }
                    break;
                case 'CW Memory':
                    const index = value['number'];
                    const content = value['content'];
                    console.log("cw memory", index, "content", content);
                    this.cwMemoryReceived(index, content);
                    break;
                }
        } else {
            console.log('cannot handle json', jsonObject);
        }
    }

    readCwMemories() {
        this.m32CommunicationService.sendM32Command('GET cw/memories');
    }

    saveCwMemory(index) {
        let inputElement = document.getElementById("m32-cw-memory-" + index + "-input");
        const content = inputElement.value;
        console.log("Save CW Memory", index, content);
        this.m32CommunicationService.sendM32Command('PUT cw/store/' + index + '/' + content);

        inputElement.classList.remove("changed");
    }

    recallCwMemory(index) {
        console.log("Recall CW Memory", index);
        this.m32CommunicationService.sendM32Command('PUT cw/recall/' + index);            
    }

    readCwMemoriesForIndices(usedIndices) {
        console.log("Read cw memories for Indices", usedIndices);
        for (let index = 0; index < usedIndices.length; index++) {
            this.m32CommunicationService.sendM32Command('GET cw/memory/' + usedIndices[index]);
        }
    }

    cwMemoryReceived(index, content) {
        let inputElement = document.getElementById("m32-cw-memory-" + index + "-input");
        inputElement.value = content;
    }

    setInputToChanged(index) {
        let inputElement = document.getElementById("m32-cw-memory-" + index + "-input");
        inputElement.classList.add("changed");
    }

    startSnapshot5() {
        log.debug("starting snapshot 5");
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT snapshot/recall/5', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start', false);
    }

    startCwKeyer() {
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start/1', false);
    }

}
module.exports = { CWMemoryUI }

},{"./dom-utils":2,"./m32-communication-service":4,"loglevel":19}],9:[function(require,module,exports){
'use strict';

const log  = require ('loglevel');

const { createElement } = require('./dom-utils');

const { EVENT_M32_TEXT_RECEIVED } = require('./m32-communication-service');


class EchoTrainerUI {

    constructor(m32CommunicationService) {
        this.receiveText = document.getElementById("receiveTextEchoTrainer");
        this.clearEchoTrainerButton = document.getElementById("clearEchoTrainerButton");
        this.showAllAbbreviationsButton = document.getElementById("showAllAbbreviationsButton");

        this.clearEchoTrainerButton.addEventListener('click', this.clearEchoTrainerFields.bind(this));
        this.showAllAbbreviationsButton.addEventListener('click', this.showAllAbbreviations.bind(this));

        this.abbreviations = this.getAbbreviations();

        this.m32CommunicationService = m32CommunicationService;
        this.m32CommunicationService.addEventListener(EVENT_M32_TEXT_RECEIVED, this.textReceived.bind(this));

        document.getElementById("echo-trainer-start-snapshot6-button").addEventListener('click', this.startSnapshot6.bind(this));
        document.getElementById("echo-trainer-start-snapshot8-button").addEventListener('click', this.startSnapshot8.bind(this));
        document.getElementById("echo-trainer-start-button").addEventListener('click', this.startEchoTrainerAbbreviations.bind(this));

        this.activeMode = false;
    }

    textReceived(value) {
        if (this.activeMode) {
            this.receiveText.value += value;
            //Scroll to the bottom of the text field
            this.receiveText.scrollTop = this.receiveText.scrollHeight;
            this.detectAbbreviation();
        }
    }

    setDebug(debug) {
        if (debug) {
            this.receiveText.readOnly = false;
            this.receiveText.onfocus = null;
        } else {
            this.receiveText.readOnly = true;
            this.receiveText.addEventListener('focus', function(event) {
                event.target.blur();
            });
        }
    }

    modeSelected(mode) {
        this.activeMode = mode === 'echo-trainer';
        log.debug("echo trainer active", this.activeMode, mode);
    }



    detectAbbreviation() {
        let text = this.receiveText.value;
        if (text.endsWith(' OK')) {
            let lines = text.split(String.fromCharCode(10));
            let lastLine = lines[lines.length - 1];
            //console.log('lastline: ', lastLine);
            let abbreviation = lastLine.split(' ')[0];
            //console.log('abbreviation: ', abbreviation);
            if (abbreviation in this.abbreviations) {
                this.addAbbreviationToList(abbreviation, 1);
                //console.log('Abbreviation detected:', abbreviation, abbreviations[abbreviation]);
                // let abbrevText = abbreviations[abbreviation]['en'] + '/' + abbreviations[abbreviation]['de'];
                // let content = receiveTextEchoTrainer.value;//.slice(0, -1); // cut off trailing new line
                // receiveTextEchoTrainer.value = content + ' (' + abbrevText + ')';//  + String.fromCharCode(10);
            }
        }
    }

    showAllAbbreviations() {
        Object.keys(this.abbreviations).forEach((key) => {
            this.addAbbreviationToList(key, -1);
        })
    }
    
    addAbbreviationToList(abbreviation, position) {
        let table = document.getElementById('abbreviationTable');
        let rowElement = table.insertRow(position); // insert in 1st position after header
        let cells = [];
        cells.push(createElement(abbreviation, 'td', null));
        cells.push(createElement(this.abbreviations[abbreviation]['en'], 'td', null));
        cells.push(createElement(this.abbreviations[abbreviation]['de'], 'td', null));
        rowElement.replaceChildren(...cells);
    }
    
    clearEchoTrainerFields() {
        this.receiveText.value = '';
        this.clearAbbreviations();
    }
    
    clearAbbreviations() {
        let table = document.getElementById('abbreviationTable');
        let rowCount = table.getElementsByTagName('tr').length;
        for (let count = 1; count < rowCount; count++) {
            table.deleteRow(-1);
        }
    }

    startSnapshot6() {
        log.debug("starting snapshot 6");
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT snapshot/recall/6', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start', false);
    }

    startSnapshot8() {
        log.debug("starting snapshot 8");
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT snapshot/recall/8', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start', false);
    }

    startEchoTrainerAbbreviations() {
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start/11', false);
    }
    
    // source: https://de.wikipedia.org/wiki/Liste_von_Abk%C3%BCrzungen_im_Amateurfunk
    // and cw abbreviations CW-Schule graz
    getAbbreviations() {
        return {
            '33': {de: 'Grüße unter Funkerinnen', en: 'female ham greeting' },
            '44': {de: 'Melde mich via Telefon, WFF Gruß', en: 'answer by wire, call on telephone, WFF greetings' },
            '55': {de: 'Viel Erfolg', en: 'Good Luck' },
            '5nn': {de: '599', en: '599' },
            '72': {de: 'Viele Grüße QRP', en: 'Best regards QRP' },
            '73': {de: 'Viele Grüße', en: 'Best regards' },
            '88': {de: 'Liebe und Küsse', en: 'Love and kisses' },
            '99': {de: 'Verschwinde!', en: 'get lost!' },
            'a': {de: 'Alpha', en: 'Alpha'  },
            'aa': {de: 'alles nach...', en: 'all after...' },
            'ab': {de: 'alles vor...', en: 'all before...' },
            'abt': {de: 'ungefähr', en: 'about' },
            'ac': {de: 'Wechselstrom (auch Brumm)', en: 'alternating current' },
            'adr': {de: 'Anschrift', en: 'address' },
            'af': {de: 'Audiofrequenz', en: 'audio frequency' },
            'afsk': {de: 'audio freq. shift keying', en: 'audio freq. shift keying' },
            'agc': {de: 'Automatische Lautstärkeregelung', en: 'automatic gain control' },
            'agn': {de: 'Wieder, nochmals', en: 'again' },
            'alc': {de: 'Automatische Pegel-Regelung', en: 'automatic level control' },
            'am': {de: 'Vormittag, Amplitudenmodulation', en: 'before lunch, amplitude modulation' },
            'ani': {de: 'Irgendein, jemand', en: 'any' },
            'ans': {de: 'Antwort', en: 'answer' },
            'ant': {de: 'Antenne', en: 'antenna' },
            'any': {de: 'Irgendein, jemand', en: 'any' },
            'ar': {de: 'Spruchende', en: 'end of message' },
            'as': {de: 'Bitte warten', en: 'please wait quietly' },
            'atv': {de: 'amateur TV', en: 'amateur TV' },
            'avc': {de: 'Automatische Lautstärkeregelung', en: 'automatic volume control' },
            'award': {de: 'Amateurfunkdiplom', en: 'award' },
            'awdh': {de: 'Auf Wiederhören', en: '-' },
            'awds': {de: 'Auf Wiedersehen', en: '-' },
            'b': {de: 'Bravo', en: 'Bravo'  },
            'b4': {de: 'vorher', en: 'before' },
            'bc': {de: 'Rundfunk', en: 'broadcast' },
            'bci': {de: 'Rundfunkstörungen', en: 'Broadcast interference' },
            'bcnu': {de: 'Hoffe Dich wieder zu treffen', en: 'be seeing you' },
            'bd': {de: 'schlecht', en: 'bad' },
            'bfo': {de: 'Überlagerungsoszillator', en: 'beat frequency oscillator' },
            'bk': {de: 'Pause', en: 'break' },
            'bpm': {de: 'Buchstaben pro Minute', en: '-' },
            'bt': {de: 'Trennung (=)', en: 'break (=)' },
            'btr': {de: 'besser', en: 'better' },
            'btw': {de: 'Nebenbei bemerkt', en: 'by the way' },
            'bug': {de: 'halbautomatische Taste', en: 'semi-automatic key' },
            'buro': {de: 'Büro', en: 'bureau' },
            'c': {de: 'ja, Bejahung (von spanisch "si"), Charly', en: 'yes, correct, affirmation (from spanish "si"), Charly' },
            'call': {de: 'Rufzeichen, rufen', en: 'call-sign, call' },
            'cfm': {de: 'bestätige', en: 'confirm' },
            'cheerio': {de: 'Servus! Tschüss! (Grußwort)', en: 'cheerio' },
            'cl': {de: 'Station wird abgeschaltet', en: 'close' },
            'cld': {de: 'gerufen', en: 'called' },
            'clg': {de: 'rufend, ich rufe', en: 'calling' },
            'col': {de: 'kollationieren', en: 'collate' },
            'conds': {de: 'Ausbreitungsbedingungen', en: 'conditions' },
            'condx': {de: 'DX-Ausbreitungsbedingungen', en: 'dx-conditions' },
            'congrats': {de: 'Glückwünsche', en: 'congratulations' },
            'cpi': {de: 'aufnehmen', en: 'copy' },
            'cq': {de: 'allgemeiner Anruf', en: 'seek you' },
            'crd': {de: 'Stationskarte, (QSL-Karte)', en: 'card, verification card' },
            'cs': {de: 'Rufzeichen', en: 'call sign' },
            'cu': {de: 'Wir sehen uns später', en: 'see you' },
            'cuagn': {de: 'wir treffen uns wieder', en: 'see you again' },
            'cud': {de: 'konnte, könnte', en: 'could' },
            'cul': {de: 'wir sehen uns wieder', en: 'see you later' },
            'cw': {de: 'Tastfunk, Morsetelegrafie', en: 'continuous wave' },
            'd': {de: 'Delta', en: 'Delta'  },
            'db': {de: 'Dezibel', en: 'decibels' },
            'dc': {de: 'Gleichstrom', en: 'direct current' },
            de: {de: 'von (vor dem eigenen Rufz.)', en: 'from' },
            'diff': {de: 'Unterschied', en: 'difference' },
            'dl': {de: 'Deutschland', en: 'Germany' },
            'dok': {de: 'Distrikts-Ortsverbandskenner (DARC)', en: 'DOK' },
            'dr': {de: 'Liebe(r) ...', en: 'dear ...' },
            'dwn': {de: 'abwärts, niedrigere Frequenz', en: 'down' },
            'dx': {de: 'große Entfernung, Fernverbindung', en: 'long distance' },
            'e': {de: 'Echo', en: 'Echo'  },
            'ee': {de: 'ENDE', en: 'end' },
            'el': {de: '(Antennen-)Elemente', en: 'elements' },
            'elbug': {de: 'elektronische Taste', en: 'electronic key' },
            'ere': {de: 'hier', en: 'here' },
            'es': {de: 'und, &', en: 'and, &' },
            'excus': {de: 'Entschuldigung', en: 'excuse me' },
            'f': {de: 'Foxrott', en: 'Foxrott'  },
            'fb': {de: 'ausgezeichnet, prima', en: 'fine business' },
            'fer': {de: 'für', en: 'for' },
            'fm': {de: 'von, Frequenzmodulation', en: 'from, frequency modulation' },
            'fone': {de: 'Telefonie', en: 'telephony' },
            'fr': {de: 'für', en: 'for' },
            'frd': {de: 'Freund', en: 'friend' },
            'freq': {de: 'Frequenz', en: 'frequency' },
            'fwd': {de: 'vorwärts', en: 'forward' },
            'g': {de: 'Golf', en: 'Golf'  },
            //'ga': {de: 'beginnen Sie, anfangen', en: 'go ahead' },
            'ga': {de: 'Guten Nachmittag', en: 'good afternoon' },
            'gb': {de: 'leben Sie wohl', en: 'good bye' },
            'gd': {de: 'Guten Tag!', en: 'good day (nicht GB)' },
            'ge': {de: 'Guten Abend!', en: 'good evening' },
            'gl': {de: 'Viel Glück!', en: 'good luck!' },
            'gld': {de: 'erfreut', en: 'glad' },
            'gm': {de: 'Guten Morgen!', en: 'good morning' },
            'gn': {de: 'Gute Nacht!', en: 'good night' },
            'gnd': {de: 'Erdung, Erdpotential', en: 'ground' },
            'gp': {de: 'Ground-Plane-Antenne', en: 'ground plane antenna' },
            'gs': {de: 'Dollarnote', en: 'green stamp (dollar note)' },
            'gt': {de: 'Guten Tag', en: '-' },
            'gud': {de: 'gut', en: 'good' },
            'guhor': {de: 'kein Empfang (mehr)', en: 'going unable to hear or receive' },
            'h': {de: 'Hotel', en: 'Hotel'  },
            'ham': {de: 'Funkamateur', en: 'ham' },
            'hf': {de: 'high frequency, Kurzwelle (3-30MHz)', en: 'high frequency, shortwave (3-30MHz)' },
            'hh': {de: 'Irrung', en: 'correction' },
            'hi': {de: 'lachen', en: 'hi(larious), laughing' },
            'hpe': {de: 'ich hoffe', en: 'hope' },
            'hr': {de: 'hier', en: 'here' },
            'hrd': {de: 'gehört', en: 'heard' },
            'hrs': {de: 'Stunden', en: 'hours' },
            'hv': {de: 'habe', en: 'have' },
            'hvy': {de: 'schwer', en: 'heavy' },
            'hw': {de: 'wie (werde ich gehört)?', en: 'how (copy)?' },
            'hw?': {de: 'wie werde ich gehört?', en: 'how copy?' },
            'hwsat?': {de: 'wie finden Sie das?', en: 'how is about that?' },
            'i': {de: 'ich, India', en: 'I, India' },
            'iaru': {de: 'international amateur radio union', en: 'international amateur radio union' },
            'if': {de: 'Zwischenfrequenz', en: 'intermediate freq.' },
            'ii': {de: 'ich wiederhole', en: 'i repeat' },
            'info': {de: 'Information', en: 'information' },
            'inpt': {de: 'Eingang(sleistung)', en: 'input power' },
            'input': {de: 'Eingangsleistung', en: 'input' },
            'irc': {de: 'Antwortschein', en: 'international return coupon' },
            'itu': {de: 'Int. Fernmeldeunion', en: 'International Telecommunication Union' },
            'j': {de: 'Juliett', en: 'Juliett'  },
            'k': {de: 'Kommen ..., Kilo', en: 'come, Kilo' },
            'ka': {de: 'Spruchanfang', en: 'message begins' },
            'key': {de: 'Morsetaste', en: 'key' },
            'khz': {de: 'Kilo Herz', en: 'kilo herz' },
            'km': {de: 'Kilometer', en: 'kilometers' },
            'kn': {de: 'kommen, nur eine bestimmte Station', en: '"Over to you, only the station named should respond (e.g. W7PTH DE W1AW KN)"' },
            'knw': {de: 'wissen', en: 'know' },
            'kw': {de: 'kilowatt', en: 'kilowatt' },
            'ky': {de: 'Morsetaste', en: 'morse key' },
            'l': {de: 'Lima', en: 'Lima'  },
            'lbr': {de: 'Lieber ...', en: '-' },
            'lf': {de: 'Niederfrequenz, siehe NF', en: 'low frequency' },
            'lid': {de: 'schlechter Operator', en: '"lousy incompetent dummy"' },
            'lis': {de: 'lizenziert, Lizenz', en: 'licensed, licence' },
            'lng': {de: 'lang', en: 'long' },
            'loc': {de: 'Standortkenner', en: 'locator' },
            'log': {de: 'Stations-, Funktagebuch', en: 'log book' },
            'lp': {de: 'long path', en: 'long path' },
            'lsb': {de: 'unteres Seitenband', en: 'lower sideband' },
            'lsn': {de: 'hören Sie', en: 'listen' },
            'ltr': {de: 'Brief', en: 'letter' },
            'luf': {de: 'lowest usable freq.', en: 'lowest usable freq.' },
            'lw': {de: 'Langdrahtantenne', en: 'long wire antenna' },
            'm': {de: 'mobile., Mike', en: 'mobile., Mike' },
            'ma': {de: 'mA (milli-Ampere)', en: 'mA (milli-Ampere)' },
            'mesz': {de: 'Sommerzeit', en: 'middle european summer time' },
            'mez': {de: 'Winterzeit', en: 'middle european time zone' },
            'mgr': {de: 'Manager', en: 'manager' },
            'mhz': {de: 'Megahertz', en: 'megahertz' },
            'min': {de: 'Minute(n)', en: 'minute(s)' },
            'mins': {de: 'Minuten', en: 'minutes' },
            'mm': {de: 'bewegliche Seestation', en: 'maritime mobile' },
            'mni': {de: 'viel, viele', en: 'many' },
            'mod': {de: 'Modulation', en: 'modulation' },
            'msg': {de: 'Nachricht, Telegramm', en: 'message' },
            'mtr': {de: 'Meter, Messgerät', en: 'meter' },
            'muf': {de: 'maximum usable freq.', en: 'maximum usable freq.' },
            'my': {de: 'mein', en: 'my' },
            'n': {de: 'Nein, 9, November', en: 'no, 9, November' },
            'net': {de: 'Funknetz', en: 'network' },
            'nf': {de: 'Niederfrequenz', en: 'low freq.' },
            'nil': {de: 'nichts', en: 'nothing' },
            'no': {de: 'nein (auch: Nummer)', en: 'no (number)' },
            'nr': {de: 'Nahe, Nummer', en: 'near, number' },
            'nw': {de: 'Jetzt', en: 'now' },
            'o': {de: 'Oscar', en: 'Oscar'  },
            'ob': {de: 'alter Junge (vertrauliche Anrede)', en: 'old boy' },
            'oc': {de: 'alter Knabe (vertrauliche Anrede)', en: 'old chap' },
            'ok': {de: 'in Ordnung', en: 'O.K., okay' },
            'om': {de: 'Funker, Herr', en: 'old man' },
            'op': {de: 'Funker, Operator', en: 'operator' },
            'osc': {de: 'Oszillator', en: 'oscillator' },
            'oscar': {de: 'OSCAR Amateurfunksatellit', en: 'OSCAR satellite' },
            'ot': {de: 'langjähriger Funker, "alter Herr"', en: 'oldtimer' },
            'output': {de: 'Ausgang(sleistung)', en: 'output (power)' },
            'ow': {de: 'Ehefrau eines CB-Funkers', en: 'old woman' },
            'p': {de: 'Papa', en: 'Papa'  },
            'pa': {de: 'Endstufe', en: 'power amplifier' },
            'pep': {de: 'Hüllkurvenspitzenleistung', en: 'peak envelope power' },
            'pm': {de: 'Nachmittag', en: 'after lunch' },
            'pse': {de: 'Bitte', en: 'please' },
            'psed': {de: 'erfreut', en: 'pleased' },
            'pwr': {de: 'Leistung', en: 'power' },
            'px': {de: 'Präfix, Landeskenner', en: 'prefix, country code' },
            'q': {de: 'Quebec', en: 'Quebec'  },
            'qra':  {de: 'Der Name meiner Funkstelle ist...', en: 'name of my station is...'},
            'qrb':  {de: 'Die Entfernung zwischen unseren Funkstellen beträgt ungefähr ... Kilometer.', en: 'distance between our stations is...'},
            'qrg': {de: 'Deine genaue Frequenz ist ...', en: 'your exact frequency is ...' },
            'qrl':  {de: 'Ich bin beschäftigt, bitte nicht stören!, Arbeit, Ist die Frequenz frei?', en: 'I am busy! Please, do not interfere!, Work, Is this frequence in use?'},
            'qrm': {de: 'man made Störungen', en: 'man mad interference' },
            'qrn': {de: 'natürliche Störungen 1..nicht - 5..sehr stark', en: 'natural interference ...' },
            'qro':  {de: 'Sendeleistung erhöhen', en: 'increase power'},
            'qrp':  {de: 'Sendeliestung vermindern', en: 'decrease power'},
            'qrq':  {de: 'Geben Sie schneller', en: 'send faster'},
            'qrs':  {de: 'Geben Sie langsamer', en: 'send slower'},
            'qrt':  {de: 'Stellen Sie die Übermittlung ein', en: 'I am suspending operation shut off'},
            'qru': {de: 'Ich habe nichts für dich', en: 'i have nothing for you' },
            'qrv':  {de: 'Ich bin bereit', en: 'I am ready'},
            'qrx':  {de: 'Ich werde Sie um ... Uhr auf ... kHz wieder rufen.', en: 'I will call you again at ... on frq ...'},
            'qrz': {de: 'Du wirst von ... auf ... kHz gerufen (oder: Wer ruft mich?)', en: 'who is calling me?' },
            'qsb':  {de: 'Stärke schwankt', en: 'Your signals are fading'},
            'qsk':  {de: 'I kann Sie zwischen meinen Zeichen hören. Sie dürfen mich wäährend meiner Übermittlung unterbrechen.', en: 'I can hear you between my signals.'},
            'qsl': {de: 'Empfangsbestätigung', en: 'confirmation' },
            'qso':  {de: 'Ich kann mit ... unmittelbar verkehren', en: 'I can communicate directly with ...'},
            'qsp':  {de: 'Ich werde an ... vermitteln.', en: 'I can relay a message to ...'},
            'qst': {de: 'Nachricht an Alle!', en: 'broadcast!' },
            'qsy': {de: 'Frequenz ändern auf ... kHz', en: 'change freq. to ... kHz' },
            'qtc':  {de: 'Ich habe Nachrichten für Sie', en: 'I have telegrams for you'},
            'qth':  {de: 'Mein Standort ist ...', en: 'My position is ...'},
            'qtr':  {de: 'Es ist ... Uhr', en: 'Correct time UTC is ...'},
            'r': {de: 'Dezimalkomma (zwischen Zahlen), richtig, verstanden, keine Wiederholung nötig, Romeo', en: 'decimal point, roger, received, Romeo' },
            'rcvd': {de: 'empfangen', en: 'received' },
            're': {de: 'bezüglich ...', en: 'regarding ...' },
            'ref': {de: 'Referenz ...', en: 'reference ...' },
            'rf': {de: 'Hochfrequenz', en: 'radio frequency, high frequency' },
            'rfi': {de: 'Funkstörungen', en: 'radio frequency interference' },
            'rig': {de: 'Stationsausrüstung, Funkgerät', en: 'rig, station equipment' },
            'rprt': {de: 'Rapport', en: 'report' },
            'rpt': {de: 'wiederholen', en: 'repeat' },
            'rq': {de: 'Frage', en: 'request' },
            'rst': {de: 'readability, strength, tone', en: 'readability, strength, tone' },
            'rtty': {de: 'Funkfernschreiben', en: 'radio teletype' },
            'rx': {de: 'Empfänger', en: 'receiver' },
            's': {de: 'Sierra', en: 'Sierra'  },
            'sae': {de: 'adressierter Rückumschlag', en: 'self addressed envelope' },
            'sase': {de: 'Adressiertes, frankiertes Kuvert für QSL Karte', en: 'self adressed stamped envelope' },
            'shf': {de: 'super high frequency (cm-Wellen)', en: 'super high frequency' },
            'sigs': {de: 'Zeichen', en: 'signals' },
            'sk': {de: '"Verkehrsschluss (bei Funksprüchen), auch: Hinweis auf den Tod eines hams"', en: '"end of contact, also death of ham"' },
            'sked': {de: 'Verabredung', en: 'schedule' },
            'sn': {de: 'bald', en: 'soon' },
            'sota': {de: 'summits on the air', en: 'summits on the air' },
            'sp': {de: 'short path', en: 'short path' },
            'sri': {de: 'leider, tut mir leid', en: 'sorry' },
            'ssb': {de: 'Single Sideband', en: 'single sideband' },
            'sstv': {de: 'Bildübertragung', en: 'slow scan t.v.' },
            'stn': {de: 'Station', en: 'station' },
            'sum': {de: 'etwas, ein wenig', en: 'some' },
            'sure': {de: 'sicher, gewiss', en: 'sure' },
            'swl': {de: 'Kurzwellenhörer', en: 'short-ware listener' },
            'swr': {de: 'Stehwellenverhältnis', en: 'standing wave ratio' },
            't': {de: 'turns / tera- / 0, Tango', en: 'turns / tera- / 0, Tango' },
            'tcvr': {de: 'Sendeempfänger', en: 'transceiver' },
            'temp': {de: 'Temperatur', en: 'temperature' },
            'test': {de: 'Versuch (auch: Contest-Anruf)', en: 'test' },
            'tfc': {de: 'Funkverkehr', en: 'traffic' },
            'thru': {de: 'durch', en: 'trough' },
            'tia': {de: 'thanks in advance', en: 'thanks in advance' },
            'tks': {de: 'danke, Dank', en: 'thanks' },
            'tmw': {de: 'morgen', en: 'tomorrow' },
            'tnx': {de: 'danke, Dank', en: 'thanks' },
            'trub': {de: 'Schwierigkeiten, Störungen', en: 'trouble' },
            'trx': {de: 'Sendeempfänger', en: 'transceiver' },
            'tu': {de: 'Danke', en: 'Thank You' },
            'tvi': {de: 'Fernsehstörungen', en: 't.v. interference' },
            'tx': {de: 'Sender', en: 'transmitter' },
            'u': {de: 'Du, Uniform', en: 'you, Uniform' },
            'ufb': {de: 'ganz ausgezeichnet', en: 'ultra fine business' },
            'uhf': {de: 'ultra high frequency (dezimeter-Wellen)', en: 'ultra high frequency' },
            'ukw': {de: 'Ultrakurzwelle', en: 'very high frequency' },
            'unlis': {de: 'unlizenziert, "Pirat"', en: 'unlicensed' },
            'up': {de: 'aufwärts, höhere Frequenz ... kHz', en: 'up ... kHz' },
            'ur': {de: 'Du bist ...', en: 'your, you are ...' },
            'urs': {de: 'die Ihrigen, Deine Familie', en: 'your´s' },
            'usb': {de: 'oberes Seitenband', en: 'upper side band' },
            'utc': {de: 'koordinierte Weltzeit (Z-time)', en: 'universal time coordinated' },
            'v': {de: 'Viktor', en: 'Viktor' },
            've': {de: 'Verstanden', en: 'verified' },
            'vert': {de: 'Vertikal (Antenne)', en: 'vertical (antenna)' },
            'vfo': {de: 'verstellbarer Oszillator', en: 'variable frequency oscillator' },
            'vhf': {de: 'very high frequency (UKW-Bereich)', en: 'very high frequency' },
            'vl': {de: 'viel', en: 'many' },
            'vln': {de: 'Vielen', en: 'many' },
            'vy': {de: 'sehr', en: 'very' },
            'w': {de: 'Watt (Leistungsangabe), Whiskey', en: 'watt, watts, Whiskey' },
            'watts': {de: 'watt', en: 'watts' },
            'wid': {de: 'mit', en: 'with' },
            'wkd': {de: 'gearbeitet (gefunkt mit...)', en: 'worked' },
            'wkg': {de: 'ich arbeite (mit...)', en: 'working' },
            'wl': {de: 'ich werde ...', en: 'i will ...' },
            'wpm': {de: 'Worte pro Minute', en: 'words per minute' },
            'wtts': {de: 'Watt (Leistungsangabe)', en: 'watts' },
            'wud': {de: 'würde', en: 'would' },
            'wx': {de: 'Wetter', en: 'weather' },
            'x': {de: 'X-Ray', en: 'X-Ray'  },
            'xcus': {de: 'Entschuldigung, entschuldige', en: 'excuse' },
            'xcvr': {de: 'Sendeemfänger', en: 'transceiver' },
            'xmas': {de: 'Weihnachten', en: 'Christmas' },
            'xmtr': {de: 'Sender', en: 'transmitter' },
            'xtal': {de: 'Quarz', en: 'crystal, quartz crystal' },
            'xxx': {de: 'Dringlichkeitszeichen', en: 'urgency signal' },
            'xyl': {de: 'Ehefrau', en: 'ex young lady, wife' },
            'y': {de: 'Yankee', en: 'Yankee'  },
            'yday': {de: 'gestern', en: 'yesterday' },
            'yl': {de: 'Funkerin, Frau', en: 'young lady' },
            'yr': {de: 'Jahr', en: 'year' },
            'yrs': {de: 'Jahre', en: 'years' },
            'z': {de: 'Zulu Time', en: 'zulu time' },
        }
    }
    

}

module.exports = { EchoTrainerUI }
},{"./dom-utils":2,"./m32-communication-service":4,"loglevel":19}],10:[function(require,module,exports){
'use strict';

const { M32_MENU_CW_GENERATOR_FILE_PLAYER_ID } = require('./m32-communication-service');


const log  = require ('loglevel');
const { createElement } = require('./dom-utils');


class FileUploadUI {
    constructor(m32CommunicationService) {
        
        this.m32CommunicationService = m32CommunicationService;
        this.m32CommunicationService.addProtocolHandler(this);

        this.downloadFileButton = document.getElementById("m32-file-upload-download-file-button");
        this.uploadFileButton = document.getElementById("m32-file-upload-upload-file-button");
        this.fileSizeStatus = document.getElementById("m32-file-upload-file-size-status");
        this.fileTextArea = document.getElementById('file-upload-content');

        this.downloadFileButton.addEventListener('click', this.downloadFileButtonClick.bind(this), false);
        this.uploadFileButton.addEventListener('click', this.uploadFileButtonClick.bind(this), false);

        this.fileUploadList = document.getElementById('upload-text-list');
        this.fillUploadFileList();

        document.getElementById("m32-file-upload-start-snapshot7-button").addEventListener('click', this.startSnapshot7.bind(this));
        document.getElementById("m32-file-upload-menu-play-file-button").addEventListener('click', this.m32CwGeneratorFilePlayerStart.bind(this));

        //this.textsMap = this.getTextsMap();
    }

    readFile() {
        this.m32CommunicationService.sendM32Command('GET file/size');
        this.m32CommunicationService.sendM32Command('GET file/text');
    }

    // callback method for a full json object received
    handleM32Object(jsonObject) {
        console.log('configHandler.handleM32Object', jsonObject);
        const keys = Object.keys(jsonObject);
        if (keys && keys.length > 0) {
            const key = keys[0];
            const value = jsonObject[key];
            switch(key) {
                case 'file':
                    if (value['size']) {
                        this.receivedFileSize(value['size'], value['free']);
                    }
                    if (value['text']) {
                        this.receivedFileText(value['text']);
                    }
                    console.log('file-upload-handleM32Object', value);
                    break;
                }
        } else {
            console.log('cannot handle json', jsonObject);
        }
    }

    downloadFileButtonClick() {
        this.m32CommunicationService.sendM32Command('GET file/text');
    }

    uploadFileButtonClick() {
        let text = this.fileTextArea.value;
        let lines = text.split('\n');
        log.debug("Uploading text with " + lines.length + " lines");
        let command = "new";
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            let line = lines[lineNum].trim();
            if (line) {
                this.m32CommunicationService.sendM32Command('PUT file/' + command + '/' + lines[lineNum], false);
                command = 'append';
            }
        }
        this.m32CommunicationService.sendM32Command('GET file/size');
    }

    receivedFileSize(size, free) {
        log.debug("received file free/size", free, size);
        this.fileSizeStatus.innerHTML = size + "bytes used, " + free + "bytes free";
    }

    receivedFileText(text) {
        this.fileTextArea.value = text;
    }

    loadText(event) {
        let text = this.textsMap[event.target.id];
        if (text) {
            this.fileTextArea.value = text;
        }
    }

    loadUploadText(text) {
        if (text) {
            this.fileTextArea.value = text;
        } else {
            this.fileTextArea.value = 'foo';
        }
    }

    m32CwGeneratorFilePlayerStart() {
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start/' + M32_MENU_CW_GENERATOR_FILE_PLAYER_ID);
    }

    startSnapshot7() {
        log.debug("starting snapshot 7");
        this.m32CommunicationService.sendM32Command('PUT menu/stop', false);
        this.m32CommunicationService.sendM32Command('PUT snapshot/recall/7', false);
        this.m32CommunicationService.sendM32Command('PUT menu/start', false);
    }


    fillUploadFileList() {
        let elements = [];

        const texts = this.getFileUploadTexts();
        for (const text of texts) {
            let linkElement = createElement('<i class="bi bi-box-arrow-in-left"></i> ' + text.title, 'a', null);
            linkElement.setAttribute('href', 'javascript:');

            linkElement.addEventListener('click', () => { 
                this.fileTextArea.value = text.content; 
            });
            
            let listElement = createElement(null, 'li', null);
            listElement.replaceChildren(...[linkElement]);
            elements.push(listElement);
        }
        this.fileUploadList.replaceChildren(...elements);
    }


    getFileUploadTexts() {
        return [ {
            title: 'Deutsche Sprichwörter (DE)', 
            content:  
`\\c Deutsche Sprichworte
Jeder sollte vor seiner eigenen Tuer kehren. = 
Wer rastet, der rostet. = 
Wenn zwei sich streiten, freut sich der Dritte. = 
Wer ernten will, muss saeen. = 
Jeder Topf findet seinen Deckel. = 
Liebe geht durch den Magen. = 
Wo Rauch ist, da ist auch Feuer. = 
Puenktlichkeit ist die Hoeflichkeit der Koenige. = 
Das Auge isst mit. = 
Die Welt ist ein Dorf. = 
Das letzte Hemd hat keine Taschen. = 
Dummheit und Stolz wachsen auf einem Holz. = 
Wer schoen sein will, muss leiden. = 
Der Ton macht die Musik. = 
Die Ratten verlassen das sinkende Schiff. = 
Was Haenschen nicht lernt, lernt Hans nimmermehr. = 
Ist die Katze aus dem Haus tanzen die Maeuse auf dem Tisch. = 
Der Fisch stinkt vom Kopf her. = 
Man saegt nicht den Ast ab auf dem man sitzt. = 
Kleinvieh macht auch Mist. = 
Reden ist silber, schweigen ist gold. = 
Mit Speck faengt man Maeuse. = 
Eine Hand waescht die andere. = 
Lieber den Spatz in der Hand als die Taube auf dem Dach. = 
Unkraut vergeht nicht. = 
Wer den Pfennig nicht ehrt ist des Talers nicht wert. = 
In der Not frisst der Teufel Fliegen. = 
Pech im Spiel Glueck in der Liebe. = 
Ein gutes Gewissen ist ein sanftes Ruhekissen. = 
Wer im Glashaus sitzt, soll nicht mit Steinen werfen. = 
Viele Koeche verderben den Brei. = 
Kleider machen Leute. = 
Scherben bringen Glueck. = 
Einem geschenkten Gaul schaut man nicht ins Maul. = 
Luegen haben kurze Beine. = 
Auch ein blindes Huhn findet mal ein Korn. = 
Jeder ist seines Glueckes Schmied. = 
Aller guten Dinge sind drei. = 
Gelegenheit macht Diebe. = 
Der Apfel faellt nicht weit vom Stamm. = 
Wie man in den Wald hineinruft, so schallt es heraus. = 
Morgenstund hat Gold im Mund. = 
`
},
{
    title: 'ARRL Examination Texts (EN)', 
    content:  
`\\c ARRL Examination Texts
VVV <KA> a0ti de w8wq w8wq <BT> tnx fer call jimmy <BT> your rst is 597 <BT> my name is jill <BT> qth here is lansing, michigan <BT> rig here is a yaesu ftdx9000mp running 250 watts <BT> my antenna is a beam <BT> here, the weather is foggy, temp is 31 f <BT> been into radio for 57 years <BT> my occupation is balloonist <BT> bk to you <BT> a0ti de w8wq kn<AR>
VVV <KA> a2lzg de w5qtp/8 <BT> good to talk to you again tom. <BT> rig is kenwood jz781 and runs 340 watts to a monobander antenna up 90 feet. <BT> weather is foggy and my name is catherine. <BT> i live in charleston, south carolina where your rst is 559. <BT> my age is 54 and i am a secretary. <BT> how copy? <BT> a2lzg de w5qtp/8 [sk]<AR>
VVV <KA> a4xxs de wf1jy/8 <BT> thanks for coming back edward. <BT> rig is kenwood jz429 and runs 875 watts to a yagi antenna up 112 feet. <BT> weather is overcast and cold and my name is catherine. <BT> i live in kailua, hawaii where your rst is 498. <BT> my age is 70 and i am a architect. <BT> how copy? <BT> a4xxs de wf1jy/8<AR>
VVV <KA> a5uu a5uu a5uu de kv6he <BT> tnx fer call maggie <BT> your rst is 545 <BT> name hr is alison <BT> im using an ic746pro es using 250 watts <BT> the ant is a beam <BT> qth is san jose, california <BT> here, the weather is great <BT> i work hr as a pottery painter <BT> ham since 1943 <BT> back to you maggie <BT> a5uu de kv6he kn<AR>
VVV <KA> a5yrz de kq2qyy/5 <BT> i am copying you with difficulty sarah. <BT> rig is kenwood zp691 and runs 170 watts to a dipole antenna up 73 feet. <BT> weather is hot and muggy and my name is eddie. <BT> i live in pittsfield, massachusetts where your rst is 558. <BT> my age is 39 and i am a architect. <BT> how copy? <BT> a5yrz de kq2qyy/5<AR>
VVV <KA> a9ve de kz0yy/3 <BT> solid copy robert. <BT> rig is heath xp297 and runs 805 watts to a inverted v antenna up 77 feet. <BT> weather is rainy and warm and my name is bob. <BT> i live in nashua, new hampshire where your rst is 469. <BT> my age is 56 and i am a student. <BT> how copy? <BT> a9ve de kz0yy/3 [sk]<AR>
VVV <KA> ab1xfz de kt5zjq/9 <BT> thanks for coming back thomas. <BT> rig is kenwood xv827 and runs 105 watts to a log periodic antenna up 107 feet. <BT> weather is overcast and warm and my name is matthew. <BT> i live in aberdeen, south dakota where your rst is 498. <BT> my age is 58 and i am a contractor. <BT> how copy? <BT> ab1xfz de kt5zjq/9 [sk]<AR>
VVV <KA> aj1s de kt6fq kt6fq <BT> tnx fer call justin <BT> ur rst is 567 solid cpy <BT> the name is ben <BT> location hr is redding, california <BT> rig here is an icom ic756 putting out 350 watts <BT> im using an hy gain beam <BT> wx hr very wet <BT> during the day im a congressman <BT> first licenced in 1919 <BT> bk to you <BT> aj1s de kt6fq kn<AR>
VVV <KA> ak2xx de wx5ywq/9 <BT> i am copying you with difficulty josh. <BT> rig is icom pj587 and runs 445 watts to a v beam antenna up 25 feet. <BT> weather is snow and cold and my name is jimmy. <BT> i live in wichita, kansas where your rst is 599. <BT> my age is 71 and i am a chemist. <BT> how copy? <BT> ak2xx de wx5ywq/9<AR>
VVV <KA> am4s am4s de wc3o <BT> tnx fer call rich <BT> my name is harold <BT> ur rst is 465 <BT> the qth is uniontown, pennsylvania <BT> rig is icom ic775 es using 200 watts <BT> ant is beam <BT> here, the weather is very humid, temp is 70 f <BT> my job is as a barista <BT> been licenced since 1920 <BT> over to you <BT> am4s de wc3o kn<AR>
VVV <KA> ap4zzw de kx9uy/3 <BT> rrr and thanks alex. <BT> rig is icom px639 and runs 750 watts to a yagi antenna up 28 feet. <BT> weather is hot and muggy and my name is johnny. <BT> i live in hagerstown, maryland where your rst is 558. <BT> my age is 38 and i am a professor. <BT> how copy? <BT> ap4zzw de kx9uy/3<AR>
VVV <KA> ap5vjz de kz0bpx/4 <BT> thanks for coming back jim. <BT> rig is icom pj328 and runs 240 watts to a v beam antenna up 36 feet. <BT> weather is thunderstorm and my name is liz. <BT> i live in danbury, connecticut where your rst is 459. <BT> my age is 69 and i am a architect. <BT> how copy? <BT> ap5vjz de kz0bpx/4<AR>
VVV <KA> aq9kjz de wx1yzw/4 <BT> good to talk to you again michael. <BT> rig is icom zp796 and runs 575 watts to a dipole antenna up 30 feet. <BT> weather is sunny and warm and my name is becky. <BT> i live in oshkosh, wisconsin where your rst is 579. <BT> my age is 26 and i am a professor. <BT> how copy? <BT> aq9kjz de wx1yzw/4 [sk]<AR>
VVV <KA> ar0yxp de wn3jaw/3 <BT> i am copying you with difficulty joshua. <BT> rig is homebrew kx497 and runs 735 watts to a colinear antenna up 93 feet. <BT> weather is rainy and cold and my name is pat. <BT> i live in jackson, mississippi where your rst is 588. <BT> my age is 18 and i am a welder. <BT> how copy? <BT> ar0yxp de wn3jaw/3 [sk]<AR>
VVV <KA> aw7x/8 de wn4p wn4p <BT> gm travis <BT> your rst is 465 with slight qrn <BT> name here is dion <BT> qth hr lexington, kentucky <BT> im using a ts570s at 50 watts <BT> ant is delta loop <BT> here, the weather is rather warm <BT> been a ham for 18 years <BT> im an air marshal <BT> 73 es gud dx <BT> aw7x/8 de wn4p sk<AR>
VVV <KA> aw8n/9 de w3em w3em <BT> thanks hillary <BT> your rst 456 456 <BT> name here is mike <BT> our qth is baltimore, maryland <BT> my radio is a knwd ts50s with 300 watts <BT> im using a g5rv <BT> the weather here is nice <BT> i work as a pianist <BT> been a ham for 14 years <BT> over to you <BT> aw8n/9 de w3em<AR>
VVV <KA> aw9pxj de wx5qyz/1 <BT> rrr and thanks grace. <BT> rig is icom pj589 and runs 560 watts to a tribander antenna up 94 feet. <BT> weather is thunderstorm and my name is sam. <BT> i live in kalamazoo, michigan where your rst is 488. <BT> my age is 59 and i am a architect. <BT> how copy? <BT> aw9pxj de wx5qyz/1<AR>
VVV <KA> ay3kpz de k4wiy/5 <BT> solid copy james. <BT> rig is kenwood kx599 and runs 890 watts to a inverted v antenna up 18 feet. <BT> weather is overcast and warm and my name is sarah. <BT> i live in dover, deleware where your rst is 588. <BT> my age is 66 and i am a doctor. <BT> how copy? <BT> ay3kpz de k4wiy/5<AR>
VVV <KA> ay6vxx de kj0jyz/8 <BT> good copy joshua. <BT> rig is icom xv233 and runs 135 watts to a yagi antenna up 96 feet. <BT> weather is hot and dry and my name is liza. <BT> i live in fayetteville, arkansas where your rst is 459. <BT> my age is 34 and i am a doctor. <BT> how copy? <BT> ay6vxx de kj0jyz/8<AR>
VVV <KA> az0zzu de kz6qyz/7 <BT> good to talk to you again william. <BT> rig is icom pz480 and runs 330 watts to a monobander antenna up 65 feet. <BT> weather is thunderstorm and my name is andy. <BT> i live in pocatello, idaho where your rst is 588. <BT> my age is 61 and i am a chemist. <BT> how copy? <BT> az0zzu de kz6qyz/7 [sk]<AR>
VVV <KA> k0hpy de ny5xu/2 <BT> thanks for coming back ed. <BT> rig is drake zk486 and runs 780 watts to a inverted v antenna up 61 feet. <BT> weather is sunny and warm and my name is josh. <BT> i live in grants pass, oregon where your rst is 598. <BT> my age is 50 and i am a chemist. <BT> how copy? <BT> k0hpy de ny5xu/2 [sk]<AR>
VVV <KA> k0jkx de n7zp/9 <BT> thanks for coming back anne. <BT> rig is kenwood zy538 and runs 50 watts to a tribander antenna up 10 feet. <BT> weather is thunderstorm and my name is mary. <BT> i live in lakeland, florida where your rst is 458. <BT> my age is 28 and i am a architect. <BT> how copy? <BT> k0jkx de n7zp/9 [sk]<AR>
VVV <KA> k3uby de k6siw k6siw <BT> r r r tnx fer call garfield <BT> rst 598 <BT> name here is arnie <BT> i have an ic756pro3 at 350 watts ant is beam <BT> our qth is paradise, california <BT> wx hr is a bit too warm, temp is 62 f <BT> been licenced for 60 years <BT> job-wise im a waiter <BT> hw copy now? <BT> k3uby de k6siw kn<AR>
VVV <KA> k4eo/9 k4eo/9 k4eo/9 de w9vp <BT> ok es tnx fer call bertha <BT> the name is harry <BT> your rst 569 solid cpy <BT> my qth is normal, illinois <BT> i have a k2 at 450 watts <BT> ant is quad <BT> the weather here is frosty, temp is 38 f <BT> im a sailor <BT> first licenced in 1904 <BT> back to you bertha, 73 es cu agn <BT> k4eo/9 de w9vp sk<AR>
VVV <KA> k4msb k4msb k4msb de wh1fv <BT> tnx fer call bessie <BT> name jimmy <BT> rst 465 <BT> my rig is ft857 350 watts <BT> ant is inverted v <BT> the qth is springfield, massachusetts <BT> the weather here is very damp, temp is 58 f <BT> job-wise im an online poker player <BT> got my ticket in 1943 <BT> over to you bessie <BT> k4msb de wh1fv kn<AR>
VVV <KA> k4xox de ku2kvf/7 <BT> rrr and thanks vicky. <BT> rig is icom jz537 and runs 85 watts to a zepp antenna up 64 feet. <BT> weather is sunny and warm and my name is david. <BT> i live in provo, utah where your rst is 559. <BT> my age is 70 and i am a doctor. <BT> how copy? <BT> k4xox de ku2kvf/7<AR>
VVV <KA> k5lcz de ws2xk/1 <BT> rrr and thanks eddie. <BT> rig is homebrew zx459 and runs 845 watts to a v beam antenna up 96 feet. <BT> weather is snow and cold and my name is mickey. <BT> i live in crossville, tennessee where your rst is 458. <BT> my age is 40 and i am a programmer. <BT> how copy? <BT> k5lcz de ws2xk/1 [sk]<AR>
VVV <KA> k5sy de ap0kvw/2 <BT> solid copy catherine. <BT> rig is yaesu px534 and runs 400 watts to a log periodic antenna up 24 feet. <BT> weather is overcast and cold and my name is bobby. <BT> i live in augusta, georgia where your rst is 598. <BT> my age is 60 and i am a contractor. <BT> how copy? <BT> k5sy de ap0kvw/2 [sk]<AR>
VVV <KA> k5yx de wl4uzk/5 <BT> good copy patrick. <BT> rig is kenwood zp108 and runs 580 watts to a delta loop antenna up 119 feet. <BT> weather is hot and muggy and my name is joseph. <BT> i live in aberdeen, south dakota where your rst is 489. <BT> my age is 36 and i am a secretary. <BT> how copy? <BT> k5yx de wl4uzk/5 [sk]<AR>
VVV <KA> k6ytu de nx2uzj/2 <BT> good copy sophie. <BT> rig is collins sb332 and runs 140 watts to a dipole antenna up 104 feet. <BT> weather is overcast and warm and my name is jack. <BT> i live in utica, new york where your rst is 558. <BT> my age is 60 and i am a chemist. <BT> how copy? <BT> k6ytu de nx2uzj/2<AR>
VVV <KA> k7bq de nx4yjr/2 <BT> solid copy liz. <BT> rig is icom zk983 and runs 295 watts to a monobander antenna up 23 feet. <BT> weather is overcast and warm and my name is daniel. <BT> i live in altoona, pennsylvania where your rst is 499. <BT> my age is 31 and i am a lawyer. <BT> how copy? <BT> k7bq de nx4yjr/2<AR>
VVV <KA> k7jfw de nz9yzn/9 <BT> good copy billy. <BT> rig is collins kx769 and runs 180 watts to a log periodic antenna up 11 feet. <BT> weather is overcast and warm and my name is daniel. <BT> i live in alliance, nebraska where your rst is 599. <BT> my age is 71 and i am a secretary. <BT> how copy? <BT> k7jfw de nz9yzn/9 [sk]<AR>
VVV <KA> k7zq de w9tyu/6 <BT> solid copy emma. <BT> rig is kenwood jz939 and runs 560 watts to a dipole antenna up 58 feet. <BT> weather is rainy and cold and my name is pat. <BT> i live in boulder, colorado where your rst is 469. <BT> my age is 66 and i am a lawyer. <BT> how copy? <BT> k7zq de w9tyu/6 [sk]<AR>
VVV <KA> k9ub k9ub de ni9kh ni9kh <BT> tnx fer call lisa <BT> the name is gail <BT> rst 366 366 with slight qrm <BT> the qth is urbana urbana, illinois <BT> im using a knwd ts50s running 200 watts <BT> im using a beam <BT> the weather here is frosty <BT> job-wise im a county sheriff <BT> been licenced since 1967 <BT> must qrt, telephone. 73 73 lisa <BT> k9ub de ni9kh sk<AR>
VVV <KA> kb1gn kb1gn de wi4l wi4l <BT> tnx fer call richard <BT> my name is albert <BT> ur rst 347 347 with slight qrn <BT> qth here is norfolk norfolk, irginia <BT> i have a k1 running 200 watts <BT> the ant is a yagi <BT> wx here is a bit too warm, temp is 96 f <BT> been licenced since 1926 <BT> job-wise im an economist <BT> must qrt, telephone. 73 73 richard <BT> kb1gn de wi4l [sk] kn<AR>
VVV <KA> kc4bxz de nj4zx/9 <BT> solid copy rachel. <BT> rig is kenwood px592 and runs 235 watts to a dipole antenna up 14 feet. <BT> weather is overcast and cold and my name is henry. <BT> i live in pocatello, idaho where your rst is 479. <BT> my age is 29 and i am a bookkeeper. <BT> how copy? <BT> kc4bxz de nj4zx/9<AR>
VVV <KA> ke0m de k4dv k4dv <BT> fb, tnx for call jan <BT> your rst is 446 with qrm <BT> name hr is olaf <BT> rig here is an icom ic775 150 watts <BT> my ant is vertical <BT> my qth is atlanta, georgia <BT> hr wx is too wet <BT> been into radio for 15 years <BT> my occupation is fedex driver <BT> i have to shut down now jan, 73 es gud dx <BT> ke0m de k4dv [sk] [kn]<AR>
VVV <KA> kg0aq kg0aq kg0aq de wx1sp <BT> thanks richard <BT> ur rst is 558 <BT> my name is kathy <BT> my location is bridgeport, connecticut <BT> i have a yaesu ft1000mp 400 watts <BT> the ant is a 3 el yagi <BT> the weather here is very nice <BT> my job is as a secretary <BT> first licenced in 1947 <BT> back to you <BT> kg0aq de wx1sp [kn]<AR>
VVV <KA> ki3f de n2mc/0 n2mc/0 <BT> thanks for the call bessie <BT> name kathy <BT> rst 577 <BT> rig here is a yaesu ft990 es using 500 watts <BT> ant hr is hy gain beam <BT> my location is mitchell, south dakota <BT> wx hr is icy <BT> my job is as a sculptor <BT> ive been licenced for 58 years <BT> good luck bessie, many tnx <BT> ki3f de n2mc/0 [sk] [kn]<AR>
VVV <KA> ki5i de k3nvm/4 k3nvm/4 <BT> fb, tnx for call chris <BT> name here is robert <BT> your rst is 457 with slight qrn<BT> i have a yaesu ft600 150 watts the ant is a vertical <BT> qth is lexington, kentucky <BT> wx hr cold and windy <BT> my job is as a weiner mobile driver <BT> been a ham for 43 years <BT> hw copy now? <BT> ki5i de k3nvm/4 [kn]<AR>
VVV <KA> kj1was de wx0wwx/6 <BT> thanks for coming back claire. <BT> rig is icom zp651 and runs 245 watts to a colinear antenna up 62 feet. <BT> weather is overcast and warm and my name is grace. <BT> i live in pittsfield, massachusetts where your rst is 569. <BT> my age is 44 and i am a doctor. <BT> how copy? <BT> kj1was de wx0wwx/6<AR>
VVV <KA> kl4vyy de w6fpx/8 <BT> rrr and thanks matt. <BT> rig is kenwood xv917 and runs 130 watts to a inverted v antenna up 50 feet. <BT> weather is snow and cold and my name is eddie. <BT> i live in bismarck, north dakota where your rst is 478. <BT> my age is 71 and i am a welder. <BT> how copy? <BT> kl4vyy de w6fpx/8 [sk]<AR>
VVV <KA> kl5zqy de k0jq/3 <BT> rrr and thanks andy. <BT> rig is drake xv264 and runs 320 watts to a dipole antenna up 39 feet. <BT> weather is overcast and cold and my name is sarah. <BT> i live in grass valley, california where your rst is 579. <BT> my age is 68 and i am a programmer. <BT> how copy? <BT> kl5zqy de k0jq/3 [sk]<AR>
VVV <KA> kq1puu de wy2xj/8 <BT> good to talk to you again grace. <BT> rig is kenwood kx550 and runs 295 watts to a dipole antenna up 78 feet. <BT> weather is sunny and cold and my name is edward. <BT> i live in harlingen, texas where your rst is 499. <BT> my age is 46 and i am a bookkeeper. <BT> how copy? <BT> kq1puu de wy2xj/8<AR>
VVV <KA> kq4ppx de k5jo/6 <BT> rrr and thanks rachel. <BT> rig is icom pz977 and runs 745 watts to a yagi antenna up 106 feet. <BT> weather is rainy and warm and my name is william. <BT> i live in augusta, georgia where your rst is 479. <BT> my age is 30 and i am a lawyer. <BT> how copy? <BT> kq4ppx de k5jo/6<AR>
VVV <KA> kr3xq de km8rjx/3 <BT> solid copy sarah. <BT> rig is homebrew zv777 and runs 50 watts to a dipole antenna up 66 feet. <BT> weather is rainy and warm and my name is alice. <BT> i live in alamogordo, new mexico where your rst is 558. <BT> my age is 54 and i am a lawyer. <BT> how copy? <BT> kr3xq de km8rjx/3 [sk]<AR>
VVV <KA> ku0dy de wo6spw/7 <BT> rrr and thanks edward. <BT> rig is yaesu pj958 and runs 245 watts to a dipole antenna up 72 feet. <BT> weather is sunny and cold and my name is johnny. <BT> i live in winnemucca, nevada where your rst is 499. <BT> my age is 22 and i am a welder. <BT> how copy? <BT> ku0dy de wo6spw/7 [sk]<AR>
VVV <KA> kv4jdx de w8ryx/2 <BT> solid copy joshua. <BT> rig is heath pj893 and runs 405 watts to a zepp antenna up 37 feet. <BT> weather is sunny and warm and my name is rebecca. <BT> i live in kailua, hawaii where your rst is 458. <BT> my age is 17 and i am a student. <BT> how copy? <BT> kv4jdx de w8ryx/2 [sk]<AR>
VVV <KA> kw6juy de kw0pwh/2 <BT> rrr and thanks liz. <BT> rig is icom zv229 and runs 330 watts to a log periodic antenna up 50 feet. <BT> weather is foggy and my name is beth. <BT> i live in crossville, tennessee where your rst is 478. <BT> my age is 64 and i am a doctor. <BT> how copy? <BT> kw6juy de kw0pwh/2 [sk]<AR>
VVV <KA> kx6qzp de k6zzx/6 <BT> solid copy beth. <BT> rig is heath kx278 and runs 140 watts to a dipole antenna up 24 feet. <BT> weather is thunderstorm and my name is kathy. <BT> i live in hibbing, minnesota where your rst is 489. <BT> my age is 29 and i am a mechanic. <BT> how copy? <BT> kx6qzp de k6zzx/6<AR>
VVV <KA> kx7kq de np1x/1 <BT> solid copy vicky. <BT> rig is kenwood zk974 and runs 625 watts to a delta loop antenna up 46 feet. <BT> weather is hot and muggy and my name is jane. <BT> i live in bismarck, north dakota where your rst is 568. <BT> my age is 35 and i am a programmer. <BT> how copy? <BT> kx7kq de np1x/1<AR>
VVV <KA> ky0jyv de w5yy/3 <BT> good copy grace. <BT> rig is icom pj834 and runs 50 watts to a dipole antenna up 116 feet. <BT> weather is foggy and my name is bill. <BT> i live in bozeman, montana where your rst is 559. <BT> my age is 34 and i am a welder. <BT> how copy? <BT> ky0jyv de w5yy/3 [sk]<AR>
VVV <KA> ky0q de ku8yx/2 <BT> thanks for coming back johnny. <BT> rig is kenwood zx210 and runs 130 watts to a inverted v antenna up 78 feet. <BT> weather is sunny and warm and my name is bob. <BT> i live in provo, utah where your rst is 569. <BT> my age is 31 and i am a carpenter. <BT> how copy? <BT> ky0q de ku8yx/2 [sk]<AR>
VVV <KA> ky5ulc de nz7qjx/7 <BT> i am copying you with difficulty patrick. <BT> rig is icom jx418 and runs 320 watts to a v beam antenna up 111 feet. <BT> weather is thunderstorm and my name is kathryn. <BT> i live in jackson, mississippi where your rst is 569. <BT> my age is 40 and i am a professor. <BT> how copy? <BT> ky5ulc de nz7qjx/7 [sk]<AR>
VVV <KA> ky6zpv de wm4cxp/0 <BT> rrr and thanks matthew. <BT> rig is heathkit kx252 and runs 195 watts to a v beam antenna up 29 feet. <BT> weather is rainy and warm and my name is rachel. <BT> i live in hagerstown, maryland where your rst is 588. <BT> my age is 39 and i am a carpenter. <BT> how copy? <BT> ky6zpv de wm4cxp/0<AR>
VVV <KA> ky7xzd de az5zzz/1 <BT> thanks for coming back hank. <BT> rig is icom zx688 and runs 665 watts to a zepp antenna up 22 feet. <BT> weather is hot and dry and my name is jimmy. <BT> i live in nashua, new hampshire where your rst is 589. <BT> my age is 24 and i am a pilot. <BT> how copy? <BT> ky7xzd de az5zzz/1 [sk]<AR>
VVV <KA> ky8my de wj5jkr/4 <BT> solid copy daniel. <BT> rig is icom zx666 and runs 765 watts to a colinear antenna up 98 feet. <BT> weather is rainy and cold and my name is claire. <BT> i live in alamogordo, new mexico where your rst is 469. <BT> my age is 55 and i am a mechanic. <BT> how copy? <BT> ky8my de wj5jkr/4 [sk]<AR>
VVV <KA> kz3yey de nz9yux/8 <BT> good to talk to you again josh. <BT> rig is yaesu xp852 and runs 160 watts to a zepp antenna up 61 feet. <BT> weather is snow and cold and my name is johnny. <BT> i live in hibbing, minnesota where your rst is 588. <BT> my age is 32 and i am a pilot. <BT> how copy? <BT> kz3yey de nz9yux/8<AR>
VVV <KA> kz6wjg de wz5zry/8 <BT> i am copying you with difficulty william. <BT> rig is heath zy348 and runs 740 watts to a vertical antenna up 39 feet. <BT> weather is overcast and cold and my name is michael. <BT> i live in spokane, washington where your rst is 588. <BT> my age is 16 and i am a sales manager. <BT> how copy? <BT> kz6wjg de wz5zry/8<AR>
VVV <KA> kz8nyz de wo1oyp/8 <BT> thanks for coming back patrick. <BT> rig is icom pz817 and runs 440 watts to a dipole antenna up 93 feet. <BT> weather is hot and dry and my name is catherine. <BT> i live in akron, ohio where your rst is 599. <BT> my age is 29 and i am a programmer. <BT> how copy? <BT> kz8nyz de wo1oyp/8 [sk]<AR>
VVV <KA> kz9pjm de kj1iw/7 <BT> good copy becky. <BT> rig is collins xv392 and runs 745 watts to a colinear antenna up 84 feet. <BT> weather is rainy and cold and my name is laura. <BT> i live in pittsfield, massachusetts where your rst is 469. <BT> my age is 43 and i am a programmer. <BT> how copy? <BT> kz9pjm de kj1iw/7<AR>
VVV <KA> kz9pvz de wq6kqs/6 <BT> i am copying you with difficulty liz. <BT> rig is yaesu zx377 and runs 755 watts to a dipole antenna up 16 feet. <BT> weather is sunny and cold and my name is beth. <BT> i live in fairbanks, alaska where your rst is 469. <BT> my age is 24 and i am a carpenter. <BT> how copy? <BT> kz9pvz de wq6kqs/6 [sk]<AR>
VVV <KA> n2jii de nc1qj nc1qj <BT> fb gud to hear u david <BT> your rst is 558 solid cpy <BT> name hr is jim <BT> rig is ft2000 at 250 watts <BT> the ant is a dipole <BT> location hr is newport, rhode island <BT> wx hr nice <BT> ive been a ham for the last 44 years <BT> i work hr as an acupuncturist <BT> back to you david, 73 es cu agn <BT> n2jii de nc1qj [sk] [kn]<AR>
VVV <KA> n6ixy de w9ou/8 <BT> good copy kate. <BT> rig is yaesu zv710 and runs 475 watts to a inverted v antenna up 67 feet. <BT> weather is overcast and warm and my name is kathryn. <BT> i live in hibbing, minnesota where your rst is 488. <BT> my age is 17 and i am a doctor. <BT> how copy? <BT> n6ixy de w9ou/8<AR>
VVV <KA> n7ljd de au8qy/9 <BT> rrr and thanks thomas. <BT> rig is yaesu sb912 and runs 735 watts to a yagi antenna up 17 feet. <BT> weather is overcast and warm and my name is rebecca. <BT> i live in nashua, new hampshire where your rst is 559. <BT> my age is 28 and i am a professor. <BT> how copy? <BT> n7ljd de au8qy/9<AR>
VVV <KA> n7rh de n7qva n7qva <BT> r and tnx dweezil <BT> name claire <BT> your rst 565 wid qrm <BT> qth is billings, montana <BT> rig here is a yaesu ft990 with 300 watts <BT> my antenna is a long wire <BT> wx here is bad, temp is 22 f <BT> job-wise im a waitsperson <BT> been a ham for 38 years <BT> back to you dweezil <BT> n7rh de n7qva<AR>
VVV <KA> n7uj de nq9h nq9h <BT> gm tipper <BT> your rst is 599 solid cpy <BT> name here is claire <BT> my rig is icom ic756 es using 450 watts <BT> ant hr is beam <BT> my location is chicago, illinois <BT> wx hr bad <BT> job-wise im a prison guard <BT> ive been licenced for 64 years <BT> tnx for qso <BT> n7uj de nq9h [sk] [kn]<AR>
VVV <KA> n8xvp de k1jzz/1 <BT> good to talk to you again grace. <BT> rig is yaesu kx519 and runs 875 watts to a yagi antenna up 21 feet. <BT> weather is rainy and warm and my name is vicky. <BT> i live in utica, new york where your rst is 478. <BT> my age is 75 and i am a contractor. <BT> how copy? <BT> n8xvp de k1jzz/1 [sk]<AR>
VVV <KA> n8ywk de wy6zp/8 <BT> good copy grace. <BT> rig is icom zk297 and runs 730 watts to a vertical antenna up 31 feet. <BT> weather is foggy and my name is kathy. <BT> i live in wichita, kansas where your rst is 469. <BT> my age is 39 and i am a lawyer. <BT> how copy? <BT> n8ywk de wy6zp/8<AR>
VVV <KA> nj5wzw de nx5njj/5 <BT> i am copying you with difficulty julie. <BT> rig is homebrew zk479 and runs 135 watts to a tribander antenna up 38 feet. <BT> weather is rainy and warm and my name is bob. <BT> i live in grants pass, oregon where your rst is 469. <BT> my age is 33 and i am a pilot. <BT> how copy? <BT> nj5wzw de nx5njj/5<AR>
VVV <KA> nk4yt de kq8z/2 <BT> good to talk to you again danny. <BT> rig is yaesu px254 and runs 560 watts to a yagi antenna up 86 feet. <BT> weather is overcast and warm and my name is nick. <BT> i live in fairbanks, alaska where your rst is 599. <BT> my age is 50 and i am a sales manager. <BT> how copy? <BT> nk4yt de kq8z/2<AR>
VVV <KA> nl1kwq de nl4qd/2 <BT> good to talk to you again bobby. <BT> rig is yaesu xv728 and runs 495 watts to a v beam antenna up 47 feet. <BT> weather is overcast and cold and my name is daniel. <BT> i live in nashua, new hampshire where your rst is 558. <BT> my age is 51 and i am a lawyer. <BT> how copy? <BT> nl1kwq de nl4qd/2<AR>
VVV <KA> nq2p de aw7qqg/3 <BT> rrr and thanks john. <BT> rig is heath zk461 and runs 115 watts to a inverted v antenna up 30 feet. <BT> weather is thunderstorm and my name is bob. <BT> i live in wichita, kansas where your rst is 489. <BT> my age is 18 and i am a student. <BT> how copy? <BT> nq2p de aw7qqg/3<AR>
VVV <KA> nu0iw de nq4jyw/0 <BT> i am copying you with difficulty rachel. <BT> rig is icom zk987 and runs 220 watts to a v beam antenna up 102 feet. <BT> weather is foggy and my name is josh. <BT> i live in spokane, washington where your rst is 488. <BT> my age is 61 and i am a contractor. <BT> how copy? <BT> nu0iw de nq4jyw/0<AR>
VVV <KA> nu1xsy de k2xu/7 <BT> solid copy cathy. <BT> rig is icom xp360 and runs 660 watts to a monobander antenna up 67 feet. <BT> weather is overcast and cold and my name is becky. <BT> i live in fayetteville, arkansas where your rst is 578. <BT> my age is 23 and i am a chemist. <BT> how copy? <BT> nu1xsy de k2xu/7<AR>
VVV <KA> nw1ny de w2fcg w2fcg <BT> fb es tnx fer buzz ben <BT> name kim <BT> ur rst is 599 solid cpy <BT> i have an icom ic781 at 500 watts <BT> im using a g5rv <BT> qth hr rochester, new york <BT> wx hr is cold, temp is 29 f <BT> i work as a steel worker <BT> ham since 1933 <BT> hw copy now? <BT> nw1ny de w2fcg [kn]<AR>
VVV <KA> nw2o nw2o de k2hn <BT> fb es tnx fer buzz barry <BT> rst 345 345 with slight qrn <BT> name chris <BT> i live in albany albany, new york <BT> my radio is a knwd ts950s es running 500 watts <BT> the ant is a quad <BT> wx hr cold and windy <BT> got my ticket in 1995 <BT> im a dancer <BT> 73 es tnx fer qso <BT> nw2o de k2hn sk<AR>
VVV <KA> nw6wpy de w5yy/1 <BT> good to talk to you again emma. <BT> rig is yaesu pz413 and runs 730 watts to a zepp antenna up 115 feet. <BT> weather is hot and muggy and my name is bobby. <BT> i live in provo, utah where your rst is 579. <BT> my age is 62 and i am a lawyer. <BT> how copy? <BT> nw6wpy de w5yy/1<AR>
VVV <KA> nx0yzw de wy2xxy/3 <BT> good to talk to you again sam. <BT> rig is kenwood xv953 and runs 220 watts to a colinear antenna up 107 feet. <BT> weather is overcast and cold and my name is nicholas. <BT> i live in davenport, iowa where your rst is 478. <BT> my age is 42 and i am a doctor. <BT> how copy? <BT> nx0yzw de wy2xxy/3 [sk]<AR>
VVV <KA> nx5qkp de kw2zxf/4 <BT> i am copying you with difficulty ed. <BT> rig is icom pj147 and runs 525 watts to a colinear antenna up 26 feet. <BT> weather is hot and dry and my name is rachel. <BT> i live in augusta, georgia where your rst is 569. <BT> my age is 20 and i am a mechanic. <BT> how copy? <BT> nx5qkp de kw2zxf/4 [sk]<AR>
VVV <KA> nx6qsx de w7yr/3 <BT> thanks for coming back vicky. <BT> rig is kenwood pj500 and runs 715 watts to a dipole antenna up 45 feet. <BT> weather is foggy and my name is michael. <BT> i live in aberdeen, south dakota where your rst is 468. <BT> my age is 27 and i am a carpenter. <BT> how copy? <BT> nx6qsx de w7yr/3<AR>
VVV <KA> ny1hdw de ko6zz/9 <BT> good copy cathy. <BT> rig is icom kx790 and runs 820 watts to a colinear antenna up 74 feet. <BT> weather is sunny and cold and my name is kate. <BT> i live in alamogordo, new mexico where your rst is 479. <BT> my age is 40 and i am a pilot. <BT> how copy? <BT> ny1hdw de ko6zz/9 [sk]<AR>
VVV <KA> ny2wu de kx3jcq/5 <BT> i am copying you with difficulty laura. <BT> rig is homebrew px122 and runs 665 watts to a delta loop antenna up 86 feet. <BT> weather is foggy and my name is mike. <BT> i live in huntsville, alabama where your rst is 578. <BT> my age is 27 and i am a programmer. <BT> how copy? <BT> ny2wu de kx3jcq/5<AR>
VVV <KA> ny2zfq de nx2vwx/3 <BT> solid copy jack. <BT> rig is kenwood xv180 and runs 190 watts to a inverted v antenna up 76 feet. <BT> weather is hot and dry and my name is simon. <BT> i live in alamogordo, new mexico where your rst is 558. <BT> my age is 55 and i am a engineer. <BT> how copy? <BT> ny2zfq de nx2vwx/3 [sk]<AR>
VVV <KA> ny3jw de av2yxj/8 <BT> solid copy vickie. <BT> rig is yaesu pj543 and runs 555 watts to a v beam antenna up 79 feet. <BT> weather is foggy and my name is vicky. <BT> i live in grass valley, california where your rst is 478. <BT> my age is 73 and i am a bookkeeper. <BT> how copy? <BT> ny3jw de av2yxj/8<AR>
VVV <KA> ny7vyy de wj1zyg/4 <BT> i am copying you with difficulty john. <BT> rig is icom jx630 and runs 430 watts to a vertical antenna up 34 feet. <BT> weather is rainy and cold and my name is rebecca. <BT> i live in provo, utah where your rst is 589. <BT> my age is 34 and i am a contractor. <BT> how copy? <BT> ny7vyy de wj1zyg/4<AR>
VVV <KA> ny9qxy de kt6wpj/5 <BT> rrr and thanks liz. <BT> rig is icom pj617 and runs 785 watts to a monobander antenna up 105 feet. <BT> weather is snow and cold and my name is robert. <BT> i live in lewiston, maine where your rst is 598. <BT> my age is 66 and i am a student. <BT> how copy? <BT> ny9qxy de kt6wpj/5<AR>
VVV <KA> w0so de w4ob w4ob <BT> thanks hillary <BT> your rst 365 365 with slight qrm <BT> my name is bobbie <BT> the qth is nashville nashville, tennessee <BT> i have a yaesu ft990 es using 350 watts <BT> the ant is an inverted v <BT> wx hr raining, temp is 32 f <BT> i work here as a reporter <BT> first licenced in 1905 <BT> 73, mni tnx fer qso hillary <BT> w0so de w4ob [sk] [kn]<AR>
VVV <KA> w0zu de wh8lz/1 <BT> thanks for coming back alice. <BT> rig is yaesu kx710 and runs 410 watts to a yagi antenna up 15 feet. <BT> weather is rainy and cold and my name is michael. <BT> i live in kirksville, missouri where your rst is 478. <BT> my age is 65 and i am a sales manager. <BT> how copy? <BT> w0zu de wh8lz/1 [sk]<AR>
VVV <KA> w0zu/1 de wh8lz <BT> thanks for coming back alice. <BT> i live in kirksville, missouri where the weather is rainy and cold. <BT> rig is yaesu kx710 running 410 watts and your rst is 478. <BT> name here is michael. <BT> my age is 65 and i am a sales manager. <BT> antenna is yagi up 15 feet. <BT> how copy? <BT> w0zu/1 de wh8lz [sk]<AR>
VVV <KA> w1dq w1dq de kv8bv <BT> ge owen <BT> rst 557 <BT> name is martin <BT> i live in dayton, ohio <BT> my radio is a ts50s with 250 watts <BT> ant is long wire <BT> weather hr is too hot for me <BT> my job is as a surgeon <BT> ive been a ham fer 36 years <BT> back to you <BT> w1dq de kv8bv [kn]<AR>
VVV <KA> w1ju/2 de kz4yz <BT> solid copy beth. <BT> i live in phoenix, arizona where the weather is sunny and warm. <BT> rig is homebrew zy182 running 330 watts and your rst is 579. <BT> name here is grace. <BT> my age is 63 and i am a secretary. <BT> antenna is tribander up 26 feet. <BT> how copy? <BT> w1ju/2 de kz4yz<AR>
VVV <KA> w1sx de k3ppu/5 <BT> i am copying you with difficulty beth. <BT> rig is icom zp746 and runs 840 watts to a colinear antenna up 63 feet. <BT> weather is rainy and cold and my name is johnny. <BT> i live in hibbing, minnesota where your rst is 568. <BT> my age is 49 and i am a lawyer. <BT> how copy? <BT> w1sx de k3ppu/5 [sk]<AR>
VVV <KA> w1sx/5 de k3ppu <BT> i am copying you with difficulty beth. <BT> i live in hibbing, minnesota where the weather is rainy and cold. <BT> rig is icom zp746 running 840 watts and your rst is 568. <BT> name here is johnny. <BT> my age is 49 and i am a lawyer. <BT> antenna is colinear up 63 feet. <BT> how copy? <BT> w1sx/5 de k3ppu [sk]<AR>
VVV <KA> w1zzq/2 de ny2kk <BT> rrr and thanks samuel. <BT> i live in hibbing, minnesota where the weather is sunny and cold. <BT> rig is icom pz168 running 210 watts and your rst is 459. <BT> name here is emma. <BT> my age is 20 and i am a student. <BT> antenna is dipole up 78 feet. <BT> how copy? <BT> w1zzq/2 de ny2kk [sk]<AR>
VVV <KA> w2hz de ku9zx/2 <BT> rrr and thanks jack. <BT> rig is collins pz776 and runs 465 watts to a monobander antenna up 90 feet. <BT> weather is sunny and cold and my name is jim. <BT> i live in newark, new jersey where your rst is 488. <BT> my age is 57 and i am a engineer. <BT> how copy? <BT> w2hz de ku9zx/2 [sk]<AR>
VVV <KA> w4laz/2 de wk7owu <BT> good copy tom. <BT> i live in harlingen, texas where the weather is snow and cold. <BT> rig is drake zv434 running 230 watts and your rst is 459. <BT> name here is bobby. <BT> my age is 25 and i am a architect. <BT> antenna is dipole up 104 feet. <BT> how copy? <BT> w4laz/2 de wk7owu [sk]<AR>
VVV <KA> w4xrm/0 w4xrm/0 w4xrm/0 de kf5cl <BT> fb, tnx for call katrina <BT> ur rst 355 355 wid qsb <BT> name here is david <BT> rig here is a knwd ts50s es running 200 watts <BT> im using a dipole <BT> my location is conway conway, arkansas <BT> here, the weather is very damp, <BT> temp is 22 f <BT> been licenced since 1981 <BT> here im a paralegal <BT> back to you <BT> katrina <BT> w4xrm/0 de kf5cl [kn]<AR>
VVV <KA> w5od w5od de w4lt w4lt <BT> gm liz <BT> name bill <BT> ur rst is 589 solid cpy <BT> my radio is a yaesu ft857 500 watts <BT> ant is 3 el yagi <BT> my qth is owensboro, kentucky <BT> weather hr is very damp, temp is 38 f <BT> im a policeman <BT> been licenced for 46 years <BT> bk es how cpy now? <BT> w5od de w4lt<AR>
VVV <KA> w7gj w7gj de n4tsj <BT> ge richard <BT> the name is david <BT> ur rst is 568 <BT> my rig is ft920 with 250 watts <BT> ant hr is g5rv <BT> qth here is nashville, tennessee <BT> the weather here is pretty good <BT> got my ticket in 1914 <BT> i work hr as a judge <BT> bk to you <BT> w7gj de n4tsj kn<AR>
VVV <KA> w7kz/6 de kq6ypq <BT> i am copying you with difficulty jimmy. <BT> i live in newark, new jersey where the weather is sunny and cold. <BT> rig is icom pz395 running 90 watts and your rst is 469. <BT> name here is michael. <BT> my age is 40 and i am a architect. <BT> antenna is v beam up 105 feet. <BT> how copy? <BT> w7kz/6 de kq6ypq [sk]<AR>
VVV <KA> w7wzq/6 de kz4uuy <BT> rrr and thanks claire. <BT> i live in davenport, iowa where the weather is foggy. <BT> rig is homebrew pz443 running 660 watts and your rst is 569. <BT> name here is catherine. <BT> my age is 36 and i am a engineer. <BT> antenna is log periodic up 91 feet. <BT> how copy? <BT> w7wzq/6 de kz4uuy<AR>
VVV <KA> w8wkn de kr9u/4 kr9u/4 <BT> many tnx fer call kevin <BT> name here is reggie <BT> your rst 346 346 with slight qrn <BT> my rig is k1 running 200 watts <BT> the ant is a 4 el beam <BT> qth hr greenville greenville, south carolina <BT> wx hr rather cold, temp is 55 f <BT> been a ham for 63 years <BT> my job is as a steel worker <BT> over to you <BT> w8wkn de kr9u/4 kn<AR>
VVV <KA> w8xdh w8xdh w8xdh de nt1x <BT> fb es tnx fer buzz gail <BT> your rst 587 solid cpy <BT> name hr is amy <BT> rig here is an icom ic756 450 watts ant hr is 4 el beam <BT> qth is montpelier, vermont <BT> weather hr is rather warm, temp is 71 f <BT> i work here as a police officer <BT> ive been a ham for the last 9 years <BT> 73 es tnx fer qso <BT> w8xdh de nt1x sk<AR>
VVV <KA> w9hci de w7vt w7vt <BT> ge mary <BT> name here is roland <BT> ur rst 447 with qrm <BT> rig is dx70t with 50 watts ant is beam <BT> my location is great falls great falls, montana <BT> hr wx is warm <BT> been into radio for 38 years <BT> i work as a researcher <BT> 73 mary es tnx fer qso <BT> w9hci de w7vt [sk] [kn]<AR>
VVV <KA> w9sgu de no3l no3l <BT> ok es tnx fer call dave <BT> ur rst is 598 solid cpy <BT> the name is michael <BT> qth is baltimore, maryland <BT> my radio is a ft840 with 400 watts <BT> my ant is delta loop <BT> wx hr is hot, temp is 87 f <BT> here im a game warden <BT> ive been a ham for the last 9 years <BT> many tnx qso dave, 73 <BT> w9sgu de no3l [sk] kn<AR>
VVV <KA> wd5qud/2 de a6jkv <BT> thanks for coming back cathy. <BT> i live in bismarck, north dakota where the weather is overcast and cold. <BT> rig is yaesu sb508 running 485 watts and your rst is 469. <BT> name here is joe. <BT> my age is 66 and i am a engineer. <BT> antenna is monobander up 23 feet. <BT> how copy? <BT> wd5qud/2 de a6jkv [sk]<AR>
VVV <KA> wd5z/3 de k4urw <BT> good copy sarah. <BT> i live in dover, deleware where the weather is rainy and warm. <BT> rig is yaesu jz557 running 770 watts and your rst is 458. <BT> name here is pat. <BT> my age is 41 and i am a architect. <BT> antenna is dipole up 59 feet. <BT> how copy? <BT> wd5z/3 de k4urw [sk]<AR>
VVV <KA> wf9xpu/1 de k0zgj <BT> i am copying you with difficulty nicholas. <BT> i live in kalamazoo, michigan where the weather is sunny and warm. <BT> rig is kenwood zp617 running 420 watts and your rst is 559. <BT> name here is nicholas. <BT> my age is 57 and i am a doctor. <BT> antenna is dipole up 67 feet. <BT> how copy? <BT> wf9xpu/1 de k0zgj [sk]<AR>
VVV <KA> wg2u wg2u de ws6u <BT> fb, tnx for call arnie <BT> the name is jane <BT> ur rst is 367 367 with qrm <BT> our qth is modesto modesto, california <BT> rig is ts870s sending out 250 watts <BT> im using an hy gain beam <BT> weather hr is clear and sunny <BT> been licenced for 14 years <BT> here im a cleaner <BT> hw copy now? <BT> wg2u de ws6u kn<AR>
VVV <KA> wg5zb de nq3qvb/4 <BT> i am copying you with difficulty michael. <BT> rig is kenwood zk808 and runs 670 watts to a yagi antenna up 70 feet. <BT> weather is sunny and warm and my name is danny. <BT> i live in lynchburg, virginia where your rst is 499. <BT> my age is 46 and i am a chemist. <BT> how copy? <BT> wg5zb de nq3qvb/4 [sk]<AR>
VVV <KA> wg5zb/4 de nq3qvb <BT> i am copying you with difficulty michael. <BT> i live in lynchburg, virginia where the weather is sunny and warm. <BT> rig is kenwood zk808 running 670 watts and your rst is 499. <BT> name here is danny. <BT> my age is 46 and i am a chemist. <BT> antenna is yagi up 70 feet. <BT> how copy? <BT> wg5zb/4 de nq3qvb [sk]<AR>
VVV <KA> wg6qh de n0kee n0kee <BT> rrr tnx fer call chelsea <BT>name hr is katherine <BT> your rst is 587 <BT> im using ts570s sending out 100 watts my ant is r5 vertical <BT> our qth is williston, north dakota <BT> hr wx is clear, temp is 70 f <BT>job-wise im a welder <BT> been amateur since 1959 <BT> 73 es gud dx <BT> wg6qh de n0kee [sk]<AR>
VVV <KA> wi1efj de kp9dyy/9 <BT> thanks for coming back nicholas. <BT> rig is icom jz277 and runs 295 watts to a monobander antenna up 94 feet. <BT> weather is hot and dry and my name is thom. <BT> i live in newark, new jersey where your rst is 589. <BT> my age is 54 and i am a welder. <BT> how copy? <BT> wi1efj de kp9dyy/9<AR>
VVV <KA> wi1efj/9 de kp9dyy <BT> thanks for coming back nicholas. <BT> i live in newark, new jersey where the weather is hot and dry. <BT> rig is icom jz277 running 295 watts and your rst is 589. <BT> name here is thom. <BT> my age is 54 and i am a welder. <BT> antenna is monobander up 94 feet. <BT> how copy? <BT> wi1efj/9 de kp9dyy<AR>
VVV <KA> wj0kqx/0 de ay9mzj <BT> solid copy kathryn. <BT> i live in utica, new york where the weather is overcast and warm. <BT> rig is yaesu pz439 running 715 watts and your rst is 589. <BT> name here is jimmy. <BT> my age is 66 and i am a secretary. <BT> antenna is log periodic up 38 feet. <BT> how copy? <BT> wj0kqx/0 de ay9mzj<AR>
VVV <KA> wk0pge/4 de n5qzq <BT> good copy danny. <BT> i live in huntsville, alabama where the weather is rainy and cold. <BT> rig is homebrew zk592 running 360 watts and your rst is 568. <BT> name here is rebecca. <BT> my age is 26 and i am a mechanic. <BT> antenna is vertical up 60 feet. <BT> how copy? <BT> wk0pge/4 de n5qzq [sk]<AR>
VVV <KA> wk3ll wk3ll de kr9ov kr9ov <BT> thanks katherine <BT> ur rst is 347 347 with heavy qrn <BT> name is harold <BT> the qth is springfield springfield, illinois <BT> im using an ic746pro at 500 watts <BT> ant hr is g5rv <BT> wx hr too hot for me, temp is 61 f <BT> first licenced in 1932 <BT> my job is as a doctor <BT> 73, mni tnx fer qso katherine <BT> wk3ll de kr9ov [sk] kn<AR>
VVV <KA> wk8uv/5 de ky8wkk <BT> rrr and thanks liza. <BT> i live in spokane, washington where the weather is overcast and warm. <BT> rig is kenwood zp367 running 845 watts and your rst is 469. <BT> name here is anne. <BT> my age is 44 and i am a mechanic. <BT> antenna is tribander up 85 feet. <BT> how copy? <BT> wk8uv/5 de ky8wkk<AR>
VVV <KA> wp6pxy de k7uzx/7 <BT> rrr and thanks alice. <BT> rig is homebrew zp426 and runs 720 watts to a inverted v antenna up 110 feet. <BT> weather is sunny and warm and my name is mickey. <BT> i live in kitty hawk, north carolina where your rst is 478. <BT> my age is 43 and i am a contractor. <BT> how copy? <BT> wp6pxy de k7uzx/7 [sk]<AR>
VVV <KA> wq2vuz de nx3yu/4 <BT> rrr and thanks kathy. <BT> rig is yaesu zx705 and runs 725 watts to a dipole antenna up 20 feet. <BT> weather is foggy and my name is sam. <BT> i live in lynchburg, virginia where your rst is 478. <BT> my age is 30 and i am a professor. <BT> how copy? <BT> wq2vuz de nx3yu/4 [sk]<AR>
VVV <KA> wq4zyu de wb5zwx/1 <BT> good to talk to you again emma. <BT> rig is yaesu pj688 and runs 500 watts to a delta loop antenna up 103 feet. <BT> weather is overcast and cold and my name is laura. <BT> i live in hanna, wyoming where your rst is 469. <BT> my age is 17 and i am a teacher. <BT> how copy? <BT> wq4zyu de wb5zwx/1 [sk]<AR>
VVV <KA> wq5rgq de nu5kpy/1 <BT> rrr and thanks bob. <BT> rig is yaesu xv669 and runs 880 watts to a log periodic antenna up 91 feet. <BT> weather is foggy and my name is michael. <BT> i live in kitty hawk, north carolina where your rst is 479. <BT> my age is 55 and i am a programmer. <BT> how copy? <BT> wq5rgq de nu5kpy/1<AR>
VVV <KA> wq8ga wq8ga de ai9i <BT> fb es tnx fer buzz travis <BT> name here is dan <BT> rst 457 much qrm <BT> my rig is ft840 putting out 50 watts <BT> ant is long wire <BT> my location is milwaukee, wisconsin <BT> the weather here is hot and humid, temp is 82 f <BT> job-wise im an internet marketer <BT> been licenced for 58 years <BT> back to you travis <BT> wq8ga de ai9i kn<AR>
VVV <KA> wq9zbu de k2yud/8 <BT> rrr and thanks ed. i live in hagerstown, maryland where your rst is 598. weather is sunny and warm and my name is henry. <BT> my age is 26 and i am a chemist. <BT> rig is heathkit xv643 and runs 775 watts to a delta loop antenna up 67 feet. how copy? <BT> wq9zbu de k2yud/8 [sk]<AR>
VVV <KA> wu0sv de wm2ccj/9 <BT> rrr and thanks alice. i live in alliance, nebraska where your rst is 488. weather is sunny and cold and my name is henry. <BT> my age is 47 and i am a welder. <BT> rig is kenwood px594 and runs 500 watts to a dipole antenna up 81 feet. how copy? <BT> wu0sv de wm2ccj/9 [sk]<AR>
VVV <KA> wu1rxp de ny8qzu/4 <BT> solid copy hank. i live in hibbing, minnesota where your rst is 468. weather is rainy and warm and my name is james. <BT> my age is 59 and i am a engineer. <BT> rig is heath xp993 and runs 480 watts to a colinear antenna up 40 feet. how copy? <BT> wu1rxp de ny8qzu/4<AR>
VVV <KA> ww0ppk de wa0dm/6 <BT> solid copy grace. <BT> rig is kenwood pz464 and runs 420 watts to a delta loop antenna up 14 feet. <BT> weather is overcast and warm and my name is vicky. <BT> i live in spokane, washington where your rst is 579. <BT> my age is 36 and i am a lawyer. <BT> how copy? <BT> ww0ppk de wa0dm/6<AR>
VVV <KA> ww5nq de ab9bxq/9 <BT> i am copying you with difficulty liz. <BT> rig is yaesu jz851 and runs 820 watts to a log periodic antenna up 58 feet. <BT> weather is thunderstorm and my name is bobby. <BT> i live in davenport, iowa where your rst is 598. <BT> my age is 36 and i am a sales manager. <BT> how copy? <BT> ww5nq de ab9bxq/9<AR>
VVV <KA> ww5uj de w4vpz/3 <BT> i am copying you with difficulty laura. <BT> rig is icom zv640 and runs 425 watts to a yagi antenna up 56 feet. <BT> weather is overcast and cold and my name is vickie. <BT> i live in rutland, vermont where your rst is 458. <BT> my age is 49 and i am a carpenter. <BT> how copy? <BT> ww5uj de w4vpz/3<AR>
VVV <KA> wx1yj de wh4sx/8 <BT> good copy mickey. <BT> rig is heathkit zk673 and runs 100 watts to a dipole antenna up 11 feet. <BT> weather is sunny and cold and my name is thom. <BT> i live in augusta, georgia where your rst is 458. <BT> my age is 44 and i am a carpenter. <BT> how copy? <BT> wx1yj de wh4sx/8 [sk]<AR>
VVV <KA> wx2ovz de aq7zw/2 <BT> good to talk to you again thom. i live in bozeman, montana where your rst is 559. weather is thunderstorm and my name is joe. <BT> my age is 28 and i am a sales manager. <BT> rig is drake zv625 and runs 690 watts to a log periodic antenna up 10 feet. how copy? <BT> wx2ovz de aq7zw/2 [sk]<AR>
VVV <KA> wx3euy de wz9vex/2 <BT> good copy jane. <BT> rig is heath pj171 and runs 360 watts to a inverted v antenna up 106 feet. <BT> weather is rainy and warm and my name is jane. <BT> i live in alamogordo, new mexico where your rst is 579. <BT> my age is 62 and i am a student. <BT> how copy? <BT> wx3euy de wz9vex/2<AR>
VVV <KA> wx3s de wv3wi wv3wi <BT> r r r ok nice to meet u rachel <BT> your rst 569 solid cpy <BT> name hr is tara <BT> im using an icom ic781 sending out 500 watts <BT> ant is yagi <BT> my qth is uniontown, pennsylvania <BT> here, the weather is pretty good, temp is 75 f <BT> i work as a cartographer <BT> been licenced for 5 years <BT> i have to shut down now rachel, 73 es gud dx <BT> wx3s de wv3wi [sk]<AR>
VVV <KA> wy0zq de wv3xzs/1 <BT> thanks for coming back claire. <BT> rig is kenwood sb725 and runs 140 watts to a dipole antenna up 15 feet. <BT> weather is foggy and my name is daniel. <BT> i live in hanna, wyoming where your rst is 478. <BT> my age is 72 and i am a mechanic. <BT> how copy? <BT> wy0zq de wv3xzs/1<AR>
VVV <KA> wy7yv de wq3wxy/0 <BT> good to talk to you again matthew. i live in charleston, south carolina where your rst is 478. weather is sunny and cold and my name is william. <BT> my age is 32 and i am a engineer. <BT> rig is kenwood zv739 and runs 375 watts to a colinear antenna up 51 feet. how copy? <BT> wy7yv de wq3wxy/0<AR>
VVV <KA> wz4pvz de w3qzu/7 <BT> good copy bill. <BT> rig is yaesu px492 and runs 900 watts to a monobander antenna up 41 feet. <BT> weather is overcast and warm and my name is julie. <BT> i live in winnemucca, nevada where your rst is 558. <BT> my age is 39 and i am a sales manager. <BT> how copy? <BT> wz4pvz de w3qzu/7<AR>
VVV <KA> wz9uzj de wg9zp/3 <BT> solid copy becky. i live in nashua, new hampshire where your rst is 558. weather is sunny and cold and my name is beth. <BT> my age is 68 and i am a architect. <BT> rig is kenwood xv242 and runs 160 watts to a inverted v antenna up 49 feet. how copy? <BT> wz9uzj de wg9zp/3`
},
{
    title: 'Bremer Stadtmusikanten (DE)',
    content: 
`\\cDie Bremer Stadtmusikanten
Bremer Stadtmusikanten
Autor: Gebrüder Grimm
Es war einmal ein Mann, der hatte einen Esel. Dieser hatte schon lange Jahre unverdrossen die Säcke in die Mühle getragen. Nun aber verließen den Esel die Kräfte, so dass er nicht mehr zur Arbeit taugte. Da dachte sein Herr daran, ihn wegzugehen. Aber der Esel merkte, dass sein Herr nichts Gutes im Sinn hatte und lief fort. Er machte sich auf den Weg nach Bremen, denn dort, so dachte er, könnte er ja ein Bremer Stadtmusikant werden.

Auf nach Bremen!
Als er schon eine Weile gegangen war, sah er einen Jagdhund am Wegesrand liegen, der jämmerlich jammerte.

"Warum jammerst du denn so, Packan?"
fragte der Esel.

"Ach",
sagte der Hund,

"ich bin alt und werde jeden Tag schwächer. Ich kann auch nicht mehr auf die Jagd und mein Herr will mich daher totschießen. Da bin ich davongelaufen. Aber womit soll ich nun mein Brot verdienen?"
"Weißt du, was",
sprach der Esel,

"ich gehe nach Bremen und werde dort ein Stadtmusikant. Komm mit mir und musiziere mit mir. Ich spiele die Laute, und du schlägst die Pauke."
Der Hund war einverstanden, und sie gingen zusammen weiter.

Es dauerte nicht lange, da sahen sie eine Katze am Wege sitzen, die machte ein Gesicht wie sieben Tage Regenwetter.

"Was ist denn dir in die Quere gekommen, alter Bartputzer?"
fragte der Esel.

"Wer kann da lustig sein, wenn es einem an den Kragen geht",
antwortete die Katze.

"Ich bin nun alt und weil meine Zähne stumpf werden und ich lieber hinter dem Ofen sitze und spinne, als nach Mäusen zu jagen, hat mich meine Frau ertränken wollen. Ich konnte mich zwar noch davonschleichen, aber nun ist guter Rat teuer. Was soll ich nun tun?"
"Geh mit uns nach Bremen! Du verstehst dich doch auf die Nachtmusik. Wir wollen zusammen Bremer Stadtmusikanten werden."
Die Katze hielt das für gut und ging mit ihnen fort.

Als die drei so miteinander gingen, kamen sie an einem Hof vorbei. Dotr saß der Haushahn auf dem Tor und krähte aus Leibeskräften.

"Dein Schreien geht einem ja durch Mark und Bein",
sprach der Esel,

"was ist mir dir?"
"Die Hausfrau hat der Köchin befohlen, mir heute abend den Kopf abzusschlagen. Morgen, am Sonntag, haben sie Gäste und da wollen sie mich in der Suppe essen. Nun schrei ich aus vollem Hals, solang ich noch kann."
"Ei was",
sagte der Esel,

"zieh lieber mit uns fort! Wir gehen nach Bremen, etwas Besseres als den Tod findest du dort in jedem Fall. Du hast eine gute Stimme, und wenn wir zusammen musizieren, wird es sicherlich herrlich klingen."
Dem Hahn gefiel der Vorschlag, und sie gingen alle vier mitsammen fort.

Die Bremer Stadtmusikanten
Aber die Stadt Bremen war weit und so kamen sie abends in einen Wald, wo sie übernachten wollten. Der Esel und der Hund legten sich unter einen großen Baum, die Katze kletterte auf einen Ast, und der Hahn flog bis in den Wipfel, wo es am sichersten für ihn war.

Bevor er einschlief, sah er sich noch einmal in alle Himmelsrichtungen um. Da bemerkte er einen Lichtschein in der Ferne. Er sagte seinen Gefährten, dass da wohl ein Haus sei, denn er sehe ein Licht. Der Esel antwortete:

"Dann wollen wir uns aufmachen und dort hingehen, denn hier ist die Herberge schlecht."
Und auch der Hund meinte, ein paar Knochen und mit etwas Fleisch täten ihm auch gut.

Das Räuberhaus
Also machten sie sich auf den Weg zu dem Flecken, wo das Licht war. Bald sahen sie es heller schimmern, und es wurde immer größer, bis sie vor ein hellerleuchtetes Räuberhaus kamen. Der Esel, als der größte, ging ans Fenster und schaute hinein.

"Was siehst du, Grauschimmel?"
fragte der Hahn.

"Was ich sehe?"
antwortete der Esel.

"Einen gedeckten Tisch mit schönem Essen und Trinken. Räuber sitzen rundherum und lassen sich es gutgehen!"
"Das wäre etwas für uns",
sprach der Hahn.

Da überlegten die Tiere, wie sie es anfangen könnten, die Räuber hinauszujagen. Endlich fanden sie einen Weg. Der Esel stellte sich mit den Vorderfüßen auf das Fenster, der Hund sprang auf seinen Rücken, die Katze kletterte auf den Hund, und zuletzt flog der Hahn hinauf und setzte sich auf den Kopf der. Als das geschehen war, fingen sie auf ein Zeichen an, ihre Musik zu machen: der Esel schrie, der Hund bellte, die Katze miaute und der Hahn krähte. Darauf stürzten sie durch das Fenster in die Stube hinein, dass die Scheiben klirrten.

Die Räuber fuhren bei dem entsetzlichen Lärm in die Höhe. Sie meinten, ein Gespenst käme herein und flohen voller Furcht in den Wald hinaus.

Nun setzten sich die vier Gesellen an den Tisch, und jeder aß nach Herzenslust.

Als sie fertig waren, löschten sie das Licht aus, und jeder suchte sich einen Schlafplatz nach seinem Geschmack. Der Esel legte sich auf den Mist, der Hund hinter die Tür, die Katze auf den Herd bei der warmen Asche, und der Hahn flog auf das Dach hinauf. Und weil sie müde waren von ihrem langen Weg, schliefen sie bald ein.

In der Nacht
Als Mitternacht vorbei war und die Räuber von weitem sahen, dass kein Licht mehr im Haus brannte und alles ruhig schien, sprach der Hauptmann:

"Wir hätten uns doch nicht ins Bockshorn jagen lassen sollen!"
und schickte einen Räuber zurück, um zu sehen, ob noch jemand im Hause wäre.

Der Räuber fand alles still. Er ging in die Küche und wollte ein Licht anzünden. Da sah er die feurigen Augen der Katze und meinte, es wären glühende Kohlen. Er hielt ein Streichholz dran, um sie zu entzünden.

Aber die Katze verstand keinen Spaß, sprang ihm ins Gesicht und kratzte ihn aus Leibeskräften. Da erschrak er gewaltig und wollte zur Hintertür hinauslaufen, doch der Hund, der da lag, sprang auf und biß ihn ins Bein. Als der Räuber über den Hof am Misthaufen vorbeirannte, gab ihm der Esel noch einen tüchtigen Tritt mit den Hufen. Der Hahn aber, der von dem Lärm aus dem Schlaf geweckt worden war, rief vom Dache herunter:

"Kikeriki!"
Da lief der Räuber, so schnell er konnte, zu seinem Hauptmann zurück und sprach:

"In dem Haus sitzt eine greuliche Hexe, die hat mich angehaucht und mir mit ihren langen Fingern das Gesicht zerkratzt. An der Tür steht ein Mann mit einem Messer, der hat mich ins Bein gestochen. Auf dem Hof aber liegt ein schwarzes Ungetüm, das hat mit einem Holzprügel auf mich eingeschlagen und oben auf dem Dache, da sitzt der Richter und rief: -Bringt mir den Schelm her!- Da machte ich, dass ich fortkam."
Von nun an getrauten sich die Räuber nicht mehr in das Haus. Den vier Bremer Stadtmusikanten aber gefiels darin so gut, dass sie nicht wieder hinaus wollten.
`
},
{
    title: 'Krambambuli (DE)',
    content: 
`\\cKrambambuli
Marie von Ebner-Eschenbach

Krambambuli

Vorliebe empfindet der Mensch für allerlei Dinge und Wesen. Liebe, die echte, unvergängliche, die lernt er – wenn überhaupt – nur einmal kennen. So wenigstens meint der Herr Revierjäger Hopp. Wie viele Hunde hat er schon gehabt, und auch gern gehabt; aber lieb, was man sagt lieb und unvergeßlich, ist ihm nur einer gewesen – der Krambambuli. Er hatte ihn im Wirtshause zum Löwen in Wischau von einem vazierenden Forstgehilfen gekauft oder eigentlich eingetauscht. Gleich beim ersten Anblick des Hundes war er von der Zuneigung ergriffen worden, die dauern sollte bis zu seinem letzten Atemzuge. Dem Herrn des schönen Tieres, der am Tische vor einem geleerten Branntweingläschen saß und über den Wirt schimpfte, weil dieser kein zweites umsonst hergeben wollte, sah der Lump aus den Augen. Ein kleiner Kerl, noch jung und doch so fahl wie ein abgestorbener Baum, mit gelbem Haar und spärlichem gelbem Barte. Der Jägerrock, vermutlich ein Überrest aus der vergangenen Herrlichkeit des letzten Dienstes, trug die Spuren einer im nassen Straßengraben zugebrachten Nacht. Obwohl sich Hopp ungern in schlechte Gesellschaft begab, nahm er trotzdem Platz neben dem Burschen und begann sogleich ein Gespräch mit ihm. Da bekam er es denn bald heraus, daß der Nichtsnutz den Stutzen und die Jagdtasche dem Wirt bereits als Pfänder ausgeliefert hatte und daß er jetzt auch den Hund als solches hergeben möchte; der Wirt jedoch, der schmutzige Leuteschinder, wollte von einem Pfand, das gefüttert werden muß, nichts hören.
Herr Hopp sagte vorerst kein Wort von dem Wohlgefallen, das er an dem Hunde gefunden hatte, ließ aber eine Flasche von dem guten Danziger Kirschbranntwein bringen, den der Löwenwirt damals führte, und schenkte dem Vazierenden fleißig ein. – Nun, in einer Stunde war alles in Ordnung. Der Jäger gab zwölf Flaschen von demselben Getränke, bei dem der Handel geschlossen worden – der Vagabund gab den Hund. Zu seiner Ehre muß man gestehen: nicht leicht. Die Hände zitterten ihm so sehr, als er dem Tiere die Leine um den Hals legte, daß es schien, er werde mit dieser Manipulation nimmermehr zurechtkommen. Hopp wartete geduldig und bewunderte im stillen den trotz der schlechten Kondition, in der er sich befand, wundervollen Hund. Höchstens zwei Jahre mochte er alt sein, und in der Farbe glich er dem Lumpen, der ihn hergab; doch war die seine um ein paar Schattierungen dunkler. Auf der Stirn hatte er ein Abzeichen, einen weißen Strich, der rechts und links in kleine Linien auslief, in der Art wie die Nadeln an einem Tannenreis. Die Augen waren groß, schwarz, leuchtend, von tauklaren, lichtgelben Reiflein umsäumt, die Ohren hoch angesetzt, lang, makellos. Und makellos war alles an dem ganzen Hunde von der Klaue bis zu der feinen Witternase: die kräftige, geschmeidige Gestalt, das über jedes Lob erhabene Piedestal. Vier lebende Säulen, die auch den Körper eines Hirsches getragen hätten und nicht viel dicker waren als die Läufe eines Hasen. Beim heiligen Hubertus! dieses Geschöpf mußte einen Stammbaum haben, so alt und rein wie der eines deutschen Ordensritters.
Dem Jäger lachte das Herz im Leibe über den prächtigen Handel, den er gemacht hatte. Er stand nun auf, ergriff die Leine, die zu verknoten dem Vazierenden endlich gelungen war, und fragte: Wie heißt er denn? – Er heißt wie das, wofür Ihr ihn kriegt: Krambambuli, lautete die Antwort. – Gut, gut, Krambambuli! So komm! Wirst gehen? Vorwärts! – Ja, er konnte lang rufen, pfeifen, zerren – der Hund gehorchte ihm nicht, wandte den Kopf dem zu, den er noch für seinen Herrn hielt, heulte, als dieser ihm zuschrie: Marsch! und den Befehl mit einem tüchtigen Fußtritt begleitete, suchte aber sich immer wieder an ihn heran zu drängen. Erst nach einem heißen Kampfe gelang es Herrn Hopp, die Besitzergreifung des Hundes zu vollziehen. Gebunden und geknebelt, mußte er zuletzt in einem Sacke auf die Schulter geladen und so bis in das mehrere Wegstunden entfernte Jägerhaus getragen werden.
Zwei volle Monate brauchte es, bevor Krambambuli, halb totgeprügelt, nach jedem Fluchtversuche mit dem Stachelhalsband an die Kette gelegt, endlich begriff, wohin er jetzt gehöre. Dann aber, als seine Unterwerfung vollständig geworden war, was für ein Hund wurde er da! Keine Zunge schildert, kein Wort ermißt die Höhe der Vollendung, die er erreichte, nicht nur in der Ausübung seines Berufes, sondern auch im täglichen Leben als eifriger Diener, guter Kamerad und treuer Freund und Hüter. Dem fehlt nur die Sprache, heißt es von andern intelligenten Hunden – dem Krambambuli fehlte sie nicht; sein Herr zum mindesten pflog lange Unterredungen mit ihm. Die Frau des Revierjägers wurde ordentlich eifersüchtig auf den Buli, wie sie ihn geringschätzig nannte. Manchmal machte sie ihrem Manne Vorwürfe. Sie hatte den ganzen Tag, in jeder Stunde, in der sie nicht aufräumte, wusch oder kochte, schweigend gestrickt. Am Abend, nach dem Essen, wenn sie wieder zu stricken begann, hätte sie gern eins dazu geplaudert.
Weißt denn immer nur dem Buli was zu erzählen, Hopp, und mir nie? Du verlernst vor lauter Sprechen mit dem Vieh das Sprechen mit den Menschen.
Der Revierjäger gestand sich, daß etwas Wahres an der Sache sei; aber zu helfen wußte er nicht. Wovon hätte er mit seiner Alten reden sollen? Kinder hatten sie nie gehabt, eine Kuh durften sie nicht halten, und das zahme Geflügel interessiert einen Jäger im lebendigen Zustande gar nicht und im gebratenen nicht sehr. Für Kulturen aber und für Jagdgeschichten hatte wieder die Frau keinen Sinn. Hopp fand zuletzt einen Ausweg aus diesem Dilemma; statt mit dem Krambambuli sprach er von dem Krambambuli, von den Triumphen, die er allenthalben mit ihm feierte, von dem Neide, den sein Besitz erregte, von den lächerlich hohen Summen, die ihm für den Hund geboten wurden und die er verächtlich von der Hand wies.
Zwei Jahre waren vergangen, da erschien eines Tages die Gräfin, die Frau seines Brotherrn, im Hause des Jägers. Er wußte gleich, was der Besuch zu bedeuten hatte, und als die gute, schöne Dame begann: Morgen, lieber Hopp, ist der Geburtstag des Grafen..., setzte er ruhig und schmunzelnd fort: Und da möchten hochgräfliche Gnaden dem Herrn Grafen ein Geschenk machen und sind überzeugt, mit nichts anderm soviel Ehre einlegen zu können wie mit dem Krambambuli. – Ja, ja, lieber Hopp. Die Gräfin errötete vor Vergnügen über dieses freundliche Entgegenkommen und sprach gleich von Dankbarkeit und bat, den Preis nur zu nennen, der für den Hund zu entrichten wäre. Der alte Fuchs von einem Revierjäger kicherte, tat sehr demütig und rückte auf einmal mit der Erklärung heraus. Hochgräfliche Gnaden! Wenn der Hund im Schlosse bleibt, nicht jede Leine zerbeißt, nicht jede Kette zerreißt, oder wenn er sie nicht zerreißen kann, sich bei den Versuchen, es zu tun, erwürgt, dann behalten ihn hochgräfliche Gnaden umsonst – dann ist er mir nichts mehr wert.
Die Probe wurde gemacht, aber zum Erwürgen kam es nicht; denn der Graf verlor früher die Freude an dem eigensinnigen Tiere. Vergeblich hatte man es durch Liebe zu gewinnen, mit Strenge zu bändigen gesucht. Er biß jeden, der sich ihm näherte, versagte das Futter und – viel hat der Hund eines Jägers ohnehin nicht zuzusetzen – kam ganz herunter. Nach einigen Wochen erhielt Hopp die Botschaft, er könne sich seinen Köter abholen. Als er eilends von der Erlaubnis Gebrauch machte und den Hund in seinem Zwinger aufsuchte, da gab's ein Wiedersehen unermeßlichen Jubels voll. Krambambuli erhob ein wahnsinniges Geheul, sprang an seinem Herrn empor, stemmte die Vorderpfoten auf dessen Brust und leckte die Freudentränen ab, die dem Alten über die Wangen liefen.
Am Abend dieses glücklichen Tages wanderten sie zusammen ins Wirtshaus. Der Jäger spielte Tarok mit dem Doktor und mit dem Verwalter, Krambambuli lag in der Ecke hinter seinem Herrn. Manchmal sah dieser sich nach ihm um, und der Hund, so tief er auch zu schlafen schien, begann augenblicklich mit dem Schwanze auf den Boden zu klopfen, als wollt er melden: Präsent! Und wenn Hopp, sich vergessend, recht wie einen Triumphgesang das Liedchen anstimmte: Was macht denn mein Krambambuli?, richtete der Hund sich würde- und respektvoll auf, und seine hellen Augen antworteten:
Es geht ihm gut!
Um dieselbe Zeit trieb, nicht nur in den gräflichen Forsten, sondern in der ganzen Umgebung, eine Bande Wildschützen auf wahrhaft tolldreiste Art ihr Wesen. Der Anführer sollte ein verlottertes Subjekt sein. Den Gelben nannten ihn die Holzknechte, die ihn in irgendeiner übelberüchtigten Spelunke beim Branntwein trafen, die Heger, die ihm hie und da schon auf der Spur gewesen waren, ihm aber nie hatten beikommen können, und endlich die Kundschafter, deren er unter dem schlechten Gesindel in jedem Dorfe mehrere besaß.
Er war wohl der frechste Gesell, der jemals ehrlichen Jägersmännern etwas aufzulösen gab, mußte auch selbst vom Handwerk gewesen sein, sonst hätte er das Wild nicht mit solcher Sicherheit aufspüren und nicht so geschickt jeder Falle, die ihm gestellt wurde, ausweichen können.
Die Wild- und Waldschäden erreichten eine unerhörte Höhe, das Forstpersonal befand sich in grimmigster Aufregung. Da begab es sich nur zu oft, daß die kleinen Leute, die bei irgendeinem unbedeutenden Waldfrevel ertappt wurden, eine härtere Behandlung erlitten, als zu andrer Zeit geschehen wäre und als gerade zu rechtfertigen war. Große Erbitterung herrschte darüber in allen Ortschaften. Dem Oberförster, gegen den der Haß sich zunächst wandte, kamen gutgemeinte Warnungen in Menge zu. Die Raubschützen, hieß es, hätten einen Eid darauf geschworen, bei der ersten Gelegenheit exemplarische Rache an ihm zu nehmen. Er, ein rascher, kühner Mann, schlug das Gerede in den Wind und sorgte mehr denn je dafür, daß weit und breit kund werde, wie er seinen Untergebenen die rücksichtsloseste Strenge anbefohlen und für etwaige schlimme Folgen die Verantwortung selbst übernommen habe. Am häufigsten rief der Oberförster dem Revierjäger Hopp die scharfe Handhabung seiner Amtspflicht ins Gedächtnis und warf ihm zuweilen Mangel an Schneid vor, wozu freilich der Alte nur lächelte. Der Krambambuli aber, den er bei solcher Gelegenheit von oben herunter anblinzelte, gähnte laut und wegwerfend. Übel nahmen er und sein Herr dem Oberförster nichts. Der Oberförster war ja der Sohn des Unvergeßlichen, bei dem Hopp das edle Weidwerk erlernt, und Hopp hatte wieder ihn als kleinen Jungen in die Rudimente des Berufs eingeweiht. Die Plage, die er einst mit ihm gehabt, hielt er heute noch für eine Freude, war stolz auf den ehemaligen Zögling und liebte ihn trotz der rauhen Behandlung, die er so gut wie jeder andre von ihm erfuhr.
Eines Junimorgens traf er ihn eben wieder bei einer Exekution.
Es war im Lindenrondell, am Ende des herrschaftlichen Parks, der an den Grafenwald grenzte, und in der Nähe der Kulturen, die der Oberförster am liebsten mit Pulverminen umgeben hätte. Die Linden standen just in schönster Blüte, und über diese hatte ein Dutzend kleiner Jungen sich hergemacht. Wie Eichkätzchen krochen sie auf den Ästen der herrlichen Bäume herum, brachen alle Zweige, die sie erwischen konnten, ab und warfen sie zur Erde. Zwei Weiber lasen die Zweige hastig auf und stopften sie in Körbe, die schon mehr als zur Hälfte mit dem duftenden Raub gefüllt waren. Der Oberförster raste in unermeßlicher Wut. Er ließ durch seine Heger die Buben nur so von den Bäumen schütteln, unbekümmert um die Höhe, aus der sie fielen. Während sie wimmernd und schreiend um seine Füße krochen, der eine mit zerschundenem Gesicht, der andere mit ausgerenktem Arm, ein dritter mit gebrochenem Bein, zerbläute er eigenhändig die beiden Weiber. In einer von ihnen erkannte Hopp die leichtfertige Dirne, die das Gerücht als die Geliebte des Gelben bezeichnete. Und als die Körbe und Tücher der Weiber und die Hüte der Buben in Pfand genommen wurden und Hopp den Auftrag bekam, sie aufs Gericht zu bringen, konnte er sich eines schlimmen Vorgefühls nicht erwehren.
Der Befehl, den ihm damals der Oberförster zurief, wild wie ein Teufel in der Hölle und wie ein solcher umringt von jammernden und gepeinigten Sündern, ist der letzte gewesen, den der Revierjäger im Leben von ihm erhalten hat. Eine Woche später traf er ihn wieder im Lindenrondell – tot. Aus dem Zustande, in dem die Leiche sich befand, war zu ersehen, daß sie hierher, und zwar durch Sumpf und Gerölle, geschleppt worden war, um an dieser Stelle aufgebahrt zu werden. Der Oberförster lag auf abgehauenen Zweigen, die Stirn mit einem dichten Kranz aus Lindenblüten umflochten, einen ebensolchen als Bandelier um die Brust gewunden. Sein Hut stand neben ihm, mit Lindenblüten gefüllt. Auch die Jagdtasche hatte der Mörder ihm gelassen, nur die Patronen herausgenommen und statt ihrer Lindenblüten hineingesteckt. Der schöne Hinterlader des Oberförsters fehlte und war durch einen elenden Schießprügel ersetzt. Als man später die Kugel, die seinen Tod verursacht hatte, in der Brust des Ermordeten fand, zeigte es sich, daß sie genau in den Lauf dieses Schießprügels paßte, der dem Förster gleichsam zum Hohne über die Schulter gelegt worden war. Hopp stand beim Anblick der entstellten Leiche regungslos vor Entsetzen. Er hätte keinen Finger heben können, und auch das Gehirn war ihm wie gelähmt; er starrte nur und starrte und dachte anfangs gar nichts, und erst nach einer Weile brachte er es zu einer Beobachtung, einer stummen Frage: – Was hat denn der Hund?
Krambambuli beschnüffelt den toten Mann, läuft wie nicht gescheit um ihn herum, die Nase immer am Boden. Einmal winselt er, einmal stößt er einen schrillen Freudenschrei aus, macht ein paar Sätze, bellt, und es ist gerade so, als erwache in ihm eine längst erstorbene Erinnerung...
Herein, ruft Hopp, da herein! Und Krambambuli gehorcht, sieht aber seinen Herrn in allerhöchster Aufregung an und – wie der Jäger sich auszudrücken pflegte – sagt ihm: Ich bitte dich um alles in der Welt, siehst du denn nichts? Riechst du denn nichts?... O lieber Herr, schau doch! riech doch! O Herr, komm! Daher komm!... Und tupft mit der Schnauze an des Jägers Knie und schleicht, sich oft umsehend, als frage er: Folgst du mir?, zu der Leiche zurück und fängt an, das schwere Gewehr zu heben und zu schieben und ins Maul zu fassen, in der offenbaren Absicht, es zu apportieren.
Dem Jäger läuft ein Schauer über den Rücken, und allerlei Vermutungen dämmern in ihm auf. Weil das Spintisieren aber nicht seine Sache ist, es ihm auch nicht zukommt, der Obrigkeit Lichter aufzustecken, sondern vielmehr den gräßlichen Fund, den er getan hat, unberührt zu lassen und seiner Wege – das heißt in dem Fall recte zu Gericht – zu gehen, so tut er denn einfach, was ihm zukommt.
Nachdem es geschehen und alle Förmlichkeiten, die das Gesetz bei solchen Katastrophen vorschreibt, erfüllt, der ganze Tag und auch ein Stück der Nacht darüber hingegangen sind, nimmt Hopp, ehe er schlafen geht, noch seinen Hund vor.
Mein Hund, spricht er, jetzt ist die Gendarmerie auf den Beinen, jetzt gibt's Streifereien ohne Ende. Wollen wir es andern überlassen, den Schuft, der unsern Oberförster erschossen hat, wegzuputzen aus der Welt? – Mein Hund kennt den niederträchtigen Strolch, kennt ihn, ja, ja! Aber das braucht niemand zu wissen, das habe ich nicht ausgesagt... Ich, hoho!... Ich werd meinen Hund hineinbringen in die Geschichte... Das könnt mir einfallen! Er beugte sich über Krambambuli, der zwischen seinen ausgespreizten Knien saß, drückte die Wange an den Kopf des Tieres und nahm seine dankbaren Liebkosungen in Empfang. Dabei summte er: Was macht denn mein Krambambuli?, bis der Schlaf ihn übermannte.
Seelenkundige haben den geheinmisvollen Drang zu erklären gesucht, der manchen Verbrecher stets wieder an den Schauplatz seiner Untat zurückjagt. Hopp wußte von diesen gelehrten Ausführungen nichts, strich aber dennoch ruh- und rastlos mit seinem Hunde in der Nähe des Lindenrondells herum.
Am zehnten Tage nach dem Tode des Oberförsters hatte er zum erstenmal ein paar Stunden lang an etwas andres gedacht als an seine Rache und sich im Grafenwald mit dem Bezeichnen der Bäume beschäftigt, die beim nächsten Schlag ausgenommen werden sollten.
Wie er nun mit seiner Arbeit fertig ist, hängt er die Flinte wieder um und schlägt den kürzesten Weg ein, quer durch den Wald gegen die Kulturen in der Nähe des Lindenrondells. Im Augenblick, in dem er auf den Fußsteig treten will, der längs des Buchenzaunes läuft, ist ihm, als höre er etwas im Laube rascheln. Gleich darauf herrscht jedoch tiefe Stille, tiefe, anhaltende Stille. Fast hätte er gemeint, es sei nichts Bemerkenswertes gewesen, wenn nicht der Hund so merkwürdig dreingeschaut hätte. Der stand mit gesträubtem Haar, den Hals vorgestreckt, den Schwanz aufrecht, und glotzte eine Stelle des Zaunes an. Oho! dachte Hopp, wart, Kerl, wenn du's bist! Trat hinter einen Baum und spannte den Hahn seiner Flinte. Wie rasend pochte ihm das Herz, und der ohnehin kurze Atem wollte ihm völlig versagen, als jetzt plötzlich – Gottes Wunder! – durch den Zaun der Gelbe auf den Fußsteig trat. Zwei junge Hasen hingen an seiner Weidtasche, und auf seiner Schulter, am wohlbekannten Juchtenriemen, der Hinterlader des Oberförsters. Nun wär's eine Passion gewesen, den Racker niederzubrennen aus sicherem Hinterhalt.
Aber nicht einmal auf den schlechtesten Kerl schießt der Jäger Hopp, ohne ihn angerufen zu haben. Mit einem Satze springt er hinter dem Baum hervor und auf den Fußsteig und schreit: Gib dich, Vermaledeiter! Und als der Wildschütz zur Antwort den Hinterlader von der Schulter reißt, gibt der Jäger Feuer... All ihr Heiligen – ein sauberes Feuer! Die Flinte knackst, anstatt zu knallen. Sie hat zu lang mit aufgesetzter Kapsel im feuchten Wald am Baum gelehnt – sie versagt.
Gute Nacht, so sieht das Sterben aus, denkt der Alte. Doch nein – er ist heil, sein Hut nur fliegt, von Schroten durchlöchert, ins Gras.
Der andre hat auch kein Glück; das war der letzte Schuß in seinem Gewehr, und zum nächsten zieht er eben erst die Patrone aus der Tasche...
Pack an! ruft Hopp seinem Hunde heiser zu: Pack an! Und:
Herein, zu mir! Herein, Krambambuli! lockt es drüben mit zärtlicher, liebevoller – ach, mit altbekannter Stimme...
Der Hund aber –
Was sich nun begab, begab sich viel rascher, als man es erzählen kann.
Krambambuli hatte seinen ersten Herrn erkannt und rannte auf ihn zu, bis – in die Mitte des Weges. Da pfeift Hopp, und der Hund macht kehrt, der Gelbe pfeift, und der Hund macht wieder kehrt und windet sich in Verzweiflung auf einem Fleck, in gleicher Distanz von dem Jäger wie von dem Wildschützen, zugleich hingerissen und gebannt...
Zuletzt hat das arme Tier den trostlos unnötigen Kampf aufgegeben und seinen Zweifeln ein Ende gemacht, aber nicht seiner Qual. Bellend, heulend, den Bauch am Boden, den Körper gespannt wie eine Sehne, den Kopf emporgehoben, als riefe es den Himmel zum Zeugen seines Seelenschmerzes an, kriecht es – seinem ersten Herrn zu.
Bei dem Anblick wird Hopp von Blutdurst gepackt. Mit zitternden Fingern hat er die neue Kapsel aufgesetzt – mit ruhiger Sicherheit legt er an. Auch der Gelbe hat den Lauf wieder auf ihn gerichtet. Diesmal gilt's! Das wissen die beiden, die einander auf dem Korn haben, und was auch in ihnen vorgehen möge, sie zielen so ruhig wie ein paar gemalte Schützen.
Zwei Schüsse fallen. Der Jäger trifft, der Wildschütze fehlt.
Warum? Weil er – vom Hunde mit stürmischer Liebkosung angesprungen – gezuckt hat im Augenblick des Losdrückens. Bestie! zischt er noch, stürzt rücklings hin und rührt sich nicht mehr.
Der ihn gerichtet, kommt langsam herangeschritten. Du hast genug, denkt er, um jedes Schrotkorn wär's schad bei dir. Trotzdem stellt er die Flinte auf den Boden und lädt von neuem. Der Hund sitzt aufrecht vor ihm, läßt die Zunge heraushängen, keucht kurz und laut und sieht ihm zu. Und als der Jäger fertig ist und die Flinte wieder zur Hand nimmt, halten sie ein Gespräch, von dem kein Zeuge ein Wort vernommen hätte, wenn es auch statt eines toten ein lebendiger gewesen wäre.
Weißt du, für wen das Blei gehört?
Ich kann es mir denken.
Deserteur, Kalfakter, pflicht- und treuvergessene Kanaille!
Ja, Herr, jawohl.
Du warst meine Freude. Jetzt ist's vorbei. Ich habe keine Freude mehr an dir.
Begreiflich, Herr, und Krambambuli legte sich hin, drückte den Kopf auf die ausgestreckten Vorderpfoten und sah den Jäger an.
Ja, hätte das verdammte Vieh ihn nur nicht angesehen! Da würde er ein rasches Ende gemacht und sich und dem Hunde viel Pein erspart haben. Aber so geht's nicht! Wer könnte ein Geschöpf niederknallen, das einen so ansieht? Herr Hopp murmelt ein halbes Dutzend Flüche zwischen den Zähnen, einer gotteslästerlicher als der andre, hängt die Flinte wieder um, nimmt dem Raubschützen noch die jungen Hasen ab und geht.
Der Hund folgte ihm mit den Augen, bis er zwischen den Bäumen verschwunden war, stand dann auf, und sein mark- und beinerschütterndes Wehgeheul durchdrang den Wald. Ein paarmal drehte er sich im Kreise und setzte sich wieder aufrecht neben den Toten hin. So fand ihn die gerichtliche Kommission, die, von Hopp geleitet, bei sinkender Nacht erschien, um die Leiche des Raubschützen in Augenschein zu nehmen und fortschaffen zu lassen. Krambambuli wich einige Schritte zurück, als die Herren herantraten. Einer von ihnen sagte zu dem Jäger: Das ist ja Ihr Hund. – Ich habe ihn hier als Schildwache zurückgelassen, antwortete Hopp, der sich schämte, die Wahrheit zu gestehen. – Was half's? Sie kam doch heraus, denn als die Leiche auf den Wagen geladen war und fortgeführt wurde, trottete Krambambuli gesenkten Kopfes und mit eingezogenem Schwanze hinterher. Unweit der Totenkammer, in der der Gelbe lag, sah ihn der Gerichtsdiener noch am folgenden Tage herumstreichen. Er gab ihm einen Tritt und rief ihm zu: Geh nach Hause! – Krambambuli fletschte die Zähne gegen ihn und lief davon, wie der Mann meinte, in der Richtung des Jägerhauses. Aber dorthin kam er nicht, sondern führte ein elendes Vagabundenleben.
Verwildert, zum Skelett abgemagert, umschlich er einmal die armen Wohnungen der Häusler am Ende des Dorfes. Plötzlich stürzte er auf ein Kind los, das vor der letzten Hütte stand, und entriß ihm gierig das Stück harten Brotes, an dem es nagte. Das Kind blieb starr vor Schrecken, aber ein kleiner Spitz sprang aus dem Hause und bellte den Räuber an. Dieser ließ sogleich seine Beute fahren und entfloh.
Am selben Abend stand Hopp vor dem Schlafengehen am Fenster und blickte in die schimmernde Sommernacht hinaus. Da war ihm, als sähe er jenseits der Wiese am Waldessaum den Hund sitzen, die Stätte seines ehemaligen Glückes unverwandt und sehnsüchtig betrachtend – der Treueste der Treuen, herrenlos!
Der Jäger schlug den Laden zu und ging zu Bett. Aber nach einer Weile stand er auf, trat wieder ans Fenster – der Hund war nicht mehr da. Und wieder wollte er sich zur Ruhe begeben und wieder fand er sie nicht.
Er hielt es nicht mehr aus. Sei es, wie es sei... Er hielt es nicht mehr aus ohne den Hund. – Ich hol ihn heim, dachte er, und fühlte sich wie neugeboren nach diesem Entschluß.
Beim ersten Morgengrauen war er angekleidet, befahl seiner Alten, mit dem Mittagessen nicht auf ihn zu warten, und sputete sich hinweg. Wie er aber aus dem Hause trat, stieß sein Fuß an denjenigen, den er in der Ferne zu suchen ausging. Krambambuli lag verendet vor ihm, den Kopf an die Schwelle gepreßt, die zu überschreiten er nicht mehr gewagt hatte.
Der Jäger verschmerzte ihn nie. Die Augenblicke waren seine besten, in denen er vergaß, daß er ihn verloren hatte. In freundliche Gedanken versunken, intonierte er dann sein berühmtes: Was macht denn mein Krambam... Aber mitten in dem Worte hielt er bestürzt inne, schüttelte das Haupt und sprach mit einem tiefen Seufzer: Schad um den Hund.
`
},
{
    title: 'Schneewittchen (DE)',
    content: 
`\\cSchneewittchen
Es war einmal mitten im Winter, und die Schneeflocken fielen wie Federn vom Himmel herab, da sass eine Koenigin an einem Fenster, das einen Rahmen von schwarzem Ebenholz hatte, und naehte. Und wie sie so naehte und nach dem Schnee aufblickte, stach sie sich mit der Nadel in den Finger, und es fielen drei Tropfen Blut in den Schnee. Und weil das Rote im weissen Schnee so schoen aussah, dachte sie bei sich haett ich ein Kind so weiss wie Schnee, so rot wie Blut, und so schwarz wie das Holz an dem Rahmen. Bald darauf bekam sie ein Toechterlein, das war so weiss wie Schnee, so rot wie Blut, und so schwarz haarig wie Ebenholz, und ward darum das Schneewittchen genannt. Und wie das Kind geboren war, starb die Koenigin.
ueber ein Jahr nahm sich der Koenig eine andere Gemahlin. Es war eine schoene Frau, aber sie war stolz und uebermuetig, und konnte nicht leiden, dass sie an Schoenheit von jemand sollte uebertroffen werden. Sie hatte einen wunderbaren Spiegel, wenn sie vor den trat und sich darin beschaute, sprach sie:
Spieglein, Spieglein an der Wand,
wer ist die schoenste im ganzen Land?
So antwortete der Spiegel: Frau Koenigin, ihr seid die schoenste im Land. Da war sie zufrieden, denn sie wusste dass der Spiegel die Wahrheit sagte.
Schneewittchen aber wuchs heran, und wurde immer schoener, und als es sieben Jahr alt war, war es so schoen, wie der klare Tag, und schoener als die Koenigin selbst. Als diese einmal ihren Spiegel fragte:
Spieglein, Spieglein an der Wand,
wer ist die schoenste im ganzen Land?
So antwortete er: Frau Koenigin, ihr seid die schoenste hier,
aber Schneewittchen ist tausendmal schoener als ihr.
Da erschrak die Koenigin, und ward gelb und gruen vor Neid. Von Stund an, wenn sie Schneewittchen erblickte, kehrte sich ihr das Herz im Leibe herum, so hasste sie das Maedchen. Und der Neid und Hochmut wuchsen wie Unkraut in ihrem Herzen immer hoeher, dass sie Tag und Nacht keine Ruhe mehr hatte. Da rief sie einen Jaeger und sprach: Bring das Kind hinaus in den Wald, ich willst nicht mehr vor meinen Augen sehen. Du sollst es toeten, und mir Lunge und Leber zum Wahrzeichen mitbringen. Der Jaeger gehorchte und fuehrte es hinaus, und als er den Hirschfaenger gezogen hatte und Schneewittchens unschuldiges Herz durchbohren wollte, fing es an zu weinen und sprach: Ach, lieber Jaeger, lass mir mein Leben; ich will in den wilden Wald laufen und nimmer mehr wieder heim kommen. Und weil es so schoen war, hatte der Jaeger Mitleiden und sprach: So lauf hin, du armes Kind. Die wilden Tiere werden dich bald gefressen haben dachte er, und doch wars ihm als waer ein Stein von seinem Herzen gewaelzt, weil er es nicht zu toeten brauchte. Und als gerade ein junger Frischling daher gesprungen kam, stach er ihn ab, nahm Lunge und Leber heraus, und brachte sie als Wahrzeichen der Koenigin mit. Der Koch musste sie in Salz kochen, und das boshafte Weib ass sie auf und meinte sie haette Schneewittchens Lunge und Leber gegessen.
Nun war das arme Kind in dem grossen Wald mutterseelen allein, und ward ihm so angst, dass es alle Blaetter an den Baeumen ansah und nicht wusste wie es sich helfen sollte. Da fing es an zu laufen und lief ueber die spitzen Steine und durch die Dornen, und die wilden Tiere sprangen an ihm vorbei, aber sie taten ihm nichts.
Es lief so lange die Fuesse noch fort konnten, bis es bald Abend werden wollte, da sah es ein kleines Haeuschen und ging hinein sich zu ruhen. In dem Haeuschen war alles klein, aber so zierlich und reinlich, dass es nicht zu sagen ist. Da stand ein weiss gedecktes Tischlein mit sieben kleinen Tellern, jedes Tellerlein mit seinem Loeffelein, ferner sieben Messerlein und Gaebelein, und sieben Becherlein. An der Wand waren sieben Bettlein neben einander aufgestellt und schneeweisse Laken darueber gedeckt. Schneewittchen, weil es so hungrig und durstig war, ass von jedem Tellerlein ein wenig Gemues' und Brot, und trank aus jedem Becherlein einen Tropfen Wein; denn es wollte nicht einem allein alles wegnehmen. Hernach, weil es so muede war, legte es sich in ein Bettchen, aber keins passte; das eine war zu lang, das andere zu kurz, bis endlich das siebente recht war. Und darin blieb es liegen, befahl sich Gott und schlief ein.
Als es dunkel geworden war, kamen die Herren von dem Haeuslein, das waren die sieben Zwerge, die in den Bergen nach Erz hackten und gruben. Sie zuendeten ihre sieben Lichtlein an, und wie es nun hell im Haeuslein ward, sahen sie dass jemand darin gewesen war, denn es stand nicht alles so in der Ordnung, wie sie es verlassen hatten. Der erste sprach: Wer hat auf meinem Stuehlchen gesessen? Der zweite: Wer hat von meinem Tellerchen gegessen? Der dritte: Wer hat von meinem Broetchen genommen? Der vierte: Wer hat von meinem Gemueschen gegessen? Der fuenfte: Wer hat mit meinem Gaebelchen gestochen? Der sechste: Wer hat mit meinem Messerchen geschnitten?. Der siebente: Wer hat aus meinem Becherlein getrunken? Dann sah sich der erste um und sah das auf seinem Bett eine kleine Delle war, da sprach er: Wer hat in meinem Bett getreten? Die andern kamen gelaufen und riefen: In meinem Bett hat auch jemand gelegen. Der siebente aber, als er in sein Bett sah, erblickte Schneewittchen, das lag darin und schlief. Nun rief er die andern, die kamen herbei gelaufen, und schrien vor Verwunderung, holten ihre sieben Lichtlein und beleuchteten Schneewittchen. Ei, du mein Gott! ei, du mein Gott! riefen sie, was ist das Kind so schoen! und hatten so grosse Freude, dass sie es nicht aufweckten, sondern im Bettlein fort schlafen liessen. Der siebente Zwerg aber schlief bei seinen Gesellen, bei jedem eine Stunde, da war die Nacht herum.
Als es Morgen war, erwachte Schneewittchen, und wie es die sieben Zwerge sah, erschrak es. Sie waren aber freundlich und sagten: Wie heisst du? Ich heisse Schneewittchen, antwortete es. Wie bist du in unser Haus gekommen? sprachen die Zwerge. Da erzaehlte es ihnen, dass seine Stiefmutter es haette wollen umbringen lassen, der Jaeger haette ihm aber das Leben geschenkt, und da waer es gelaufen den ganzen Tag, bis es endlich ihr Haeuslein gefunden haette. Die Zwerge sprachen. Willst du unsern Haushalt versehen, kochen, betten, waschen, naehen und stricken, und willst du alles ordentlich und reinlich halten, so kannst du bei uns bleiben, und es soll dir an nichts fehlen. Ja, sagte das Schneewittchen, von Herzen gern, und blieb bei ihnen. Es hielt ihnen das Haus in Ordnung: Morgens gingen sie in die Berge und suchten Erz und Gold, Abends kamen sie wieder, und da musste ihr Essen bereit sein. Den Tag ueber war das Maedchen allein, da warnten es die guten Zwerglein und sprachen: Huete dich vor deiner Stiefmutter, die wird bald wissen, dass du hier bist; lass ja niemand herein.
Die Koenigin aber, nachdem sie Schneewittchens Lunge und Leber glaubte gegessen zu haben, dachte nicht anders als sie waere wieder die erste und aller schoenste, trat vor ihren Spiegel und sprach:
Spieglein, Spieglein an der Wand,
wer ist die schoenste im ganzen Land?
Da antwortete der Spiegel:
Frau Koenigin, ihr seid die schoenste hier,
aber Schneewittchen ueber den Bergen
bei den sieben Zwergen
ist noch tausendmal schoener als ihr.
Da erschrak sie, denn sie wusste, dass der Spiegel keine Unwahrheit sprach, und merkte dass der Jaeger sie betrogen hatte, und Schneewittchen noch am Leben war. Und da sann und sann sie aufs neue, wie sie es umbringen wollte; denn so lange sie nicht die schoenste war im ganzen Land, liess ihr der Neid keine Ruhe. Und als sie sich endlich etwas ausgedacht hatte, faerbte sie sich das Gesicht, und kleidete sich wie eine alte Kraemerin, und war ganz unkenntlich. In dieser Gestalt ging sie ueber die sieben Berge zu den sieben Zwergen, klopfte an die Tuere, und rief: Schoene Ware, feil, feil! Schneewittchen guckte zum Fenster hinaus und rief: Guten Tag, liebe Frau, was habt ihr zu verkaufen? Gute Ware, schoene Ware, antwortete sie, Schnuerriemen von allen Farben, und holte einen hervor, der aus bunter Seide geflochten war. Die ehrliche Frau kann ich herein lassen dachte Schneewittchen. Kind, sprach die Alte, wie du aussiehst! komm, ich will dich einmal ordentlich schnueren. Schneewittchen hatte kein Arg, stellte sich vor sie, und liess sich mit dem neuen Schnuerriemen schnueren: aber die Alte schnuerte geschwind, und schnuerte so fest, dass dem Schneewittchen der Atem verging, und es fuer tot hinfiel. Nun bist du die schoenste gewesen sprach sie, und eilte hinaus.
Nicht lange darauf, zur Abendzeit, kamen die sieben Zwerge nach Haus, aber wie erschraken sie, als sie ihr liebes Schneewittchen auf der Erde liegen sahen; und es regte und bewegte sich nicht, als waere es tot. Sie hoben es in die Hoehe, und weil sie sahen, dass es zu fest geschnuert war, schnitten sie den Schnuerriemen entzwei: da fing es an ein wenig zu atmen, und ward nach und nach wieder lebendig. Als die Zwerge hoerten was geschehen war, sprachen sie: Die alte Kraemerfrau war niemand als die gottlose Koenigin: huete dich und lass keinen Menschen herein, wenn wir nicht bei dir sind. Das boese Weib aber, als es nach Haus gekommen war, ging vor den Spiegel und fragte:
Spieglein, Spieglein an der Wand,
wer ist die schoenste im ganzen Land?
Da antwortete der Spiegel:
Frau Koenigin, ihr seid die schoenste hier,
aber Schneewittchen ueber den Bergen
bei den sieben Zwergen
ist noch tausendmal schoener als ihr.
Als sie das hoerte, lief ihr alles Blut zum Herzen, so erschrak sie, denn sie sah wohl dass Schneewittchen wieder lebendig geworden war. Nun aber, sprach sie, will ich etwas aussinnen, das dich zu Grunde richten soll, und mit Hexenkuensten, die sie verstand, machte sie einen giftigen Kamm. Dann verkleidete sie sich und nahm die Gestalt eines anderen alten Weibes an.
So ging sie hin ueber die sieben Berge zu den sieben Zwergen, klopfte an die Tuere, und rief: Gute Ware fei!, feil! Schneewittchen schaute heraus und sprach: Geht nur weiter, ich darf niemand hereinlassen. Das Ansehen wird dir noch erlaubt sein, sprach die Alte, zog den giftigen Kamm heraus und hielt ihn in die Hoehe. Da gefiel er dem Kinde so gut, dass es sich betoeren liess und die Tuer oeffnete. Als sie des Kaufs einig waren, sprach die Alte: Nun will ich dich einmal ordentlich kaemmen. Das arme Schneewittchen dachte an nichts, und liess die Alte gewaehren, aber kaum hatte sie den Kamm in die Haare gesteckt, als das Gift darin wirkte, und das Maedchen ohne Besinnung niederfiel. Du Ausbund von Schoenheit, sprach das boshafte Weib, jetzt ist's um dich geschehen, und ging fort. Zum Glueck aber war es bald Abend, wo die sieben Zwerglein nach Hause kamen. Als sie Schneewittchen wie tot auf der Erde liegen sahen, hatten sie gleich die Stiefmutter in Verdacht, suchten nach, und fanden den giftigen Kamm, und kaum hatte sie ihn herausgezogen, so kam Schneewittchen wieder zu sich, und erzaehlte was vorgegangen war. Da warnten sie es noch einmal auf seiner Hut zu sein und niemals die Tuere zu oeffnen.
Die Koenigin stellte sich daheim vor den Spiegel und sprach:
Spieglein, Spieglein an der Wand,
wer ist die schoenste im ganzen Land?
Da antwortete er, wie vorher:
Frau Koenigin, ihr seid die schoenste hier,
aber Schneewittchen ueber den Bergen
bei den sieben Zwergen
ist doch noch tausendmal schoener als ihr.
Als sie den Spiegel so reden hoerte, zitterte und bebte sie vor Zorn. Schneewittchen soll sterben, rief sie, und wenn es mein eigenes Leben kostet. Darauf ging sie in eine ganz verborgene einsame Kammer, wo niemand hin kam, und machte da einen giftigen, giftigen Apfel. aeusserlich sah er schoen aus, weiss mit roten Backen, dass jeder, der ihn erblickte, Lust danach bekam, aber wer ein Stueckchen davon ass, der musste sterben. Als der Apfel fertig war, faerbte sie sich das Gesicht, und verkleidete sich in eine Bauersfrau, und so ging sie ueber die sieben Berge zu den sieben Zwergen. Sie klopfte an, Schneewittchen streckte den Kopf zum Fenster heraus, und sprach. Ich darf keinen Menschen einlassen, die sieben Zwerge haben's mir verboten. Mir auch recht, antwortete die Baeuerin, meine aepfel will ich schon los werden. Da, einen will ich dir schenken. Nein, sprach Schneewittchen, ich darf nichts annehmen. Fuerchtest du dich vor Gift? sprach die Alte, siehst du, da schneide ich den Apfel in zwei Teile; den roten Backen isst du, den weissen will ich essen. Der Apfel war aber so kuenstlich gemacht, dass der rote Backen allein vergiftet war. Schneewittchen luesterte den schoenen Apfel an, und als es sah, dass die Baeuerin davon ass, so konnte es nicht laenger widerstehen, streckte die Hand hinaus und nahm die giftige Haelfte. Kaum aber hatte es einen Bissen davon in ihrem Mund, so fiel es tot zur Erde nieder. Da betrachtete es die Koenigin mit grausigen Blicken und lachte ueberlaut, und sprach: Weiss wie Schnee, rot wie Blut, schwarz wie Ebenholz diesmal koennen dich die Zwerge nicht wieder erwecken. Und als sie daheim den Spiegel befragte:
Spieglein, Spieglein an der Wand,
wer ist die schoenste im ganzen Land?
So antwortete er endlich:
Frau Koenigin, ihr seid die schoenste im Land. 
Da hatte ihr neidisches Herz Ruhe, so gut ein neidisches Herz Ruhe haben kann.
Die Zwerglein, wie sie abends nach Hause kamen, fanden Schneewittchen auf der Erde liegen, und es ging kein Atem mehr aus seinem Mund, und es war tot. Sie hoben es auf, suchten ob sie was giftiges faenden, schnuerten es auf, kaemmten ihm die Haare, wuschen es mit Wasser und Wein, aber es half alles nichts; das liebe Kind war tot und blieb tot. sie legten es auf eine Bahre und setzten sich alle siebene daran und beweinten es, und weinten drei Tage lang. Da wollten sie es begraben, aber es sah noch so frisch aus wie ein lebender Mensch, und hatte noch seine schoenen roten Backen. Sie sprachen: Das koennen wir nicht in die schwarze Erde versenken, und liessen einen durchsichtigen Sarg von Glas machen, dass man es von allen Seiten sehen konnte, legten es hinein, und schrieben mit goldenen Buchstaben seinen Namen darauf, und das es eine Koenigstochter waere. Dann setzte sie den Sarg hinaus auf den Berg, und einer von ihnen blieb immer dabei, und bewachte ihn. Und die Tiere kamen auch und beweinten Schneewittchen, erst eine Eule, dann ein Rabe, zuletzt ein Taeubchen.
Nun lag Schneewittchen lange Zeit in dem Sarg und verweste nicht, sondern sah aus als wenn es schliefe, denn es war noch so weiss als Schnee, so rot als Blut, und so schwarz haarig wie Ebenholz. Es geschah aber, dass ein Koenigssohn in den Wald geriet und zu dem Zwergenhaus kam, da zu uebernachten. Er sah auf dem Berg den Sarg, und das schoene Schneewittchen darin, und las, was mit goldenen Buchstaben darauf geschrieben war. Da sprach er zu den Zwergen: Lasst mir den Sarg, ich will euch geben, was ihr dafuer haben wollt. Aber die Zwerge antworteten: Wir geben ihn nicht, um alles Gold in der Welt. Da sprach er: So schenkt mir ihn, denn ich kann nicht leben ohne Schneewittchen zu sehen, ich will es ehren und hochachten wie mein Liebstes. Wie er so sprach, empfanden die guten Zwerglein Mitleiden mit ihm und gaben ihm den Sarg. Der Koenigssohn liess ihn nun von seinen Dienern auf den Schultern fort tragen. Da geschah es, dass sie ueber einen Strauch stolperten, und von dem Schuettern fuhr der giftige Apfelgruetz, den Schneewittchen abgebissen hatte, aus dem Hals. Und nicht lange so oeffnete es die Augen, hob den Deckel vom Sarg in die Hoehe, und richtete sich auf, und war wieder lebendig. Ach Gott, wo bin ich? rief es. Der Koenigssohn sagte voll Freude: Du bist bei mir, und erzaehlte was sich zugetragen hatte und sprach: Ich habe dich lieber als alles auf der Welt; komm mit mir in mein Vaters Schloss, du sollst meine Gemahlin werden. Da war ihm Schneewittchen gut und ging mit ihm, und ihre Hochzeit ward mit grosser Pracht und Herrlichkeit angeordnet. Zu dem Fest wurde aber auch Schneewittchens gottlose Stiefmutter eingeladen. Wie sie sich nun mit schoenen Kleidern angetan hatte, trat sie vor den Spiegel und sprach:
Spieglein, Spieglein an der Wand,
wer ist die schoenste im ganzen Land?
Der Spiegel antwortete:
Frau Koenigin, ihr seid die schoenste hier,
aber die junge Koenigin ist tausendmal schoener als ihr. 
Da stiess das boese Weib einen Fluch aus, und ward ihr so angst, so angst, dass sie sich nicht zu lassen wusste. Sie wollte zuerst gar nicht auf die Hochzeit kommen: doch liess es ihr keine Ruhe, sie musste fort und die junge Koenigin sehen. Und wie sie hinein trat, erkannte sie Schneewittchen, und vor Angst und Schrecken stand sie da und konnte sich nicht regen. Aber es waren schon eiserne Pantoffeln ueber Kohlefeuer gestellt und wurden mit Zangen herein getragen und vor sie hingestellt. Da musste sie in die rot gluehenden Schuhe treten und so lange tanzen, bis sie tot zur Erde fiel. 
`
},
{
    title: 'Gefährliches Spiel (DE)',
    content: 
`\\cGefährliches Spiel
Theodor Fontane

Gefährliches Spiel

Wir hatten in Swinemünde verschiedene Spielplätze. Der uns liebste war aber wohl der am Bollwerk, und zwar gerade da, wo die von unserem Hause abzweigende Seitenstraße einmündete. Die ganze Stelle war sehr malerisch, besonders auch im Winter, wo hier die festgelegten, ihrer Obermasten entkleideten Schiffe lagen, oft drei hintereinander, also bis ziemlich weit in den Strom hinein. Uns hier am Bollwerk herumzutummeln und auf den ausgespannten Tauen, so weit sie dicht über dem Erdboden hinliefen, unsere Seiltänzerkünste zu üben, war uns gestattet, und nur eines stand unter Verbot: Wir durften nicht auf die Schiffe gehen und am wenigsten die Strickleiter hinauf bis in den Mastkorb klettern. Ein sehr vernünftiges Verbot. Aber je vernünftiger es war, desto größer war unser Verlangen, es zu übertreten, und bei Räuber und Wandersmann, das wir alle sehr liebten, verstand sich diese Übertretung beinahe von selbst. Entdeckung lag überdies außerhalb der Wahrscheinlichkeit; die Eltern waren entweder bei ihrer Partie oder zu Tisch eingeladen. Also nur vorwärts. Und petzt einer, so kommt er noch schlimmer weg als wir.
So dachten wir auch eines Sonntags im April 1831. Es muß um diese Jahreszeit gewesen sein, weil mir noch der klare und kalte Luftstrom deutlich vor Augen steht. Auf dem Schiff war keine Spur von Leben und am Bollwerk keine Menschenseele zu sehen.
Ich, als der älteste und stärkste, war natürlich Räuber, und acht oder zehn kleinere Jungens – unter denen nur ein einziger, Fritz Ehrlich, es einigermaßen mit mir aufnehmen konnte – waren schon vom Kirchplatz her, wo wie gewöhnlich die Jagd begonnen hatte, dicht hinter mir her. Ziemlich abgejagt kam ich am Bollwerk an, und weil es hier keinen anderen Ausweg für mich gab, lief ich über eine breite und feste Bohlenlage fort auf das zunächst liegende Schiff hinauf. Die ganze Meute mir nach, was natürlich zur Folge hatte, daß ich vom ersten Schiff bald aufs zweite und vom zweiten aufs dritte mußte. Da ging es nun nicht weiter, und wenn ich mich meiner Feinde trotzdem erwehren wollte, so blieb mir nichts anderes übrig, als auf dem Schiff selbst nach einem Versteck oder wenigstens nach einer schwer zugänglichen Stelle zu suchen. Und ich fand auch so was und kletterte auf den etwa mannshohen, neben der Kajüte befindlichen Oberbau hinauf, darin sich neben anderen Räumlichkeiten gemeinhin auch die Schiffsküche zu befinden pflegte. Etliche in der steilen Wandung eingelegte Stufen erleichterten es mir. Und da stand ich nun oben, momentan geborgen, und sah als Sieger auf meine Verfolger. Aber das Siegergefühl konnte nicht lange dauern; die Stufen waren wie für mich, so auch für andre da, und in kürzester Frist stand Fritz Ehrlich ebenfalls oben. Ich war verloren, wenn ich nicht auch jetzt noch einen Ausweg fand, und mit aller Kraft und, soweit der schmale Raum es zuließ, einen Anlauf nehmend, sprang ich von dem Küchenbau her über die zwischenliegende Wasserspalte hinweg auf das zweite Schiff zurück und jagte nun, wie von allen Furien verfolgt, wieder aufs Ufer zu. Und nun hatt' ich's, und den Freiplatz vor unserm Haus zu gewinnen, war nur noch ein kleines für mich. Aber ich sollte meiner Freude darüber nicht lange froh werden, denn im selben Augenblick fast, wo ich wieder festen Boden unter meinen Füßen hatte, hörte ich auch schon von dem dritten und zweiten Schiff her ein jämmerliches Schreien und dazwischen meinen Namen, so daß ich wohl merkte, da müsse was passiert sein. Und so schnell wie ich eben über die polternde Bohlenlage ans Ufer gekommen, ebenso schnell ging es wieder über dieselbe zurück.
Es war höchste Zeit. Fritz Ehrlich hatte mir den Sprung von der Küche her nachmachen wollen und war dabei, weil er zu kurz sprang, in die zwischen dem dritten und zweiten Schiff befindliche Wasserspalte gefallen. Da steckte nun der arme Junge, mit seinen Nägeln in die Schiffsritzen hineingreifend; denn an Schwimmen, wenn er überhaupt schwimmen konnte, war nicht zu denken. Dazu das eiskalte Wasser. Ihn von oben her so ohne weiteres zu erreichen, war unmöglich, und so griff ich denn nach einem von der einen Strickleiter etwas herabhängenden Tau und ließ mich, meinen Körper durch allerlei Künste und Möglichkeiten verlängernd, an der Schiffswand so weit herab, daß Fritz Ehrlich meinen am weitesten nach unten reisenden linken Fuß gerade noch fassen konnte. Oben hielt ich mich mit der rechten Hand. Pack zu, Fritz! Aber der brave Junge, der wohl einsehen mochte, daß wir beide verloren waren, wenn er wirklich fest zupackte, beschränkte sich darauf, seine Hand leise auf meine Stiefelspitze zu legen, und so wenig dies war, so war es doch gerade genug für ihn, sich über Wasser zu halten. Er blieb in der Schwebe, bis Leute vom Ufer herankamen und ihm einen Bootshaken herunterreichten, während andere ein Boot losmachten und in den Zwischenraum hineinfuhren, um ihn da herauszufischen. Ich meinerseits war in dem Augenblick, wo der rettende Bootshaken kam, von einem mir Unbekannten von oben her am Kragen gepackt und mit einem strammen Ruck wieder auf Deck gehoben worden. Von Vorwürfen, die sonst bei solchen Gelegenheiten nicht ausbleiben, war diesmal keine Rede. Den triefenden, von Schüttelfrost gepackten Fritz Ehrlich brachten die Leute nach einem ganz in der Nähe gelegenen Hause, während wir anderen in kleinlauter Stimmung unsern Heimweg antraten. Ich freilich auch gehoben, trotzdem ich wenig Gutes von der Zukunft erwartete. – Meine Befürchtungen erfüllten sich aber nicht. Im Gegenteil.
Am andern Vormittag, als ich in die Schule wollte, stand mein Vater schon im Hausflur und hielt mich fest, denn der Nachbar Pietzker hatte wieder geplaudert. Freilich mehr denn je in guter Absicht.
Habe von der Geschichte gehört..., sagte mein Vater. Alle Wetter, daß du nicht gehorchen kannst. Aber es soll hingehen, weil du dich gut benommen hast. Weiß alles. Pietzker drüben... Und damit war ich entlassen.
Wie gern denk' ich daran zurück, nicht um mich in meiner Heldentat zu sonnen, sondern in Dank und Liebe zu meinem Vater.
`
},
{
    title: 'Nouvelle von Goethe (DE)',
    content: 
`\\cNouvelle
Johann Wolfgang von Goethe

Novelle


Ein dichter Herbstnebel verhüllte noch in der Frühe die weiten Räume des fürstlichen Schloßhofes, als man schon mehr oder weniger durch den sich lichtenden Schleier die ganze Jägerei zu Pferde und zu Fuß durcheinander bewegt sah.
Die eiligen Beschäftigungen der Nächsten ließen sich erkennen: man verlängerte, man verkürzte die Steigbügel, man reichte sich Büchse und Patrontäschchen, man schob die Dachsranzen zurecht, indes die Hunde ungeduldig am Riemen den Zurückhaltenden mit fortzuschleppen drohten.
Auch hie und da gebärdete ein Pferd sich mutiger, von feuriger Natur getrieben oder von dem Sporn des Reiters angeregt, der selbst hier in der Halbhelle eine gewisse Eitelkeit, sich zu zeigen, nicht verleugnen konnte.
Alle jedoch warteten auf den Fürsten, der, von seiner jungen Gemahlin Abschied nehmend, allzulange zauderte.
Erst vor kurzer Zeit zusammen getraut, empfanden sie schon das Glück übereinstimmender Gemüter, beide waren von tätig lebhaftem Charakter, eines nahm gern an des andern Neigungen und Bestrebungen Anteil.
Des Fürsten Vater hatte noch den Zeitpunkt erlebt und genutzt, wo es deutlich wurde, daß alle Staatsglieder in gleicher Betriebsamkeit ihre Tage zubringen, in gleichem Wirken und Schaffen jeder nach seiner Art erst gewinnen und dann genießen sollte.
Wie sehr dieses gelungen war, ließ sich in diesen Tagen gewahr werden, als eben der Hauptmarkt sich versammelte, den man gar wohl eine Masse nennen konnte.
Der Fürst hatte seine Gemahlin gestern durch das Gewimmel der aufgehäuften Waren zu Pferde geführt und sie bemerken lassen, wie gerade hier das Gebirgsland mit dem flachen Lande einen glücklichen Umtausch treffe, er wußte sie an Ort und Stelle auf die Betriebsamkeit seines Länderkreises aufmerksam zu machen.
Wenn sich nun der Fürst fast ausschließlich in diesen Tagen mit den Seinigen über diese zudringenden Gegenstände unterhielt, auch besonders mit dem Finanzminister anhaltend arbeitete, so behielt doch auch der Landjägermeister sein Recht, auf dessen Vorstellung es unmöglich war, der Versuchung zu widerstehen, an diesen günstigen Herbsttagen eine schon verschobene Jagd zu unternehmen, sich selbst und den vielen angekommenen Fremden ein eignes und seltnes Fest zu eröffnen.
Die Fürstin blieb ungern zurück, man hatte sich vorgenommen, weit in das Gebirg hineinzudringen, um die friedlichen Bewohner der dortigen Wälder durch einen unerwarteten Kriegszug zu beunruhigen.
Scheidend versäumte der Gemahl nicht, einen Spazierritt vorzuschlagen, den sie im Geleit Friedrichs, des fürstlichen Oheims, unternehmen sollte .
Auch lasse ich, sagte er, dir unsern Honorio als Stall- und Hofjunker, der für alles sorgen wird.
Und im Gefolg dieser Worte gab er im Hinabsteigen einem wohlgebildeten jungen Mann die nötigen Aufträge, verschwand sodann bald mit Gästen und Gefolge.
Die Fürstin, die ihrem Gemahl noch in den Schloßhof hinab mit dem Schnupftuch nachgewinkt hatte, begab sich in die hintern Zimmer, welche nach dem Gebirg eine freie Aussicht ließen, die um desto schöner war, als das Schloß selbst von dem Flusse herauf in einiger Höhe stand und so vor- als hinterwärts mannigfaltige bedeutende Ansichten gewährte.
Sie fand das treffliche Teleskop noch in der Stellung, wo man es gestern abend gelassen hatte, als man, über Busch, Berg und Waldgipfel die hohen Ruinen der uralten Stammburg betrachtend, sich unterhielt, die in der Abendbeleuchtung merkwürdig hervortraten, indem alsdann die größten Licht- und Schattenmassen den deutlichsten Begriff von einem so ansehnlichen Denkmal alter Zeit verleihen konnten.
Auch zeigte sich heute früh durch die annähernden Gläser recht auffallend die herbstliche Färbung jener mannigfaltigen Baumarten, die zwischen dem Gemäuer ungehindert und ungestört durch lange Jahre emporstrebten.
Die schöne Dame richtete jedoch das Fernrohr etwas tiefer nach einer öden, steinigen Fläche, über welche der Jagdzug weggehen mußte.
Sie erharrte den Augenblick mit Geduld und betrog sich nicht, denn bei der Klarheit und Vergrößerungsfähigkeit des Instruments erkannten ihre glänzenden Augen deutlich den Fürsten und den Oberstallmeister, ja sie enthielt sich nicht, abermals mit dem Schnupftuche zu winken, als sie ein augenblickliches Stillhalten und Rückblicken mehr vermutete als gewahr ward.
Fürst Oheim, Friedrich mit Namen, trat sodann, angemeldet, mit seinem Zeichner herein, der ein großes Portefeuille unter dem Arm trug.
Liebe Cousine, sagte der alte, rüstige Herr, hier legen wir die Ansichten der Stammburg vor, gezeichnet, um von verschiedenen Seiten anschaulich zu machen, wie der mächtige Trutz- und Schutzbau von alten Zeiten her dem Jahr und seiner Witterung sich entgegenstemmte und wie doch hie und da sein Gemäuer weichen, da und dort in wüste Ruinen zusammenstürzen mußte.
Nun haben wir manches getan, um diese Wildnis zugänglicher zu machen, denn mehr bedarf es nicht, um jeden Wanderer, jeden Besuchenden in Erstaunen zu setzen, zu entzücken.
Indem nun der Fürst die einzelnen Blätter deutete, sprach er weiter: hier, wo man, den Hohlweg durch die äußern Ringmauern heraufkommend, vor die eigentliche Burg gelangt, steigt uns ein Felsen entgegen von den festesten des ganzen Gebirgs, hierauf nun steht gemauert ein Turm, doch niemand wüßte zu sagen, wo die Natur aufhört, Kunst und Handwerk aber anfangen.
Ferner sieht man seitwärts Mauern angeschlossen und Zwinger terrassenmäßig herab sich erstreckend.
Doch ich sage nicht recht, denn es ist eigentlich ein Wald, der diesen uralten Gipfel umgibt.
Seit hundertundfunfzig Jahren hat keine Axt hier geklungen, und überall sind die mächtigsten Stämme emporgewachsen.
Wo Ihr Euch an den Mauern andrängt, stellt sich der glatte Ahorn, die rauhe Eiche, die schlanke Fichte mit Schaft und Wurzeln entgegen, um diese müssen wir uns herumschlängeln und unsere Fußpfade verständig führen.
Seht nur, wie trefflich unser Meister dies Charakteristische auf dem Papier ausgedrückt hat, wie kenntlich die verschiedenen Stamm- und Wurzelarten zwischen das Mauerwerk verflochten und die mächtigen Äste durch die Lücken durchgeschlungen sind .
Es ist eine Wildnis wie keine, ein zufällig einziges Lokal, wo die alten Spuren längst verschwundener Menschenkraft mit der ewig lebenden und fortwirkenden Natur sich in dem ernstesten Streit erblicken lassen.
Ein anderes Blatt aber vorlegend, fuhr er fort: was sagt Ihr nun zum Schloßhofe, der, durch das Zusammenstürzen des alten Torturmes unzugänglich, seit und undenklichen Jahren von niemand betreten ward?
Wir suchten ihm von der Seite beizukommen, haben Mauern durchbrochen, Gewölbe gesprengt und so einen bequemen, aber geheimen Weg bereitet.
Inwendig bedurft es keines Aufräumens, hier findet sich ein flacher Felsgipfel von der Natur geplättet, aber doch haben mächtige Bäume hie und da zu wurzeln Glück und Gelegenheit gefunden, sie sind sachte, aber entschieden aufgewachsen, nun erstrecken sie ihre Äste bis in die Galerien hinein, auf denen der Ritter sonst auf und ab schritt, ja durch Türen durch und Fenster in die gewölbten Säle, aus denen wir sie nicht vertreiben wollen, sie sind eben Herr geworden und mögens bleiben.
Tiefe Blätterschichten wegräumend, haben wir den merkwürdigsten Platz geebnet gefunden, dessengleichen in der Welt vielleicht nicht wieder zu sehen ist.
Nach allem diesem aber ist es immer noch bemerkenswert und an Ort und Stelle zu beschauen, daß auf den Stufen, die in den Hauptturm hinaufführen, ein Ahorn Wurzel geschlagen und sich zu einem so tüchtigen Baume gebildet hat, daß man nur mit Not daran vorbeidringen kann, um die Zinne, der unbegrenzten Aussicht wegen, zu besteigen.
Aber auch hier verweilt man bequem im Schatten, denn dieser Baum ist es, der sich über das Ganze wunderbar hoch in die Luft hebt.
Danken wir also dem wackern Künstler, der uns so löblich in verschiedenen Bildern von allem überzeugt, als wenn wir gegenwärtig wären, er hat die schönsten Stunden des Tages und der Jahrszeit dazu angewendet und sich wochenlang um diese Gegenstände herumbewegt.
In dieser Ecke ist für ihn und den Wächter, den wir ihm zugegeben, eine kleine, angenehme Wohnung eingerichtet.
Sie sollten nicht glauben, meine Beste, welch eine schöne Aus- und Ansicht er ins Land, in Hof und Gemäuer sich dort bereitet hat. Nun aber, da alles so rein und charakteristisch umrissen ist, wird er es hier unten mit Bequemlichkeit ausführen.
wir wollen mit diesen Bildern unsern Gartensaal zieren, und niemand soll über unsere regelmäßigen Parterre, Lauben und schattigen Gänge seine Augen spielen lassen, der nicht wünschte, dort oben in dem wirklichen Anschauen des Alten und Neuen, des Starren, Unnachgiebigen, Unzerstörlichen und des Frischen, Schmiegsamen, Unwiderstehlichen seine Betrachtungen anzustellen.
Honorio trat ein und meldete, die Pferde seien vorgeführt, da sagte die Fürstin, zum Oheim gewendet: reiten wir hinauf, und lassen Sie mich in der Wirklichkeit sehen, was Sie mir hier im Bilde zeigten .
Seit ich hier bin, hör ich von diesem Unternehmen und werde jetzt erst recht verlangend, mit Augen zu sehen, was mir in der Erzählung unmöglich schien und in der Nachbildung unwahrscheinlich bleibt.
- Noch nicht, meine Liebe, versetzte der Fürst, was Sie hier sahen, ist, was es werden kann und wird, jetzt stockt noch manches, die Kunst muß erst vollenden, wenn sie sich vor der Natur nicht schämen soll.
- Und so reiten wir wenigstens hinaufwärts, und wär es nur bis an den Fuß, ich habe große Lust, mich heute weit in der Welt umzusehen.
- Ganz nach Ihrem Willen, versetzte der Fürst.
- Lassen Sie uns aber durch die Stadt reiten, fuhr die Dame fort, über den großen Marktplatz, wo eine zahllose Menge von Buden die Gestalt einer kleinen Stadt, eines Feldlagers angenommen hat.
Es ist, als wären die Bedürfnisse und Beschäftigungen sämtlicher Familien des Landes umher nach außen gekehrt, in diesem Mittelpunkt versammelt, an das Tageslicht gebracht worden, denn hier sieht der aufmerksame Beobachter alles, was der Mensch leistet und bedarf, man bildet sich einen Augenblick ein, es sei kein Geld nötig, jedes Geschäft könne hier durch Tausch abgetan werden, und so ist auch im Grunde.
Seitdem der Fürst gestern mir Anlaß zu diesem Übersichten gegeben, ist es mir gar angenehm zu denken, wie hier, wo Gebirg und flaches Land aneinandergrenzen, beide so deutlich aussprechen, was sie brauchen und was sie wünschen.
Wie nun der Hochländer das Holz seiner Wälder in hundert Formen umzubilden weiß, das Eisen zu einem jeden Gebrauch zu vermannigfaltigen, so kommen jene drüben mit den vielfältigsten Waren ihm entgegen, an denen man den Stoff kaum unterscheiden und den Zweck oft nicht erkennen mag.
Ich weiß, versetzte der Fürst, daß mein Neffe hierauf die größte Aufmerksamkeit wendet, denn gerade zu dieser Jahrszeit kommt es hauptsächlich darauf an, daß man mehr empfange als gebe, dies zu bewirken, ist am Ende die Summe des ganzen Staatshaushaltes so wie der kleinsten häuslichen Wirtschaft.
Verzeihen Sie aber, meine Beste, ich reite niemals gern durch den Markt und Messe, bei jedem Schritt ist man gehindert und aufgehalten, und dann flammt mir das ungeheure Unglück wieder in die Einbildungskraft, das sich mir gleichsam in die Augen eingebrannt, als ich eine solche Güter- und Warenbreite in Feuer aufgehen sah.
Ich hatte mich kaum -.
Lassen Sie uns die schönen Stunden nicht versäumen. fiel ihm die Fürstin ein, da der würdige Mann sie schon einigemal mit ausführlicher Beschreibung jenes Unheils geängstigt hatte, wie er sich nämlich, auf einer großen Reise begriffen, abends im besten Wirtshause auf dem Markte, der eben von einer Hauptmesse wimmelte, höchst ermüdet zu Bette gelegt und nachts durch Geschrei und Flammen, die sich gegen seine Wohnung wälzten, gräßlich aufgeweckt worden.
Die Fürstin eilte, das Lieblingspferd zu besteigen, und führte, statt zum Hintertore bergauf, zum Vordertore bergunter ihren widerwillig bereiten Begleiter, denn wer wäre nicht gern an ihrer Seite geritten, wer wäre ihr nicht gern gefolgt .
Und so war auch Honorio von der sonst so ersehnten Jagd willig zurückgeblieben, um ihr ausschließlich dienstbar zu sein.
Wie vorauszusehen, durften sie auf dem Markte nur Schritt vor Schritt reiten, aber die schöne Liebenswürdige erheiterte jeden Aufenthalt durch eine geistreiche Bemerkung.
Ich wiederhole, sagte sie, meine gestrige Lektion, da denn doch die Notwendigkeit unsere Geduld prüfen will.
Und wirklich drängte sich die ganze Menschenmasse dergestalt an die Reitenden heran, daß sie ihren Weg nur langsam fortsetzen konnten. Das Volk schaute mit Freuden die junge Dame, und auf so viel lächelnden Gesichtern zeigte sich das entschiedene Behagen, zu sehen, daß die erste Frau im Lande auch die schönste und anmutigste sei.
Untereinander gemischt standen Bergbewohner, die zwischen Felsen, Fichten und Föhren ihre stillen Wohnsitze hegten, Flachländer von Hügeln, Auen und Wiesen her, Gewerbsleute der kleinen Städte, und was sich alles versammelt hatte.
Nach einem ruhigen Überblick bemerkte die Fürstin ihrem Begleiter, wie alle diese, woher sie auch seien, mehr Stoff als nötig zu ihren Kleidern genommen, mehr Tuch und Leinwand, mehr Band zum Besatz.
Ist es doch, als ob die Weiber nicht brauschig und die Männer nicht pausig genug sich gefallen könnten.
Wir wollen ihnen das ja lassen, versetzte der Oheim, wo auch der Mensch seinen Überfluß hinwendet, ihm ist wohl dabei, am wohlsten, wenn er sich damit schmückt und aufputzt.
Die schöne Dame winkte Beifall.
So waren sie nach und nach auf einen freiern Platz gelangt, der zur Vorstadt hinführte, wo am Ende vieler kleiner Buden und Kramstände ein größeres Brettergebäude in die Augen fiel, das sie kaum erblickten, als ein ohrzerreißendes Gebrülle ihnen entgegentönte.
Die Fütterungsstunde der dort zur Schau stehenden wilden Tiere schien herangekommen, der Löwe ließ seine Wald- und Wüstenstimme aufs kräftigste hören, die Pferde schauderten, und man konnte der Bemerkung nicht entgehen, wie in dem friedlichen Wesen und Wirken der gebildeten Welt der König der Einöde sich so furchtbar verkündige.
Zur Bude näher gelangt, durften sie die bunten, kolossalen Gemälde nicht übersehen, die mit heftigen Farben und kräftigen Bildern jene fremden Tiere darstellten, welche der friedliche Staatsbürger zu schauen unüberwindliche Lust empfinden sollte.
Der grimmig ungeheure Tiger sprang auf einen Mohren los, im Begriff ihn zu zerreißen, ein Löwe stand ernsthaft majestätisch, als wenn er keine Beute seiner würdig vor sich sähe, andere wunderliche, bunte Geschöpfe verdienten neben diesen mächtigen weniger Aufmerksamkeit.
Wir wollen, sagte die Fürstin, bei unserer Rückkehr absteigen und die seltenen Gäste näher betrachten. - Es ist wunderbar, versetzte der Fürst, daß der Mensch durch Schreckliches immer aufgeregt sein will.
Drinnen liegt der Tiger ganz ruhig in seinem Kerker, und hier muß er grimmig auf einen Mohren losfahren, damit man glaube, dergleichen inwendig ebenfalls zu sehen, es ist an Mord und Totschlag noch nicht genug, an Brand und Untergang: die Bänkelsänger müssen es an jeder Ecke wiederholen.
Die guten Menschen wollen eingeschüchtert sein, um hinterdrein erst recht zu fühlen, wie schön und löblich es sei, frei Atem zu holen.
Was denn aber auch Bängliches von solchen Schreckensbildern mochte übriggeblieben sein, alles und jedes war sogleich ausgelöscht, als man, zum Tore hinausgelangt, in die heiterste Gegend eintrat.
Der Weg führte zuerst am Flusse hinan, an einem zwar noch schmalen, nur leichte Kähne tragenden Wasser, das aber nach und nach als größter Strom seinen Namen behalten und ferne Länder beleben sollte.
Dann ging es weiter durch wohlversorgte Frucht- und Lustgärten sachte hinaufwärts, und man sah sich nach und nach in der aufgetanen, wohlbewohnten Gegend um, bis erst ein Busch, sodann ein Wäldchen die Gesellschaft aufnahm und die anmutigsten Örtlichkeiten ihren Blick begrenzten und erquickten.
Ein aufwärts leitendes Wiesental, erst vor kurzem zum zweiten Male gemäht, sammetähnlich anzusehen, von einer oberwärts lebhaft auf einmal reich entspringenden Quelle gewässert, empfing sie freundlich, und so zogen sie einem höheren, freieren Standpunkt entgegen, den sie, aus dem Walde sich bewegend, nach einem lebhaften Stieg erreichten, alsdann aber vor sich noch in bedeutender Entfernung über neuen Baumgruppen das alte Schloß, den Zielpunkt ihrer Wallfahrt, als Fels- und Waldgipfel hervorragen sahen.
Rückwärts aber - denn niemals gelangte man hierher, ohne sich umzukehren - erblickten sie durch zufällige Lücken der hohen Bäume das fürstliche Schloß links, von der Morgensonne beleuchtet, den wohlgebauten höhern Teil der Stadt, von leichten Rauchwolken gedämpft, und so fort nach der Rechten zu die untere Stadt, den Fluß in einigen Krümmungen mit seinen Wiesen und Mühlen, gegenüber eine weite nahrhafte Gegend.
nachdem sie sich an dem Anblick ersättigt oder vielmehr, wie es uns bei dem Umblick auf so hoher Stelle zu geschehen pflegt, erst recht verlangend geworden nach einer weitern, weniger begrenzten Aussicht, ritten sie eine steinige, breite Fläche hinan, wo ihnen die mächtige Ruine als ein grüngekrönter Gipfel entgegenstand, wenig alte Bäume tief unten um seinen Fuß, sie ritten hindurch, und so fanden sie sich gerade vor der steilsten, unzugänglichsten Seite.
Mächtige Felsen standen von Urzeiten her, jedem Wechsel unangetastet, fest, wohlgegründet voran, und so türmte sichs aufwärts, das sazwischen Herabgestürzte lag in mächtigen Platten und Trümmern unregelmäßig übereinander und schien dem Kühnsten jeden Angriff zu verbieten.
Aber das Steile, Jähe scheint der Jugend zuzusagen, dies zu unternehmen, zu erstürmen, zu erobern, ist jungen Gliedern ein Genuß.
Die Fürstin bezeigte Neigung zu einem Versuch, Honorio war bei der Hand, der fürstliche Oheim, wenn schon bequemer, ließ sichs gefallen und wollte sich doch auch nicht unkräftig zeigen, die Pferde sollten am Fuß unter den Bäumen halten, und man wollte bis zu einem gewissen Punkte gelangen, wo ein vorstehender mächtiger Fels einen Flächenraum darbot, von wo man eine Aussicht hatte, die zwar schon in den Blick des Vogels überging, aber sich doch noch malerisch genug hintereinander schob.
Die Sonne, beinahe auf ihrer höchsten Stelle, verlieh die klarste Beleuchtung, das fürstliche Schloß mit seinen Teilen, Hauptgebäuden, Flügeln, Kuppeln und Türmen erschien gar stattlich, die obere Stadt in ihrer völligen Ausdehnung, auch in die untere konnte man bequem hineinsehen, ja durch das Fernrohr auf dem Markte sogar die Buden unterscheiden.
Honorio war immer gewohnt, ein so förderliches Werkzeug überzuschnallen, man schaute den Fluß hinauf und hinab, diesseits das bergartig terrassenweis unterbrochene, jenseits das aufgleitende flache und in mäßigen Hügeln abwechselnde fruchtbare Land, Ortschaften unzählige, denn es war längst herkömmlich, über die Zahl zu streiten, wieviel man deren von hier oben gewahr werde.
Über die große Weite lag eine heitere Stille, wie es am Mittag zu sein pflegt, wo die Alten sagten, Pan schlafe und alle Natur halte den Atem an, um ihn nicht aufzuwecken.
Es ist nicht das erstemal, sagte die Fürstin, daß ich auf so hoher, weitumschauender Stelle die Betrachtung machte, wie doch die klare Natur so reinlich und friedlich aussieht und den Eindruck verleiht, als wenn gar nichts Widerwärtiges in der Welt sein könne, und wenn man denn wieder in die Menschenwohnung zurückkehrt, sie sei hoch oder niedrig, weit oder eng, so gibts immer etwas zu kämpfen, zu streiten, zu schlichten und zurechtzulegen.
Honorio, der indessen durch das Sehrohr nach der Stadt geschaut hatte, rief: seht hin. Seht hin. Auf dem Markte fängt es an zu brennen.. Sie sahen hin und bemerkten wenigen Rauch, die Flamme dämpfte der Tag.
Das Feuer greift weiter um sich. rief man, immer durch die Gläser schauend, auch wurde das Unheil den guten, unbewaffneten Augen der Fürstin bemerklich.
Von Zeit zu Zeit erkannte man eine rote Flammenglut, der Dampf stieg empor, und Fürst Oheim sprach: laßt uns zurückkehren. Das ist nicht gut . Ich fürchtete immer, das Unglück zum zweiten Male zu erleben.
Als sie, herabgekommen, den Pferden wieder zugingen, sagte die Fürstin zu dem alten Herrn: reiten Sie hinein, eilig, aber nicht ohne den Reitknecht. Lassen Sie mir Honorio. Wir folgen sogleich.
Der Oheim fühlte das Vernünftige, ja das Notwendige dieser Worte und ritt, so eilig als der Boden erlaubte, den wüsten, steinigen Hang hinunter.
Als die Fürstin aufsaß, sagte Honorio: reiten Euer Durchlaucht, ich bitte, langsam .
In der Stadt wie auf dem Schloß sind die Feueranstalten in bester Ordnung, man wird sich durch einen so unerwartet außerordentlichen Fall nicht irre machen lassen.
Hier aber ist ein böser Boden, kleine Steine und kurzes Gras, schnelles Reiten ist unsicher, ohnehin, bis wir hineinkommen, wird das Feuer schon nieder sein.
Die Fürstin glaube nicht daran, sie sah den Rauch sich verbreiten, sie glaubte einen aufflammenden Blitz gesehen, einen Schlag gehört zu haben, und nun bewegten sich in ihrer Einbildungskraft alle die Schreckbilder, welche des trefflichen Oheims wiederholte Erzählung von dem erlebten Jahrmarktsbrande leider nur zu tief eingesenkt hatte.
Fürchterlich wohl war jener Fall, überraschend und eindringlich genug, um zeitlebens eine Ahnung und Vorstellung wiederkehrenden Unglücks ängstlich zurückzulassen, als zur Nachtzeit auf dem großen, budenreichen Marktraum ein plötzlicher Brand Laden auf Laden ergriffen hatte, ehe noch die in und an diesen leichten Hütten Schlafenden aus tiefen Träumen geschüttelt wurden, der Fürst selbst als ein ermüdet angelangter, erst eingeschlafener Fremder ans Fenster sprang, alles fürchterlich erleuchtet sah, Flamme nach Flamme, rechts und links sich überspringend, ihm entgegenzüngelte.
Die Häuser des Marktes, vom Widerschein gerötet, schienen schon zu glühen, drohend sich jeden Augenblick zu entzünden und in Flammen aufzuschlagen, unten wütete das Element unaufhaltsam, die Bretter prasselten, die Latten knackten, Leinwand flog auf, und ihre düstern, an den Enden flammend ausgezackten Fetzen trieben in der Höhe sich umher, als wenn die bösen Geister in ihrem Elemente, um und um gestaltet, sich mutwillig tanzend verzehren und da und dort aus den Gluten wieder auftauchen wollten.
Dann aber mit kreischendem Geheul rettete jeder, was zur Hand lag, Diener und Knechte mit den Herren bemühten sich, von Flammen ergriffene Ballen fortzuschleppen, von dem brennenden Gestell noch einiges wegzureißen, um es in die Kiste zu packen, die sie denn doch zuletzt den eilenden Flammen zum Raube lassen mußten.
Wie mancher wünschte nur einen Augenblick Stillstand dem heranprasselnden Feuer, nach der Möglichkeit einer Besinnung sich umsehend, und er war mit aller seiner Habe schon ergriffen, an der einen Seite brannte, glühte schon, was an der andern noch in finsterer Nacht stand.
Hartnäckige Charaktere, willensstarke Menschen widersetzten sich grimmig dem grimmigen Feinde und retteten manches mit Verlust ihrer Augenbraunen und Haare.
Leider nun erneuerte sich vor dem schönen Geiste der Fürstin der wüste Wirrwarr, nun schien der heitere morgendliche Gesichtskreis umnebelt, ihre Augen verdüstert, Wald und Wiese hatten einen wunderbaren, bänglichen Anschein.
In das friedliche Tal einreitend, seiner labenden Kühle nicht achtend, waren sie kaum einige Schritte von der lebhaften Quelle des nahen fließenden Baches herab, als die Fürstin ganz unten im Gebüsche des Wiesentals etwas Seltsames erblickte, das sie alsobald für den Tiger erkannte, heranspringend, wie sie ihn vor kurzem gemalt gesehen, kam er entgegen, und dieses Bild zu den furchtbaren Bildern, die sie soeben beschäftigten, machte den wundersamsten Eindruck.
Flieht. Gnädige Frau, rief Honorio, flieht.. Sie wandte das Pferd um, dem steilen Berg zu, wo sie herabgekommen waren.
Der Jüngling aber, dem Untier entgegen, zog die Pistole und schoß, als er sich nahe genug glaubte.
Leider jedoch war gefehlt, der Tiger sprang seitwärts, das Pferd stutzte, das ergrimmte Tier aber verfolgte seinen Weg aufwärts, unmittelbar der Fürstin nach.
Sie sprengte, was das Pferd vermochte, die steile, steinige Strecke hinan, kaum fürchtend, daß ein zartes Geschöpf, solcher Anstrengung ungewohnt, sie nicht aushalten werde.
Es übernahm sich, von der bedrängten Reiterin angeregt, stieß am kleinen Gerölle des Hanges an und wieder an und stürzte zuletzt nach heftigem Bestreben kraftlos zu Boden.
Die schöne Dame, entschlossen und gewandt, verfehlte nicht, sich strack auf ihre Füße zu stellen, auch das Pferd richtete sich auf, aber der Tiger nahte schon, obgleich nicht mit heftiger Schnelle, der ungleiche Boden, die scharfen Steine schienen seinen Antrieb zu hindern, und nur daß Honorio unmittelbar hinter ihm herflog, neben ihm gemäßigt heraufritt, schien seine Kraft aufs neue anzuspornen und zu reizen.
Beide Renner erreichten zugleich den Ort, wo die Fürstin am Pferde stand, der Ritter beugte sich herab, schoß und traf mit der zweiten Pistole das Ungeheuer durch den Kopf, daß es sogleich niederstürzte und ausgestreckt in seiner Länge erst recht die Macht und Furchtbarkeit sehen ließ, von der nur noch das Körperliche übriggeblieben dalag.
Honorio war vom Pferde gesprungen und kniete schon auf dem Tiere, dämpfte seine letzten Bewegungen und hielt den gezogenen Hirschfänger in der rechten Hand.
Der Jüngling war schön, er war herangesprengt, wie ihn die Fürstin oft im Lanzen- und Ringelspiel gesehen hatte.
Ebenso traf in der Reitbahn seine Kugel im Vorbeisprengen den Türkenkopf auf dem Pfahl gerade unter dem Turban in die Stirne, ebenso spießte er, flüchtig heransprengend, mit dem blanken Säbel das Mohrenhaupt vom Boden auf.
In allen solchen Künsten war er gewandt und glücklich, hier kam beides zustatten.
Gebt ihm den Rest, sagte die Fürstin, ich fürchte, er beschädigt Euch noch mit den Krallen.
- Verzeiht. erwiderte der Jüngling, er ist schon tot genug, und ich mag das Fell nicht verderben, das nächsten Winter auf Eurem Schlitten glänzen soll.
- Frevelt nicht. sagte die Fürstin, alles, was von Frömmigkeit im tiefen Herzen wohnt, entfaltet sich in solchem Augenblick.
- Auch ich, rief Honorio, war nie frömmer als jetzt eben, deshalb aber denk ich ans Freudigste, ich blicke dieses Fell nur an, wie es Euch zur Lust begleiten kann.
- Es würde mich immer an diesen schrecklichen Augenblick erinnern, versetzte sie.
Ist es doch, erwiderte der Jüngling mit glühender Wange, ein unschuldigeres Triumphzeichen, als wenn die Waffen erschlagener Feinde vor dem Sieger her zur Schau getragen wurden.
- Ich werde mich an Eure Kühnheit und Gewandtheit dabei erinnern und darf nicht hinzusetzen, daß Ihr auf meinen Dank und auf die Gnade des Fürsten lebenslänglich rechnen könnt.
Aber steht auf .
Schon ist kein Leben mehr im Tiere.
Bedenken wir das Weitere .
Vor allen Dingen steht auf. - Da ich nun einmal kniee, versetzte der Jüngling, da ich mich in einer Stellung befinde, die mir auf jede andere Weise untersagt wäre, so laßt mich bitten, von der Gunst und von der Gnade, die Ihr mir zuwendet, in diesem Augenblick versichert zu werden.
Ich habe schon so oft Euren hohen Gemahl gebeten um Urlaub und Vergünstigung einer weitern Reise.
Wer das Glück hat, an Eurer Tafel zu sitzen, wen Ihr beehrt, Eure Gesellschaft unterhalten zu dürfen, der muß die Welt gesehen haben. Reisende strömen von allen Orten her, und wenn von einer Stadt, von einem wichtigen Punkte irgendeines Weltteils gesprochen wird, ergeht an den Eurigen jedesmal die Frage, ob er daselbst gewesen sei.
Niemanden traut man Verstand zu, als wer das alles gesehen hat, es ist, als wenn man sich nur für andere zu unterrichten hätte.
Steht auf. wiederholte die Fürstin, ich möchte nicht gern gegen die Überzeugung meines Gemahls irgend etwas wünschen und bitten, allein wenn ich nicht irre, so ist die Ursache, warum er Euch bisher zurückhielt, bald gehoben.
Seine Absicht war, Euch zum selbständigen Edelmann herangereift zu sehen, der sich und ihm auch auswärts Ehre machte wie bisher am Hofe, und ich dächte, Eure Tat wäre ein so empfehlender Reisepaß, als ein junger Mann nur in die Welt mitnehmen kann.
Daß anstatt einer jugendlichen Freude eine gewisse Trauer über sein Gesicht zog, hatte die Fürstin nicht Zeit zu bemerken, noch er seiner Empfindung Raum zu geben, denn hastig den Berg herauf, einen Knaben an der Hand, kam eine Frau geradezu auf die Gruppe los, die wir kennen, und kaum war Honorio, sich besinnend, aufgestanden, als sie sich heulend und schreiend über den Leichnam herwarf und an dieser Handlung sowie an einer obgleich reinlich anständigen, doch bunten und seltsamen Kleidung sogleich erraten ließ, sie sei die Meisterin und Wärterin dieses dahingestreckten Geschöpfes, wie denn der schwarzaugige, schwarzlockige Knabe, der eine Flöte in der Hand hielt, gleich der Mutter weinend, weniger heftig, aber tief gerührt neben ihr kniete.
Den gewaltsamen Ausbrüchen der Leidenschaft dieses unglücklichen Weibes folgte, zwar unterbrochen, stoßweise ein Strom von Worten, wie ein Bach sich in Absätzen von Felsen zu Felsen stürzt.
Eine natürliche Sprache, kurz und abgebrochen, machte sich eindringlich und rührend.
Vergebens würde man sie in unsern Mundarten übersetzen wollen, den ungefähren Inhalt dürfen wir nicht verfehlen: sie haben dich ermordet, armes Tier.
Ermordet ohne Not.
Du warst zahm und hättest dich gern ruhig niedergelassen und auf uns gewartet, denn deine Fußballen schmerzten dich, und deine Krallen hatten keine Kraft mehr.
Die heiße Sonne fehlte dir, sie zu reifen.
Du warst der Schönste deinesgleichen, wer hat je einen königlichen Tiger so herrlich ausgestreckt im Schlaf gesehen, wie du nun hier liegst, tot, um nicht wieder aufzustehen.
Wenn du des Morgens aufwachtest beim frühen Tagschein und den Rachen aufsperrtest, ausstreckend die rote Zunge, so schienst du uns zu lächeln, und wenn schon brüllend, nahmst du doch spielend dein Futter aus den Händen einer Frau, von den Fingern eines Kindes.
Wie lange begleiteten wir dich auf deinen Fahrten, wie lange war deine Gesellschaft uns wichtig und fruchtbar.
Uns, uns ganz eigentlich kam die Speise von den Fressern und süße Labung von den Starken.
So wird es nicht mehr sein.
Wehe.
Wehe. Sie hatte nicht ausgeklagt, als über die mittlere Höhe des Bergs am Schlosse herab Reiter heransprengten, die alsobald für das Jagdgefolge des Fürsten erkannt wurden, er selbst voran.
Sie hatten, in den hintern Gebirgen jagend, die Brandwolken aufsteigen sehen und durch Täler und Schluchten, wie auf gewaltsam hetzender Jagd, den geraden Weg nach diesem traurigen Zeichen genommen.
Über die steinige Blöße einhersprengend, stutzten und starrten sie, nun die unerwartete Gruppe gewahr werdend, die sich auf der leeren Fläche merkwürdig auszeichnete.
Nach dem ersten Erkennen verstummte man, und nach einigem Erholen ward, was der Anblick nicht selbst ergab, mit wenigen Worten erläutert.
So stand der Fürst vor dem seltsamen, unerhörten Ereignis, einen Kreis umher von Reitern und Nacheilenden zu Fuße.
Unschlüssig war man nicht, was zu tun sei, anzuordnen, auszuführen war der Fürst beschäftigt, als ein Mann sich in den Kreis drängte, groß von Gestalt, bunt und wunderlich gekleidet wie Frau und Kind.
Und nun gab die Familie zusammen Schmerz und Überraschung zu erkennen.
Der Mann aber, gefaßt, stand in ehrfurchtsvoller Entfernung vor dem Fürsten und sagte: es ist nicht Klagenszeit, ach, mein Herr und mächtiger Jäger, auch der Löwe ist los, auch hier nach dem Gebirg ist er hin, aber schont ihn, habt Barmherzigkeit, daß er nicht umkomme wie dies gute Tier.
Der Löwe ? sagte der Fürst,hast du seine Spur?
Ja, Herr. Ein Bauer dort unten, der sich ohne Not auf einen Baum gerettet hatte, wies mich weiter hier links hinauf, aber ich sah den großen Trupp Menschen und Pferde vor mir, neugierig und hilfsbedürftig eilt ich hierher.
- Also, beorderte der Fürst, muß die Jagd sich auf diese Seite ziehen, ihr ladet eure Gewehre, geht sachte zu Werk, es ist kein Unglück, wenn ihr ihn in die tiefen Wälder treibt.
- Aber am Ende, guter Mann, werden wir euer Geschöpf nicht schonen können, warum wart ihr unvorsichtig genug, sie entkommen zu lassen. - Das Feuer brach aus, versetzte jener, wir hielten uns still und gespannt, es verbreitete sich schnell, aber fern von uns.
Wir hatten Wasser genug zu unserer Verteidigung, aber ein Pulverschlag flog auf und warf die Brände bis an uns heran, über uns weg , wir übereilten uns und sind nun unglückliche Leute.
Noch war der Fürst mit Anordnungen beschäftigt, aber einen Augenblick schien alles zu stocken, als oben vom alten Schloß herab eilig ein Mann heranspringend gesehen ward, den man bald für den angestellten Wächter erkannte, der die Werkstätte des Malers bewachte, indem er darin seine Wohnung nahm und die Arbeiter beaufsichtigte.
Er kam außer Atem springend, doch hatte er bald mit wenigen Worten angezeigt: oben hinter der höhern Ringmauer habe sich der Löwe im Sonnenschein gelagert, am Fuße einer hundertjährigen Buche, und verhalte sich ganz ruhig.
Ärgerlich aber schloß der Mann: warum habe ich gestern meine Büchse in die Stadt getragen, um sie ausputzen zu lassen.
Hätte ich sie bei der Hand gehabt, er wäre nicht wieder aufgestanden, das Fell wäre doch mein gewesen, und ich hätte mich dessen, wie billig, zeitlebens gebrüstet.
Der Fürst, dem seine militärischen Erfahrungen auch hier zustatten kamen, da er sich wohl schon in Fällen gefunden hatte, wo von mehreren Seiten unvermeidliches Übel herandrohte, sagte hierauf: welche Bürgschaft gebt Ihr mir, daß, wenn wir Eures Löwen schonen, er nicht im Lande unter den Meinigen Verderben anrichtet?
Hier diese Frau und dieses Kind, erwiderte der Vater hastig, erbieten sich, ihn zu zähmen, ihn ruhig zu erhalten, bis ich den beschlagenen Kasten heraufschaffe, da wir ihn denn unschädlich und unbeschädigt wieder zurückbringen werden.
Der Knabe schien seine Flöte versuchen zu wollen, ein Instrument von der Art, das man sonst die sanfte, süße Flöte zu nennen pflegte, sie war kurz geschnäbelt wie die Pfeifen, wer es verstand, wußte die anmutigsten Töne daraus hervorzulocken.
Indes hatte der Fürst den Wärtel gefragt, wie der Löwe hinaufgekommen.
Dieser aber versetzte: durch den Hohlweg, der, auf beiden Seiten vermauert, von jeher der einzige Zugang war und der einzige bleiben soll, zwei Fußpfade, die noch hinaufführten, haben wir dergestalt entstellt, daß niemand als durch jenen ersten engen Anweg zu dem Zauberschlosse gelangen könne, wozu es Fürst Friedrichs Geist und Geschmack ausbilden will.
Nach einigem Nachdenken, wobei sich der Fürst nach dem Kinde umsah, das immer sanft gleichsam zu präludieren fortgefahren hatte, wendete er sich zu Honorio und sagte: du hast heute viel geleistet, vollende das Tagwerk.
Besetze den schmalen Weg.
- Haltet eure Büchsen bereit, aber schießt nicht eher, als bis ihr das Geschöpf nicht sonst zurückscheuchen könnt, allenfalls macht ein Feuer an, vor dem er sich fürchtet, wenn er herunter will.
Mann und Frau möge für das übrige stehen.
Eilig schickte Honorio sich an, die Befehle zu vollführen.
Das Kind verfolgte seine Melodie, die keine war, eine Tonfolge ohne Gesetz, und vielleicht eben deswegen so herzergreifend, die Umstehenden schienen wie bezaubert von der Bewegung einer liederartigen Weise, als der Vater mit anständigem Enthusiasmus zu reden anfing und fortfuhr: Gott hat dem Fürsten Weisheit gegeben und zugleich die Erkenntnis, daß alle Gotteswerke weise sind, jedes nach seiner Art.
Seht den Felsen, wie er fest steht und sich nicht rührt, der Witterung trotzt und dem Sonnenschein.
Uralte Bäume zieren sein Haupt, und so gekrönt schaut er weit umher, stürzt aber ein Teil herunter, so will es nicht bleiben, was es war: es fällt zertrümmert in viele Stücke und bedeckt die Seite des Hanges.
Aber auch da wollen sie nicht verharren, mutwillig springen sie tief hinab, der Bach nimmt sie auf, zum Flusse trägt er sie.
Nicht widerstehend, nicht widerspenstig, eckig, nein, glatt und abgerundet gewinnen sie schneller ihren Weg und gelangen von Fluß zu Fluß, endlich zum Ozean, wo die Riesen in Scharen daherziehen und in der Tiefe die Zwerge wimmeln.
Doch wer preist den Ruhm des Herrn, den die Sterne loben von Ewigkeit zu Ewigkeit.
Warum seht ihr aber im Fernen umher?
Betrachtet hier die Biene.
Noch spät im Herbst sammelt sie emsig und baut sich ein Haus, winkel- und waagerecht, als Meister und Geselle.
Schaut die Ameise da.
Sie kennt ihren Weg und verliert ihn nicht, sie baut sich eine Wohnung aus Grashalmen, Erdbröslein und Kiefernadeln, sie baut es in die Höhe und wölbet es zu, aber sie hat umsonst gearbeitet, denn das Pferd stampft und scharrt alles auseinander.
Sehr hin.
Es zertritt ihre Balken und zerstreut ihre Planken, ungeduldig schnaubt es und kann nicht rasten, denn der Herr hat das Roß zum Gesellen des Windes gemacht und zum Gefährten des Sturmes, daß es den Mann dahin trage, wohin er will, und die Frau, wohin sie begehrt.
Aber im Palmenwald trat er auf, der Löwe, ernsten Schrittes durchzog er die Wüste, dort herrscht er über alles Getier, und nichts widersteht ihm.
Doch der Mensch weiß ihn zu zähmen, und das grausamste der Geschöpfe hat Ehrfurcht vor dem Ebenbilde Gottes, wornach auch die Engel gemacht sind, die dem Herrn dienen und seinen Dienern.
Denn in der Löwengrube scheute sich Daniel nicht, er blieb fest und getrost, und das wilde Brüllen unterbrach nicht seinen frommen Gesang.
Diese mit dem Ausdruck eines natürlichen Enthusiasmus gehaltene Rede begleitete das Kind hie und da mit anmutigen Tönen, als aber der Vater geendigt hatte, fing es mit reiner Kehle, heller Stimme und geschickten Läufen zu intonieren an, worauf der Vater die Flöte ergriff, im Einklang sich hören ließ, das Kind aber sang: aus den Gruben, hier im Graben hör ich des Propheten Sang, Engel schweben, ihn zu laben, wäre da dem Guten bang?
Löw und Löwin, hin und wider, schmiegen sich um ihn heran, ja, die sanften, frommen Lieder habens ihnen angetan. Der Vater fuhr fort, die Strophe mit der Flöte zu begleiten, die Mutter trat hie und da als zweite Stimme mit ein.
Eindringlich aber ganz besonders war, daß das Kind die Zeilen der Strophe nunmehr zu anderer Ordnung durcheinander schob und dadurch, wo nicht einen neuen Sinn hervorbrachte, doch das Gefühl in und durch sich selbst aufregend erhöhte.
Engel schweben auf und nieder, uns in Tönen zu erlaben, welch ein himmlischer Gesang .
In den Gruben, in dem Graben wäre da dem Kinde bang ?
Diese sanften, frommen Lieder lassen Unglück nicht heran, Engel schweben hin und wider, und so ist es schon getan.
Hierauf mit Kraft und Erhebung begannen alle drei: denn der Ewge herrscht auf Erden, über Meere herrscht sein Blick, Löwen sollen Lämmer werden, und die Welle schwankt zurück.
Blankes Schwert erstarrt im Hiebe, Glaub und Hoffnung sind erfüllt, wundertätig ist die Liebe, die sich im Gebet enthüllt.
Alles war still, hörte, horchte, und nur erst, als die Töne verhallten, konnte man den Eindruck bemerken und allenfalls beobachten.
Alles war wie beschwichtigt, jeder in seiner Art gerührt.
Der Fürst, als wenn er erst jetzt das Unheil übersähe, das ihn vor kurzem bedroht hatte, blickte nieder auf seine Gemahlin, die, an ihn gelehnt, sich nicht versagte, das gestickte Tüchlein hervorzuziehen und die Augen damit zu bedecken.
Es tat ihr wohl, die jugendliche Brust von dem Druck erleichtert zu fühlen, mit dem die vorhergehenden Minuten sie belastet hatten.
Eine vollkommene Stille beherrschte die Menge, man schien die Gefahren vergessen zu haben, unten den Brand und von oben das Erstehen eines bedenklich ruhenden Löwen.
Durch einen Wink, die Pferde näher herbeizuführen, brachte der Fürst zuerst wieder in die Gruppe Bewegung, dann wendete er sich zu dem Weibe und sagte: Ihr glaubt also, daß Ihr den entsprungenen Löwen, wo Ihr ihn antrefft, durch Euren Gesang, durch den Gesang dieses Kindes, mit Hülfe dieser Flötentöne beschwichtigen und ihn sodann unschädlich sowie unbeschädigt in seinem Verschluß wieder zurückbringen könntet? Sie bejahten es, versichernd und beteuernd, der Kastellan wurde ihnen als Wegweiser zugegeben.
Nun entfernte der Fürst mit wenigen sich eiligst, die Fürstin folgte langsamer mit dem übrigen Gefolge, Mutter aber und Sohn stiegen, von dem Wärtel, der sich eines Gewehrs bemächtigt hatte, begleitet, steiler gegen den Berg hinan.
Vor dem Eintritt in den Hohlweg, der den Zugang zu dem Schloß eröffnete, fanden sie die Jäger beschäftigt, dürres Reisig zu häufen, damit sie auf jeden Fall ein großes Feuer anzünden könnten.
Es ist nicht not, sagte die Frau, es wird ohne das alles in Güte geschehen.
Weiter hin, auf einem Mauerstücke sitzend, erblickten sie Honorio, seine Doppelbüchse in den Schoß gelegt, auf einem Posten als wie zu jedem Ereignis gefaßt.
Aber die Herankommenden schien er kaum zu bemerken, er saß wie in tiefen Gedanken versunken, er sah umher wie zerstreut.
Die Frau sprach ihn an mit Bitte, das Feuer nicht anzünden zu lassen, er schien jedoch ihrer Rede wenig Aufmerksamkeit zu schenken.
Sie redete lebhaft fort und rief: schöner junger Mann, du hast meinen Tiger erschlagen, ich fluche dir nicht, schone meinen Löwen, guter junger Mann.
Ich segne dich.
Honorio schaute gerad vor sich hin, dorthin, wo die Sonne auf ihrer Bahn sich zu senken begann.
Du schaust nach Abend, rief die Frau, du tust wohl daran, dort gibts viel zu tun, eile nur, säume nicht, du wirst überwinden.
Aber zuerst überwinde dich selbst. Hierauf schien er zu lächeln, die Frau stieg weiter, konnte sich aber nicht enthalten, nach dem Zurückbleibenden nochmals umzublicken, eine rötliche Sonne überschien sein Gesicht, sie glaubte nie einen schöhern Jüngling gesehen zu haben.
Wenn Euer Kind, sagte nunmehr der Wärtel, flötend und singend, wie Ihr überzeugt seid, den Löwen anlocken und beruhigen kann, so werden wir uns desselben sehr leicht bemeistern, da sich das gewaltige Tier ganz nah an die durchbrochenen Gewölbe hingelagert hat, durch die wir, da das Haupttor verschüttet ist, einen Eingang in den Schloßhof gewonnen haben.
Lockt ihn das Kind hinein, so kann ich die Öffnung mit leichter Mühe schließen, und der Knabe, wenn es ihm gut deucht, durch eine der kleinen Wendeltreppen, die er in der Ecke sieht, dem Tiere entschlüpfen.
Wir wollen uns verbergen, aber ich werde mich so stellen, daß meine Kugel jeden Augenblick dem Kinde zu Hülfe kommen kann.
Die Umstände sind alle nicht nötig, Gott und Kunst, Frömmigkeit und Glück müssen das Beste tun.
- Es sei, versetzte der Wärtel, aber ich kenne meine Pflichten.
Erst führ ich Euch durch einen beschwerlichen Stieg auf das Gemäuer hinauf, gerade dem Eingang gegenüber, den ich erwähnt habe, das Kind mag hinabsteigen, gleichsam in die Arena des Schauspiels, und das besänftigte Tier dort hereinlocken. Das geschah, Wärtel und Mutter sahen versteckt von oben herab, wie das Kind die Wendeltreppen hinunter in dem klaren Hofraum sich zeigte und in der düstern Öffnung gegenüber verschwand, aber sogleich seinen Flötenton hören ließ, der sich nach und nach verlor und verstummte.
Die Pause war ahnungsvoll genug, den alten, mit Gefahr bekannten Jäger beengte der seltene menschliche Fall.
Er sagte sich, daß er lieber persönlich dem gefährlichen Tiere entgegenginge, die Mutter jedoch, mit heiterem Gesicht, übergebogen horchend, ließ nicht die mindeste Unruhe bemerken.
Endlich hörte man die Flöte wieder, das Kind trat aus der Höhle hervor mit glänzend befriedigten Augen, der Löwe hinter ihm drein, aber langsam und, wie es schien, mit einiger Beschwerde.
Er zeigte hie und da Lust, sich niederzulegen, doch der Knabe führte ihn im Halbkreise durch die wenig entblätterten, buntbelaubten Bäume, bis er sich endlich in den letzten Strahlen der Sonne, die sie durch eine Ruinenlücke hereinsandte, wie verklärt niedersetzte und sein beschwichtigendes Lied abermals begann, dessen Wiederholung wir uns auch nicht entziehen können: aus den Gruben, hier im Graben hör ich des Propheten Sang, Engel schweben, ihn zu laben, wäre da dem Guten bang?
Löw und Löwin, hin und wider, schmiegen sich um ihn heran, ja, die sanften, frommen Lieder habens ihnen angetan. Indessen hatte sich der Löwe ganz knapp an das Kind hingelegt und ihm die schwere rechte Vordertatze auf dem Schoß gehoben, die der Knabe fortsingend anmutig streichelte, aber gar bald bemerkte, daß ein scharfer Dornzweig zwischen die Ballen eingestochen war.
Sorgfältig zog er die verletzende Spitze hervor, nahm lächelnd sein buntseidenes Halstuch vom Nacken und verband die greuliche Tatze des Untiers, sodaß die Mutter sich vor Freuden mit ausgestreckten Armen zurückbog und vielleicht angewohnterweise Beifall gerufen und geklatscht hätte, wäre sie nicht durch einen derben Faustgriff des Wärtels erinnert worden, daß die Gefahr nicht vorüber sei.
Glorreich sang das Kind weiter, nachdem es mit wenigen Tönen vorgespielt hatte: denn der Ewge herrscht auf Erden, über Meere herrscht sein Blick, Löwen sollen Lämmer werden, und die Welle schwankt zurück.
Blankes Schwert erstarrt im Hiebe, Glaub und Hoffnung sind erfüllt, wundertätig ist die Liebe, die sich im Gebet enthüllt.
Ist es möglich zu denken, daß man in den Zügen eines so grimmigen Geschöpfes, des Tyrannen der Wälder, des Despoten des Tierreiches, einen Ausdruck von Freundlichkeit, von dankbarer Zufriedenheit habe spüren können, so geschah es hier, und wirklich sah das Kind in seiner Verklärung aus wie ein mächtiger, siegreicher Überwinder, jener zwar nicht wie der Überwundene, denn seine Kraft blieb in ihm verborgen, aber doch wie der Gezähmte, wie der dem eigenen friedlichen Willen Anheimgegebene.
Das Kind flötete und sang so weiter, nach seiner Art die Zeilen verschränkend und neue hinzufügend: und so geht mit guten Kindern selger Engel gern zu Rat, böses Wollen zu verhindern, zu befördern schöne Tat.
So beschwören, fest zu bannen liebem Sohn ans zarte Knie ihn, des Waldes Hochtyrannen, frommer Sinn und Melodie.
`
},
// {
//     title: 'new',
//     content: 
// `\\cnew
// `
// },

] 
    }

}
module.exports = { FileUploadUI }

},{"./dom-utils":2,"./m32-communication-service":4,"loglevel":19}],11:[function(require,module,exports){
'use strict';

const log  = require ('loglevel');

const { createElement } = require('./dom-utils');
const ReRegExp = require('reregexp').default;
const { EVENT_SETTINGS_CHANGED } = require('./m32-storage');
const { EVENT_M32_TEXT_RECEIVED } = require('./m32-communication-service');

const QSO_WAIT_TIME_MS = 2000; // wait ms after receiving 'kn' to answer

class QsoTrainerUI {

    constructor(m32CommunicationService, m32Storage) {

        this.m32CommunicationService = m32CommunicationService;
        this.m32CommunicationService.addEventListener(EVENT_M32_TEXT_RECEIVED, this.textReceived.bind(this));

        this.m32Storage = m32Storage;
        this.m32Storage.addEventListener(EVENT_SETTINGS_CHANGED, this.settingsChanged.bind(this));


        this.receiveTextQsoTrainer = document.getElementById("receiveTextQsoTrainer");
        this.clearQsoTrainerButton = document.getElementById("clearQsoTrainerButton");
        this.autoKeyQsoTrainerButton = document.getElementById("autoKeyQsoTrainerButton");
        this.qsoMessages = document.getElementById("qsoMessages");
        this.inputTextQsoTrainer = document.getElementById("inputTextQsoTrainer");
        this.inputTextQsoTrainerButton = document.getElementById("inputTextQsoTrainerButton");
        this.clearInputTextQsoTrainerButton = document.getElementById("clearInputTextQsoTrainerButton");
        this.qsoWpmSelect = document.getElementById("qsoWpmSelect");
        this.qsoEwsSelect = document.getElementById("qsoEwsSelect");
        this.qsoElsSelect = document.getElementById("qsoElsSelect");
        this.qsoRptWordsCheckbox = document.getElementById("qsoRptWordsCheckbox");
        this.testCwSettingsPlayButton = document.getElementById("testCwSettingsPlayButton");
        this.testCwSettingsStopButton = document.getElementById("testCwSettingsStopButton");
        this.testCwSettingsText = document.getElementById("testCwSettingsText");

        this.autoQsoCallsign;
        this.autoQsoCallsignBot;
        this.autoQsoMessages;
        this.qsoCallSign;
        this.qsoName;
        this.qsoQth;
        this.qsoCallSignBot;
        this.autoKeyQsoIndex;
        this.qsoRptWords = this.qsoRptWordsCheckbox.checked;
        this.clearQsoTrainerFields();

        // eslint-disable-next-line no-undef
        this.cwPlayer = new jscw(); // FIXME: create later???
        this.cwPlayerWpm; // wpm
        this.cwPlayerEws; // extended word spacing
        this.cwPlayerEls; // extended letter spacing: effective speed

        this.clearQsoTrainerButton.addEventListener('click', this.clearQsoTrainerFields.bind(this));
        this.autoKeyQsoTrainerButton.addEventListener('click', this.autoKeyQso.bind(this));
        this.inputTextQsoTrainerButton.addEventListener('click', this.moveQsoInputTextToMessages.bind(this));
        this.clearInputTextQsoTrainerButton.addEventListener('click', function() {
            this.inputTextQsoTrainer.value = '';
        });
        this.qsoRptWordsCheckbox.addEventListener('change', event => {
            console.log(event);
            this.qsoRptWords = event.target.checked;
            console.log('qsoRptWords', this.qsoRptWords);
            this.setCwSettingsInUILabels();
            this.saveSettings();
        });
        this.qsoWpmSelect.addEventListener('change', event => {
            this.cwPlayerWpm = event.target.value;
            this.setCwPlayerSettings();
            this.setCwSettingsInUILabels();
            this.saveSettings();
        });
        this.qsoEwsSelect.addEventListener('change', event => {
            this.cwPlayerEws = event.target.value;
            this.setCwPlayerSettings();
            this.setCwSettingsInUILabels();
            this.saveSettings();
        });
        this.qsoElsSelect.addEventListener('change', event => {
            this.cwPlayerEls = event.target.value;
            this.setCwPlayerSettings();
            this.setCwSettingsInUILabels();
            this.saveSettings();
        });

        this.cwPlayerIsPlaying = false;
        this.cwPlayer.onPlay = function(event) {
            console.log('player play event received', event);
            this.cwPlayerIsPlaying = true;
        }
        this.cwPlayer.onFinished = function(event) {
            console.log('player finished event received', event);
            this.cwPlayerIsPlaying = false;
        }

        this.testCwSettingsPlayButton.addEventListener('click', () => {
            this.playCw(this.testCwSettingsText.value);
        });
        this.testCwSettingsStopButton.addEventListener('click', () => {
            this.cwPlayer.stop();
        });
        

        this.endOfMessageDetected = false;
        
        this.activeMode = false;
    }

    textReceived(value) {
        if (this.activeMode) {
            log.debug("qso trainer received text", value);
            this.receiveTextQsoTrainer.value += value;
            this.receiveTextQsoTrainer.scrollTop = this.receiveTextQsoTrainer.scrollHeight;
            this.detectQso();    
        }
    }

    modeSelected(mode) {
        this.activeMode = mode === "qso-trainer";
        log.debug("qso trainer active", this.activeMode, mode);
    }


    detectQso() {
        this.endOfMessageDetected = false;
        let text = this.receiveTextQsoTrainer.value;
        log.debug('detecteQso', "'" + text + "'");
        if (text.endsWith(' kn ') || text.endsWith(' <kn> ') 
            || text.endsWith('e e ')
            || text.endsWith(' bk ') || text.endsWith(' <bk> ') 
            || text.endsWith(' k ')) {
            this.endOfMessageDetected = true;
            //console.log('detecteQso: end of message detected', endOfMessageDetected)
            setTimeout(() => { this.detectQsoMessageEnded() }, QSO_WAIT_TIME_MS);
        }
    }

    detectQsoMessageEnded() {
        console.log('detectQsoMessageEnded, endOfMessageDetected=', this.endOfMessageDetected)
        if (this.endOfMessageDetected) {
            //console.log('really answerQso')
            let message = this.receiveTextQsoTrainer.value;
            console.log('last message:', message);
            this.displayQsoMessage('Your message: ' + message, false);
            this.receiveTextQsoTrainer.value = '';
            this.answerQso(message);
        }
    }

    answerQso(message) {
        let answer = this.createQsoAnswer(message);
        this.playCw(answer);
        this.displayQsoMessage(answer, true);
    }

    duplicateWords(text) {
        let result = '';
        let words = text.split(' ');
        let lastWord = '';
        // dupliate all words, except when they are already duplicated in the message
        for (let index = 0; index < words.length; index++) {
            let word = words[index];
            if (word !== lastWord) {
                result += word + ' ' + word + ' ';
            } else {
                lastWord = ''; // if there are more than 2 repetitions in the text, use them!
            }
            lastWord = word;
        }
        console.log('duplicate words: ', text, result);
        return result.trim();
    }

    displayQsoMessage(message, isAnswer) {
        let htmlMessage = message.replace(/\n/g, '<br/>');
        let answerElement;
        if (isAnswer) {
            answerElement = this.createAnswerElement(htmlMessage)        
        } else {
            answerElement = createElement(htmlMessage, 'p', 'qso-request')
        }
        //console.log('adding element', answerElement);
        this.qsoMessages.appendChild(answerElement);
    }

    playCw(message) {
        message = message.replace(/\n/g, ' ');
        let messageToPlay = message;
        if (this.qsoRptWords) {
            messageToPlay = this.duplicateWords(message);
        }
        if (this.cwPlayerIsPlaying) {
            this.cwPlayer.stop(); // stop any message that is currently played
        }
        this.cwPlayer.play(messageToPlay);
    }

    moveQsoInputTextToMessages() {
        let message = this.inputTextQsoTrainer.value;
        let htmlMessage = message.replace(/\n/g, '<br/>');
        let answerElement = createElement(htmlMessage, 'span', 'qso-answer');

        let col1 = createElement(null, 'div', 'col-12 col-md-12');
        col1.appendChild(answerElement);
        
        let row = createElement(null, 'div', 'row');
        row.appendChild(col1);
        
        this.qsoMessages.appendChild(row);

        this.inputTextQsoTrainer.value = '';
    }


    createAnswerElement(message) {

        var that = this;

        let answerElement = createElement(message, 'p', 'qso-answer unreadable')

        let showButton = createElement('Show', 'button', 'btn btn-outline-primary btn-sm qso-answer-button');
        showButton.setAttribute('type', 'button');
        showButton.setAttribute('data-toggle', 'tooltip');
        showButton.setAttribute('title', 'Show/hide text of answer.')
        showButton.onclick = ( function(_targetElement, _buttonElement) { 
            return function() { 
                _targetElement.classList.toggle('unreadable');
                if (_targetElement.classList.contains('unreadable')) {
                    _buttonElement.textContent = 'Show';
                } else {
                    _buttonElement.textContent = 'Hide';
                }
            }
        })(answerElement, showButton);

        let replayButton = createElement('Rpt', 'button', 'btn btn-outline-success btn-sm qso-answer-button');
        replayButton.setAttribute('type', 'button');
        replayButton.setAttribute('data-toggle', 'tooltip');
        replayButton.setAttribute('title', 'Replay cw code.')
        // https://stackoverflow.com/questions/19624113/how-can-i-use-a-class-method-as-onclick-handler-in-javascript
        replayButton.onclick = ( function(_message) { 
            return function() {
                that.playCw(_message);
            }
        })(message.replace(/<br\/>/g, ' '));
        // eslint-disable-next-line no-undef
        new bootstrap.Tooltip(replayButton, { trigger : 'hover' });

        let stopButton = createElement('Stop', 'button', 'btn btn-outline-danger btn-sm qso-answer-button');
        stopButton.setAttribute('type', 'button');
        stopButton.setAttribute('data-toggle', 'tooltip');
        stopButton.setAttribute('title', 'Stop cw player.')
        stopButton.onclick = ( function() { 
            return function() { 
                that.cwPlayer.stop();
            }
        })();
        let pauseButton = createElement('Pause', 'button', 'btn btn-outline-warning btn-sm qso-answer-button');
        pauseButton.setAttribute('type', 'button');
        pauseButton.setAttribute('data-toggle', 'tooltip');
        pauseButton.setAttribute('title', 'Pause cw player.')
        pauseButton.onclick = ( function() { 
            return function() { 
                that.cwPlayer.pause();
            }
        })();
        
        let messageColumn = createElement(null, 'div', 'col-12 col-md-9');
        messageColumn.appendChild(answerElement);
        let buttonColumn = createElement(null, 'div', 'col-12 col-md-3');
        buttonColumn.appendChild(showButton);
        buttonColumn.appendChild(replayButton);
        buttonColumn.appendChild(stopButton);
        buttonColumn.appendChild(pauseButton);

        let row = createElement(null, 'div', 'row');
        row.appendChild(messageColumn);
        row.appendChild(buttonColumn);
        
        return row;
    }

    createQsoAnswer(message) {
        console.log('message:', message);
        let answer = '';
        let shouldAppendEndOfMessage = true;
        let isIntro = false;
        let textDetected = false;
        let qthDetected = false;
    
        // CQ CQ CQ de .... 
        this.executeIfMatch(message, /.*cq.*\s+de\s+(\w+)/, answer, (groups) => { 
            this.qsoCallSign = groups[0];
            this.qsoCallSignBot = this.generateCallSign();
            this.autoQsoCallsign = this.qsoCallSign;
            this.autoQsoCallsignBot = this.qsoCallSignBot;
            this.generateAutoQsoMessages();
            answer = this.appendToMessage(answer, this.qsoCallSign + ' de ' + this.qsoCallSignBot + ' ' + this.qsoCallSignBot + ' pse k');
            shouldAppendEndOfMessage = false;
            isIntro = true;
            textDetected = true;
            console.log('matched cq, answer:', answer);
        });
        console.log('isIntro', isIntro);
        if (!isIntro) {
            answer = this.appendToMessage(answer, 'r r ' + this.qsoCallSign + ' de ' + this.qsoCallSignBot);        
        }
        this.executeIfMatch(message, /.*(gm|ga|ge)\s(om|yl)/, answer, (groups) => { 
            answer = this.appendToMessage(answer, groups[0]); // do not reply with 'om' or 'yl' because we do not know if om or yl!
            textDetected = true;
            console.log('matched gm/ga/ge, answer:', answer);
        });
        // eslint-disable-next-line no-unused-vars
        this.executeIfMatch(message, /.*rst\sis\s(\w+)/, answer, (groups) => { 
            var rst = this.getRandom('555', '569', '579', '589', '599');
            answer = this.appendToMessage(answer, 'ur rst is ' + rst + ' ' + rst);
            textDetected = true;
            console.log('matched rst, answer:', answer);
        });
        this.executeIfMatch(message, /.*qth\sis\s(\w+)/, answer, (groups) => { 
            this.qsoQth = groups[0];
            qthDetected = true;
            console.log('matched qth:', this.qsoQth);
        });
        this.executeIfMatch(message, /.*\sname\sis\s(\w+)/, answer, (groups) => { 
            this.qsoName = groups[0];
            var name = this.getRandomName();
            if (this.qsoQth === '') {
                answer = this.appendToMessage(answer, 'ok ' + this.qsoName);
            } else {
                answer = this.appendToMessage(answer, 'ok ' + this.qsoName + ' from ' + this.qsoQth);
            }
            answer = this.appendToMessage(answer, 'my name is ' + name + ' ' + name);
            textDetected = true;
            console.log('matched name, answer:', answer);
        });
        this.executeIfMatch(message, /.*\swx\sis\s(\w+)(?:.*temp\s([-]?\d+)\s*c?)?/, answer, (groups) => { 
            let weather = groups[0];
            let temperature = groups[1];
            let temperatureString = '';
            if (temperature !== undefined) {
                temperatureString = ' es temp ' + groups[1] + 'c';
            }
            answer = this.appendToMessage(answer, 'ok ur wx is ' + weather + temperatureString);
            answer = this.appendToMessage(answer, 'my wx is ' + this.getRandomWx());
            textDetected = true;
            console.log('matched wx, answer:', answer);
        });
        if (qthDetected) {
            var qth = this.getRandomQth();
            answer = this.appendToMessage(answer, 'my qth is ' + qth + ' ' + qth);
            textDetected = true;
            console.log('matched qth, answer:', answer);
        }
        // eslint-disable-next-line no-unused-vars
        this.executeIfMatch(message, /.*gb\s(om|yl)/, answer, (groups) => { 
            answer = this.appendToMessage(answer, 'gb ' + this.qsoName + ' 73 es 55');
            textDetected = true;
            console.log('matched gb, answer:', answer);
        });
        // eslint-disable-next-line no-unused-vars
        this.executeIfMatch(message, /(tu|sk) e e/, answer, (groups) => { 
            answer = this.appendToMessage(answer, 'e e');
            shouldAppendEndOfMessage = false;
            textDetected = true;
            console.log('matched tu e e, answer:', answer);
        });
        // eslint-disable-next-line no-unused-vars
        this.executeIfMatch(message, /.*test/, answer, (groups) => { 
            answer = this.appendToMessage(answer, 'test back');
            textDetected = true;
            console.log('matched test, answer:', answer);
        });
    
        if (!textDetected) {
            answer = this.appendToMessage(answer, 'pse rpt kn'); // did not understand!
        } else if (shouldAppendEndOfMessage) {
            answer = this.appendToMessage(answer, this.qsoCallSign + ' de ' + this.qsoCallSignBot + ' ' + this.getRandom('pse kn', 'kn'));
        }
    
        return answer;
    }
    
    executeIfMatch(message, regexp, answer, callback) {
        var result = message.match(regexp);
        if (result) {
            result.shift(); // remove matching string, only return groups (if any)
            return callback(result, answer);
        }
    }
    
    appendToMessage(message, textToAppend) {
        if (!message || message.length == 0) {
            message = textToAppend;
        } else {
            message += ' =\n' + textToAppend;
        }
        return message;
    }
    
    generateCallSign() {
        return new ReRegExp(this.getRandomCallsignRegexp()).build();
    }
    
    getRandomCallsignRegexp() {
        return this.getRandom(
            /1[ABS][0-9][A-Z]{2,3}/,
            /2[A-Z][0-9][A-Z]{2,3}/,
            /3D[A-Z][0-9][A-Z]{2}/,
            /3[A-Z][0-9][A-Z]{2,3}/,
            /4[A-Z][0-9][A-Z]{2,3}/,
            /5[A-Z][0-9][A-Z]{2,3}/,
            /6[A-Z][0-9][A-Z]{2,3}/,
            /7[A-Z][0-9][A-Z]{2,3}/,
            /8[A-Z][0-9][A-Z]{2,3}/,
            /9[A-Z][0-9][A-Z]{2,3}/,
            /A[A-Z][0-9][A-Z]{2,3}/,
            /A[2-9][A-Z]{3}/,
            /B[A-Z][0-9][A-Z]{2,3}/,
            /B[2-9][A-Z]{3}/,
            /C[A-Z][0-9][A-Z]{2,3}/,
            /C[0-9][A-Z]{3}/,
            /D[A-Z][0-9][A-Z]{2,3}/,
            /D[0-9][A-Z]{3}/,
            /E[A-Z][0-9][A-Z]{2,3}/,
            /E[2-67][A-Z]{3}/,
            /F[0-9][A-Z]{3}/,
            /G[0-9][A-Z]{3}/,
            /H[A-Z][0-9][A-Z]{2,3}/,
            /H[1-9][A-Z]{3}/,
            /I[A-Z][0-9][A-Z]{2,3}/,
            /I[1-9][A-Z]{3}/,
            /I[A-Z][0-9][A-Z]{2,3}/,
            /I[1-9][A-Z]{3}/,
            /J[A-Z][0-9][A-Z]{2,3}/,
            /J[2-8][A-Z]{3}/,
            // /K[0-9][A-Z]/, // special callsign in US
            /K[0-9][A-Z]{3}/,
            /K[A-Z][0-9][A-Z]{2,3}/,
            /L[A-Z][0-9][A-Z]{2,3}/,
            /L[2-8][A-Z]{3}/,
            /M[A-Z][0-9][A-Z]{2,3}/,
            /N[2-9][A-Z]{2,3}/,
            // /N[0-9][A-Z]/, // special callsign in US
            /O[A-Z][0-9][A-Z]{2,3}/,
            /P[A-Z][0-9][A-Z]{2,3}/,
            /P[2-9][A-Z]{3}/,
            /R[0-9][A-Z]{2,3}/,
            /R[A-Z][0-9][A-Z]{2}/,
            /S[A-Z][0-9][A-Z]{2,3}/,
            /S[02-9][A-Z]{3}/,
            /T[A-Z][0-9][A-Z]{2,3}/,
            /T[2-8][A-Z]{3}/,
            /U[A-Z][0-9][A-Z]{3}/,
            /V[A-Z][0-9][A-Z]{2,3}/,
            /V[2-9][A-Z]{2,3}/,
            /W[A-Z]{0,1}[0-9][A-Z]{1,2}/,
            /X[A-Z][0-9][A-Z]{2,3}/,
            /Y[A-Z][0-9][A-Z]{2,3}/,
            /Y[2-9][A-Z]{3}/,
            /Z[A-Z][0-9][A-Z]{2,3}/,
            /Z[238][A-Z]{3}/,
            );
    }
    
    getRandomName() {
        return this.getRandom('frank', 'christof', 'john', 'gerhard', 'manfred', 'steve', 'yuan', 'carl', 'tommy', 
        'andrea', 'sabine', 'karin', 'anja', 'yvonne', 'bob', 'david', 'sophie', 'joseph', 'josef',
        'sam', 'joe', 'laura', 'hank', 'nick', 'alice', 'sarah', 'patrick', 'tom', 'dan', 'alice','cathy',
        'beth', 'liz', 'josh', 'ann', 'anna', 'robert', 'bill', 'mickey', 'alex', 'ed', 'edward',
        'alice', 'emma', 'jolie', 'andy', 'andi', 'samuel', 'pat', 'mike', 'michael','haaken','knut','stine', 'daniel');
    }
    
    getRandomQth() {
        return this.getRandom('graz', 'vienna', 'berlin', 'nyborg', 'paris', 'london', 'kyiv', 'tokyo', 'hamburg', 
        'salzburg', 'linz', 'weyregg', 'boulder', 'hagerstown', 'pittsburg', 'greenville', 
        'charleston', 'bratislava', 'ljubljana', 'zagreb', 'budapest', 'wels', 'bolzano', 'munich',
        'berlin', 'innsbruck', 'marseille', 'barcelona', 'zaragoza', 'madrid', 'lyon', 'geneve',
        'toulouse', 'anvers', 'gent', 'brussels', 'cologne', 'prague', 'monaco', 'milano', 'rome', 'napoli',
        'nice', 'split', 'sarajevo', 'florence', 'cambridge', 'liverpool', 'edinborough', 'manchester',
        'copenhagen', 'oslo');
    }
    
    getRandomWx() {
        let wx = this.getRandom('sun', 'cloudy', 'rain', 'snow', 'fog', 'hot', 'cold', 'sunny', 'raining', 'snowing', 'foggy');
        let minTemp = -20;
        let maxTemp = 35;
        if (wx.startsWith('hot')) {
            minTemp = 0; // in alaska zero degrees might be hot :-)
        }
        if (wx.startsWith('snow')) {
            maxTemp = 5;
        }
        if (wx.startsWith('rain')) {
            minTemp = -2;
        }
        let temp = 'temp ' + Math.round(minTemp + Math.random() * (maxTemp - minTemp)) + 'c'; // -20 to +35 degrees
        return wx + ' ' + temp;
    }
    
    getRandom(...values) {
        let randomIndex = Math.random() * values.length | 0;
        return values[randomIndex];
    }
    
    autoKeyQso() {
        if (this.autoKeyQsoIndex == 0) {
            this.resetQsoTrainerFields();
        }
        let message = this.autoQsoMessages[this.autoKeyQsoIndex];
        this.receiveTextQsoTrainer.value = message;
        //Scroll to the bottom of the text field
        this.receiveTextQsoTrainer.scrollTop = this.receiveTextQsoTrainer.scrollHeight;
        this.detectQso();
    
        this.autoKeyQsoIndex++;
        if (this.autoKeyQsoIndex >= this.autoQsoMessages.length) {
            this.autoKeyQsoIndex = 0;
        }
    }
    
    generateAutoQsoMessages() {
        let deText = this.autoQsoCallsignBot + ' de ' + this.autoQsoCallsign;
        let name = this.getRandomName();
        this.autoQsoMessages = [
            'cq cq cq de ' + this.autoQsoCallsign + ' ' + this.autoQsoCallsign + ' pse k <kn> ', 
            deText + ' =\n' + this.getRandom('gm', 'ge') + ' = \nur rst is 599 5nn = hw ?\n' + deText + ' kn ',
            deText + ' =\nmy name is ' + name + ' ' + name + ' =\n' + deText + ' kn ',
            deText + ' =\nmy qth is ' + this.getRandomQth() + ' =\n' + deText + ' kn ',
            deText + ' =\nmy wx is ' + this.getRandomWx() +' =\n' + deText + ' kn ',
        ];
    }
    
    clearQsoTrainerFields() {
        this.receiveTextQsoTrainer.value = '';
        this.inputTextQsoTrainer.value = '';
        this.qsoMessages.replaceChildren();
        this.resetQsoTrainerFields();
    }
    
    resetQsoTrainerFields() {
        // clean all qso state variables
        this.qsoCallSign = '';
        this.qsoCallSignBot = '';
        this.qsoName = '';
        this.qsoQth = '';
        this.autoKeyQsoIndex = 0;
        this.autoQsoCallsign = this.generateCallSign();
        this.autoQsoCallsignBot = this.generateCallSign();
        this.generateAutoQsoMessages();
    }
    
    saveSettings() {
        this.m32Storage.settings.cwPlayerWpm = this.cwPlayerWpm;
        this.m32Storage.settings.cwPlayerEws = this.cwPlayerEws;
        this.m32Storage.settings.cwPlayerEls = this.cwPlayerEls;
        this.m32Storage.settings.qsoRptWords = this.qsoRptWords;
        this.m32Storage.saveSettings();
    }

    settingsChanged(settings) {
        log.debug("settings changed event", settings);
        this.cwPlayerWpm = this.m32Storage.settings.cwPlayerWpm;
        this.cwPlayerEws = this.m32Storage.settings.cwPlayerEws;
        this.cwPlayerEls = this.m32Storage.settings.cwPlayerEls;
        this.qsoRptWords = this.m32Storage.settings.qsoRptWords;
        this.setCwSettingsInUIInput();
        this.setCwSettingsInUILabels();
        this.setCwPlayerSettings();
    }

    setCwSettingsInUIInput() {
        document.getElementById('qsoWpmSelect').value = this.cwPlayerWpm;
        document.getElementById('qsoEwsSelect').value = this.cwPlayerEws;
        document.getElementById('qsoElsSelect').value = this.cwPlayerEls;
        this.qsoRptWordsCheckbox.checked = this.qsoRptWords;
    }
    
    setCwSettingsInUILabels() {
        document.getElementById('qsoCwWpmLabel').textContent = this.cwPlayerWpm + 'wpm';
        document.getElementById('qsoCwEwsLabel').textContent = this.cwPlayerEws;
        document.getElementById('qsoCwElsLabel').textContent = this.cwPlayerEls;
        if (this.qsoRptWords) {
            document.getElementById('qsoRptLabel').textContent = 'rpt';
        } else {
            document.getElementById('qsoRptLabel').textContent = 'no rpt';
        }
    }
    
    setCwPlayerSettings() {
        this.cwPlayer.setWpm(this.cwPlayerWpm);
        this.cwPlayer.setEws(this.cwPlayerEws);
        let eff = this.cwPlayerWpm / this.cwPlayerEls;
        this.cwPlayer.setEff(eff);
    }
    

}

module.exports = { QsoTrainerUI }

},{"./dom-utils":2,"./m32-communication-service":4,"./m32-storage":12,"loglevel":19,"reregexp":20}],12:[function(require,module,exports){
'use strict';

const log  = require ('loglevel');

var events = require('events');

const STORAGE_KEY = 'morserino-trainer';
const STORAGE_KEY_SETTINGS = 'morserino-trainer-settings';

const EVENT_SETTINGS_CHANGED = "settings-changed";


class M32Settings {
    constructor() {
        this.cwPlayerWpm = 15;
        this.cwPlayerEws = 0;
        this.cwPlayerEls = 2;
        this.qsoRptWords = false;
        this.voiceOutputEnabled = true;
        this.showCwSchoolGraz = true;
    }

    loadFromStoredSettings(storedSettings) {
        if (storedSettings) {
    
            if ('cwPlayerWpm' in storedSettings) {
                this.cwPlayerWpm = storedSettings.cwPlayerWpm;
            }
            if ('cwPlayerEws' in storedSettings) {
                this.cwPlayerEws = storedSettings.cwPlayerEws;
            }
            if ('cwPlayerEls' in storedSettings) {
                this.cwPlayerEls = storedSettings.cwPlayerEls;
            }
            if ('qsoRptWords' in storedSettings) {
                this.qsoRptWords = storedSettings.qsoRptWords;
            }
            if ('voiceOutputEnabled' in storedSettings) {
                this.voiceOutputEnabled = storedSettings.voiceOutputEnabled;
            }
            if ('showCwSchoolGraz' in storedSettings) {
                this.showCwSchoolGraz = storedSettings.showCwSchoolGraz;
            }

        }
    }
}

class M32Storage {

    constructor() {
        this.settings = new M32Settings();
        this.eventEmitter = new events.EventEmitter();
    }

    addEventListener(eventType, callback) {
        this.eventEmitter.addListener(eventType, callback);
    }

    loadSettings() {
        let storedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS));
        this.settings.loadFromStoredSettings(storedSettings);
        this.eventEmitter.emit(EVENT_SETTINGS_CHANGED, this.settings);
    
        // setCwPlayerSettings();
        // setCwSettingsInUIInput();
        // setCwSettingsInUILabels();
    }
    
    saveSettings() {
        log.debug("save settings", this.settings);
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    }

    getSavedResults() {
        let savedResults = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return savedResults;
    }
    
    saveResults(storedResults) {
        let storedResultsText = JSON.stringify(storedResults);
        localStorage.setItem(STORAGE_KEY, storedResultsText);
        log.debug('Saving result to localStorage', storedResultsText);
    }
}

module.exports = { M32Settings, M32Storage, EVENT_SETTINGS_CHANGED }

},{"events":1,"loglevel":19}],13:[function(require,module,exports){
'use strict';


const { EchoTrainerUI } = require('./m32-echo-trainer-ui');
const { M32ConnectUI } = require('./m32-connect-ui');
const { M32CwGeneratorUI } = require('./m32-cw-generator-ui');
const { QsoTrainerUI } = require('./m32-qso-trainer');
const { M32CommunicationService } = require('./m32-communication-service');
const { M32Storage } = require('./m32-storage');
const { FileUploadUI } = require('./m32-file-upload-ui');
const { CWMemoryUI } = require('./m32-cw-memory-ui');
const KochMorseTutor = require('./koch-morse-tutor');
let log = require("loglevel");
var events = require('events');
const { ConfigurationUI } = require('./m32-configuration-ui');

class M32Main {
    constructor() {
        log.debug("initM32");

        //this.mode = MODE_CW_GENERATOR;

        let m32Storage = new M32Storage();

        let m32CommunicationService = new M32CommunicationService();

        this.m32ConnectUI = new M32ConnectUI(m32CommunicationService, m32Storage);
        this.m32CwGeneratorUI = new M32CwGeneratorUI(m32CommunicationService, m32Storage);
        this.echoTrainerUI = new EchoTrainerUI(m32CommunicationService);
        this.qsoTrainerUI = new QsoTrainerUI(m32CommunicationService, m32Storage);
        this.configurationUI = new ConfigurationUI(m32CommunicationService, document.getElementById('m32-config'));
        this.fileUploadUI = new FileUploadUI(m32CommunicationService);
        this.cwMemoryUI = new CWMemoryUI(m32CommunicationService);

        // Initialize Koch Tutor
        this.kochMorseTutor = new KochMorseTutor({
            speedControlElement: document.getElementById('kochSpeedControl'),
            farnsworthToggleElement: document.getElementById('farnsworthToggle'),
            farnsworthSpeedElement: document.getElementById('farnsworthSpeed'),
            displayElement: document.getElementById('kochDisplay'),
            currentCharElement: document.getElementById('currentChar'),
            groupResultElement: document.getElementById('groupResult'),
            speedDisplayElement: document.getElementById('kochSpeedDisplay')
        });

        m32Storage.loadSettings();

        //document.getElementById("versionSpan").textContent = VERSION;

        this.eventEmitter = new events.EventEmitter();
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.echoTrainerUI.modeSelected.bind(this.echoTrainerUI));
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.m32CwGeneratorUI.modeSelected.bind(this.m32CwGeneratorUI));
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.qsoTrainerUI.modeSelected.bind(this.qsoTrainerUI));
        //this.eventEmitter.addListener(EVENT_MODE_SELECTED, this.kochMorseTutor.modeSelected.bind(this.kochMorseTutor));

        // enable bootstrap tooltips everywhere:    
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            // eslint-disable-next-line no-undef
            return new bootstrap.Tooltip(tooltipTriggerEl, { trigger : 'hover' });
        });    

        /*for (let tabElement of document.querySelectorAll('button[data-bs-toggle="tab"]')) {
            tabElement.addEventListener('shown.bs.tab', this.tabEventListener.bind(this));
        }*/

        let urlParams = new URLSearchParams(window.location.search);
        let paramMode = urlParams.get('mode');
        if (paramMode) {
            console.log('setting mode from url params:', paramMode);
            this.openTabForMode(paramMode);
        }

        /*if (urlParams.get('debug') !== null) {
            this.m32CwGeneratorUI.setDebug(true);
            this.echoTrainerUI.setDebug(true);
            log.info('debug mode enabled!');
        } else {
            this.m32CwGeneratorUI.setDebug(false);
            this.echoTrainerUI.setDebug(true);
            console.log('debug mode disabled!');
        }*/
        let paramM32Language = urlParams.get('language');
        if (paramM32Language) {
            console.log('setting m32language to ', paramM32Language);
            m32CommunicationService.setLanguage(paramM32Language);
        }

        //console.log(document.getElementById('kochSpeedControl'));

        /*document.getElementById('kochSpeedControl').addEventListener('input', () => {
            //let speedDis = document.getElementById('kochSpeedDisplay');
            let speed = parseInt(document.getElementById('kochSpeedControl').value, 10);
            //speedDis.innerText = speed.value;
            //console.log(speedDis.innerText);
            this.kochMorseTutor.setMorseSpeed(speed);
            //this.kochMorseTutor.startLesson();
        });*/

        // Add event listener for Koch Trainer start button
        document.getElementById('startKochTraining').addEventListener('click', () => {
            const speed = parseInt(document.getElementById('kochSpeedControl').value, 10);
            this.kochMorseTutor.setSpeed(speed);
            this.kochMorseTutor.startLesson();
        });

        // Add event listener for Farnsworth toggle
        /*document.getElementById('farnsworthToggle').addEventListener('change', (event) => {
            this.kochTutor.setFarnsworth(event.target.checked);
        });

        // Add event listener for Farnsworth speed
        document.getElementById('farnsworthSpeed').addEventListener('input', (event) => {
            this.kochTutor.setFarnsworthSpeed(parseInt(event.target.value, 10));
        });*/
    }

    /*tabEventListener(event) {
        let mode = event.target.id.replace('-tab', '');
        this.eventEmitter.emit(EVENT_MODE_SELECTED, mode);
    }*/

    openTabForMode(mode) {
        if (mode === MODE_CW_GENERATOR) {
            document.getElementById('cw-generator-tab').click();
        } else if (mode === MODE_ECHO_TRAINER) {
            document.getElementById('echo-trainer-tab').click();
        } else if (mode === MODE_QSO_TRAINER) {
            document.getElementById('qso-trainer-tab').click();
        } else if (mode === MODE_M32_CONFIG) {
            document.getElementById('m32-config-tab').click();
        } else if (mode === MODE_FILE_UPLOAD) {
            document.getElementById('m32-file-upload-tab').click();
        } else if (mode === MODE_CW_MEMORY) {
            document.getElementById('m32-cw-memory-tab').click();
        } else if (mode === MODE_KOCH_TRAINER) {
            document.getElementById('koch-tab').click();
        } else {
            console.log('Unknown mode: ', mode);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    new M32Main();
}, false);

},{"./koch-morse-tutor":3,"./m32-communication-service":4,"./m32-configuration-ui":5,"./m32-connect-ui":6,"./m32-cw-generator-ui":7,"./m32-cw-memory-ui":8,"./m32-echo-trainer-ui":9,"./m32-file-upload-ui":10,"./m32-qso-trainer":11,"./m32-storage":12,"events":1,"loglevel":19}],14:[function(require,module,exports){
'use strict';

const log  = require ('loglevel');

class M32Translations {

  constructor() {
    this.m32ProtocolFallbackLanguage = 'en';
    this.menuTranslations = this.getMenuTranslations();
    this.configTranslations = this.getConfigTranslations();
    this.characterTranslations = this.getAlphabetTranslations();
  }

  phonetisize(text) {
    return [...text].map(char => this.translateCharacter(char)).join(' '); 
  }

  translateMenu(key, language, languageVariant = '') {
    return this.translate(key, language, languageVariant, this.menuTranslations);
  }

  translateConfig(key, language, languageVariant = '') {
    return this.translate(key, language, languageVariant, this.configTranslations);
  }

  translateCharacter(key) {
    return this.translate(key, this.m32ProtocolFallbackLanguage, '', this.characterTranslations);
  }


  translate(key, language, languageVariant = '', i18nMap) {
    log.debug("Translate key", key, "to language", language);
    var translationMap = i18nMap[key.trim().toLowerCase()];
    if (!translationMap) {
      return key;
    }

    var translation;
    if (languageVariant) {
      translation = translationMap[language + '_' + languageVariant];
      if (translation) {
        return translation;
      }
    }

    translation = translationMap[language];
    if (translation) {
      return translation;
    }
    if (language === this.m32ProtocolFallbackLanguage) {
      return key; // no fallback
    }
    // try fallback language
    return this.translate(key, this.m32ProtocolFallbackLanguage, languageVariant, i18nMap);
  }

  getMenuTranslations() {
      return {
        'koch trainer': {de: 'Koch Trainer'},
          'adapt. rand.': {en: 'Adaptive Random', de: 'Adaptiver Zufall'},
        // koch lessons
        '1 char m':  {en: '1 m', en_speak: '1--mike'},
        '2 char k':  {en: '2 k', en_speak: '2--kilo'},
        '3 char r':  {en: '3 r', en_speak: '3--romeo'},
        '4 char s':  {en: '4 s', en_speak: '4--sierra'},
        '5 char u':  {en: '5 u', en_speak: '5--uniform'},
        '6 char a':  {en: '6 a', en_speak: '6--alpha'},
        '7 char p':  {en: '7 p', en_speak: '7--papa'},
        '8 char t':  {en: '8 t', en_speak: '8--tango'},
        '9 char l':  {en: '9 l', en_speak: '9--lima'},
        '10 char o': {en: '10 o', en_speak: '10--oscar'},
        '11 char w': {en: '11 w', en_speak: '11--whiskey'},
        '12 char i': {en: '12 i', en_speak: '12--india'},
        '13 char .': {en: '13 .', en_speak: '13--dot'},
        '14 char n': {en: '14 n', en_speak: '14--november'},
        '15 char j': {en: '15 j', en_speak: '15--juliet'},
        '16 char e': {en: '16 e', en_speak: '16--echo'},
        '17 char f': {en: '17 f', en_speak: '17--foxtrott'},
        '18 char 0': {en: '18 0', en_speak: '18--0'},
        '19 char y': {en: '19 y', en_speak: '19--yankee'},
        '20 char v': {en: '20 v', en_speak: '20--victor'},
        '21 char ,': {en: '21 ,', en_speak: '21--comma'},
        '22 char g': {en: '22 g', en_speak: '22--golf'},
        '23 char 5': {en: '23 5', en_speak: '23--5'},
        '24 char':   {en: '24 /', en_speak: '24--slash'}, // "/" is used as menu separator
        '25 char q': {en: '25 q', en_speak: '25--quebec'},
        '26 char 9': {en: '26 9', en_speak: '26--9'},
        '27 char z': {en: '27 z', en_speak: '27--zulu'},
        '28 char h': {en: '28 h', en_speak: '28--hotel'},
        '29 char 3': {en: '29 3', en_speak: '29--3'},
        '30 char 8': {en: '30 8', en_speak: '30--8'},
        '31 char b': {en: '31 b', en_speak: '31--bravo'},
        '32 char ?': {en: '32 ?', en_speak: '32--questionmark'},
        '33 char 4': {en: '33 4', en_speak: '33--4'},
        '34 char 2': {en: '34 2', en_speak: '34--2'},
        '35 char 7': {en: '35 7', en_speak: '35--7'},
        '36 char c': {en: '36 c', en_speak: '36--charly'},
        '37 char 1': {en: '37 1', en_speak: '37--1'},
        '38 char d': {en: '38 d', en_speak: '38--delta'},
        '39 char 6': {en: '39 6', en_speak: '39--6'},
        '40 char x': {en: '40 x', en_speak: '40--x-ray'},
        '41 char -': {en: '41 -', en_speak: '41--minus'},
        '42 char =': {en: '42 =', en_speak: '42--='},
        '43 char <sk>': {en: '43 <sk>', en_speak: '43--silent key'},
        '44 char +': {en: '44 +', en_speak: '44--+'},
        '45 char <as>': {en: '45 <as>', en_speak: '45--alpha sierra'},
        '46 char <kn>': {en: '46 <kn>', en_speak: '46--kilo november'},
        '47 char <ka>': {en: '47 <ka>', en_speak: '47--kilo alpha'},
        '48 char <ve>': {en: '48 <ve>', en_speak: '48--victor echo'},
        '49 char <bk>': {en: '49 <bk>', en_speak: '49--bravo kilo'},
        '50 char @': {en: '50 @', en_speak: '50--@'},
        '51 char :': {en: '51 :', en_speak: '51--colon'},
      'cw generator': {de: 'CW Generator'},
        'random': {de: 'Zufall'},
        'cw abbrevs': {en: 'CW Abbreviations', de: 'CW Abkürzungen'},
        'english words': {de: 'Englische Worte'},
        'mixed': {de: 'Gemischt'},
      'select lesson': {de: 'Auswahl Lektion'},
      'learn new chr': {en: 'Learn new Character', de: 'Lerne neue Buchstaben'},
      'echo trainer': {},
        'call signs': {de: 'Rufzeichen'},
        'file player': {de: 'Datei abspielen'},
    'tranceiver': {en: 'Transceiver', de: 'Transceiver'},
      'lora trx': {en: 'Lora Transceiver', de: 'Lora Transceiver'},
      'wifi trx': {en: 'WiFi Transceiver', de: 'WLAN Tranceiver'},
      'icw/ext trx': {en: 'iCW/External Tranceiver', de: 'iCW/Externer Tranceiver'},
    'cw decoder': {},
    'wifi functions': {de: 'WLAN Funktionen'},
      'check wifi': {de: 'WLAN Prüfen'},
      'upload file': {de: 'Datei hochladen'},
      'config wifi': {en: 'Configure Wifi', de: 'Konfiguriere WLAN'},
      'update firmw': {en: 'Update Firmware', de: 'Firmware aktualisieren'},
      'wifi select': {de: 'WLAN auswählen'},
      'disp mac addr': {en: 'Display Mac Address', de: 'Zeige Mac Adresse'},
    'go to sleep': {de: 'Geh Schlafen'},
    'cw keyer': {},
      'ext trx': {en: 'External Transceiver', de: 'Externer Tranceiver'},
    }
  }

  getConfigTranslations() {
    return {
      'paddle polar.': { en: 'Paddle Polarity' },
      'external pol.': { en: 'External Polarity' },
      'curtisb daht%': { en: 'Curtis B Mode dah Timing Percentage' },
      'curtisb ditt%': { en: 'Curtis B Mode dit Timing Percentage' },
      'autochar spc': { en: 'Auto Character Space' },
      'interword spc': { en: 'Inter word Space' },
      'interchar spc': { en: 'Inter character Space' },
      'length rnd gr': { en: 'Length Random Groups' },
      'length abbrev': { en: 'Length Abbreviations' },
      'max # of words': { en: 'Maximum Number of Words' },
      'cw gen displ': { en: 'CW Generator Display' },
      'each word 2x': { en: 'Each Word 2 times' },
      'confrm. tone': { en: 'Confirm Tone' },
      'key ext tx': { en: 'Key External Transmit' },
      'generator tx': { en: 'Generator Transmit' },
      'adaptv. speed': { en: 'Adaptive Speed' },
      'stop<next>rep': { en: 'Stop Next Repeat' },
      // values
      'custom chars': { en: 'Custom Characters' },
      'bc1: r e a': { en: 'BC1: r. e. a' },
    }
  }

  getAlphabetTranslations() {
    return {
      'a': {en: 'alpha'},
      'b': {en: 'beta'},
      'c': {en: 'charly'},
      'd': {en: 'delta'},
      'e': {en: 'echo'},
      'f': {en: 'foxtrott'},
      'g': {en: 'gamma'},
      'h': {en: 'hotel'},
      'i': {en: 'india'},
      'j': {en: 'juliet'},
      'k': {en: 'kilo'},
      'l': {en: 'lima'},
      'm': {en: 'mike'},
      'n': {en: 'november'},
      'o': {en: 'oscar'},
      'p': {en: 'papa'},
      'q': {en: 'quebec'},
      'r': {en: 'romeo'},
      's': {en: 'sierra'},
      't': {en: 'tango'},
      'u': {en: 'uniform'},
      'v': {en: 'victor'},
      'x': {en: 'x-ray'},
      'y': {en: 'yankee'},
      'z': {en: 'zulu}'}
    } 
  }
}

module.exports = { M32Translations }

},{"loglevel":19}],15:[function(require,module,exports){
'use strict';

let log = require("loglevel");

const { M32Translations } = require('./m32protocol-i18n');

// all functions for speech synthesis

class M32CommandSpeechHandler {

    constructor(language = 'en') {
        this.speechSynth = window.speechSynthesis;
        this.language = language;
        this.voice = null;
        this.enabled = true;
        this.m32Translations = new M32Translations(this.language);
        this.speakQueue = [];
        this.disabledTypeMap = new Map();
    }

    speak(text, type = 'none', addToQueue = true) {
        if (!this.enabled) {
            return;
        }
        if (this.disabledTypeMap.has(type)) {
            this.disableVoiceOuputTemporarily(type); // refresh disable state
            return;
        }
        console.log('speak', text);

        if (this.speechSynth.speaking) {
            if (addToQueue && (type === 'message' || type == 'error')) {
                log.debug('push to speak queue', text, type);
                this.speakQueue.push({text, type});
                return;
            } else {
                log.debug("cancel previous speech synthesis");
                this.speechSynth.cancel();
            }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = 1;
        utterance.rate = 1;
        utterance.voice = this.getVoice(this.language);
        utterance.addEventListener('end', this.speakEndEvent.bind(this));
        this.speechSynth.speak(utterance);
    }

    speakEndEvent() {
        if (this.speakQueue.length > 0) {
            let toSpeakObj = this.speakQueue.shift();
            log.debug('shifted from speak queue', this.speakQueue);
            this.speak(toSpeakObj.text, toSpeakObj.type, false);
        }
    }

    getVoice(language) {
        if (this.voice != null) {
            return this.voice;
        }
        //console.log('getting voice for', language);
        var voices = this.speechSynth.getVoices();
        var voice;
        //voices.forEach(v => console.log(v));
        if (language === 'en') {
            voice = voices.find(voice => voice.voiceURI === 'Google UK English Male');
            if (!voice) {
                voice = voices.find(voice => voice.lang.startsWith(language));
            }
        } else if (language === 'de') {
            voice = voices.find(voice => voice.lang.startsWith(language) && voice.voiceURI.startsWith('Google'));
        } else {
            voice = voices.find(voice => voice.lang.startsWith(language));
        }
        //console.log('selected voice', voice);
        this.voice = voice;
        return voice;
    }

    setLanguage(language) {
        this.language = language;
    }

    disableVoiceOuputTemporarily(type) {
        let timeoutId = this.disabledTypeMap.get(type);
        if (timeoutId) {
            // cancel old timeout for type
            //log.debug('Cancel timeout for type ', type, timeoutId);
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            //log.debug('Delete timeout for type ', type);
            this.disabledTypeMap.delete(type);
        }, 1000);
        //log.debug('Add timeout for type ', type);
        this.disabledTypeMap.set(type, timeoutId);
    }

    // callback method for a full json object received
    handleM32Object(jsonObject) {
        log.debug('speech.handleM32Object', jsonObject);
        const keys = Object.keys(jsonObject);
        if (keys && keys.length > 0) {
            const key = keys[0];
            const value = jsonObject[key];
            switch(key) {
                case 'menu':
                    var menues = value['content'].split('/');
                    var textToSpeak = menues.map((menu) => this.m32Translations.translateMenu(menu, this.language, 'speak')).join(' ');
                    this.speak(textToSpeak, 'menu');
                    break;
                case 'control':
                    this.speak(value['name'] + ' ' + value['value'], 'control');
                    break;
                /*    
                case 'activate':
                    this.speak(value['state']);
                    break;
                */
                case 'message':
                    this.speak(value['content'], 'message');
                    break;
                case 'config': {
                    // distinguish between navigation in configuration and manual request of config (returning mapped values):
                    let configName = this.m32Translations.translateConfig(value['name'], this.language, 'speak');
                    let configValue = '';
                    if (value['displayed']) {
                        configValue = this.m32Translations.translateConfig(value['displayed'], this.language, 'speak');
                    } else {
                        if (value['isMapped'] == false) {
                            configValue = value['value'];
                        } else {
                            let mappingIndex = value['value'];
                            configValue = value['mapped values'][mappingIndex];
                        }
                    }
                    this.speak(configName + ' is ' + configValue, 'config');
                    break;
                }
                case 'error':
                    this.speak(value['message'], 'error');
                    break;
                case 'device':
                    this.speak('firmware' + value['firmware'], 'device');
                    break;
                default:
                    console.log('unhandled json key', key);
            }
        } else {
            log.info('cannot handle json', jsonObject);
        }
    }    
}

module.exports = { M32CommandSpeechHandler }

},{"./m32protocol-i18n":14,"loglevel":19}],16:[function(require,module,exports){
'use strict';

// class represents the state of the morserino
class M32State {
    constructor() {
        this.speedWpm = null;
    }
}

// handling state changes on the morserino
class M32CommandStateHandler {

    constructor(m32State) {
        this.m32State = m32State;
    }

    // callback method for a full json object received
    handleM32Object(jsonObject) {
        console.log('uiState.handleM32Object', jsonObject);
        const keys = Object.keys(jsonObject);
        if (keys && keys.length > 0) {
            const key = keys[0];
            const value = jsonObject[key];
            switch(key) {
                case 'control':
                    var controlKey = value['name'];
                    var controlValue = value['value'];
                    if (controlKey === 'speed') {
                        this.receivedM32Speed(controlValue);
                    }
                    break;
                case 'device':
                    console.log('M32 Device:', value);
                    break;
                case 'error':
                    console.log('M32 Error:', value['message']);
                    break;
                //default:
                    //console.log('unhandled json key', key);
            }
        } else {
            console.log('cannot handle json', jsonObject);
        }
    }
    

    receivedM32Speed(speed) {
        this.m32State.speedWpm = Number(speed);
    }
}

module.exports = { M32State, M32CommandStateHandler }


},{}],17:[function(require,module,exports){
'use strict'

let log = require("loglevel");


class M32CommandUIHandler {

    constructor(language = 'en', m32translations) {
        this.m32ProtocolEnabled = false;
        this.language = language;
        this.m32translations = m32translations;
    }

    // callback method for a full json object received
    handleM32Object(jsonObject) {
        log.debug('uiHandler.handleM32Object', jsonObject);
        if (!this.m32ProtocolEnabled) {
            this.m32ProtocolEnabled = true;
            this.enableAllM32ProtocolElements();
            document.dispatchEvent(new Event("m32Connected"));
        }
        const keys = Object.keys(jsonObject);
        if (keys && keys.length > 0) {
            const key = keys[0];
            const value = jsonObject[key];
            switch(key) {
                case 'menu':
                    this.receivedM32Menu(value['content']);
                    break;
                case 'control':
                    var controlKey = value['name'];
                    var controlValue = value['value'];
                    if (controlKey === 'speed') {
                        this.receivedM32Speed(controlValue);
                    }
                    break;            
                case 'kochlesson':
                    this.receivedM32KochLesson(value);
                    break;                        
                }
        } else {
            console.debug('cannot handle json', jsonObject);
        }
    }

    setLanguage(language) {
        this.language = language;
    }
    
    enableAllM32ProtocolElements() {
        log.debug('enable all m32 protocol elements');
        document.querySelectorAll('.m32-protocol').forEach(element => element.classList.add('m32-protocol-enabled'))
    }

    receivedM32Speed(speed) {
        let speedElement = document.getElementById("m32Speed");
        if (speedElement) {
            speedElement.textContent = speed + ' wpm';
        }
    }

    receivedM32Menu(menu) {
        var menues = menu.split('/');
        var textToDisplay = menues.map((menu) => this.m32translations.translateMenu(menu, this.language)).join('/');
        var menuElement = document.getElementById("m32Menu");
        if (menuElement) {
            menuElement.textContent = textToDisplay;
        }

        if (menu.startsWith('Koch Trainer/Select Lesson') && menues.length > 2) {
            var lesson = menues[2].split(' ');
            var kochLessonElement = document.getElementById("m32KochLesson");
            if (kochLessonElement) {
                var value = lesson[0];
                var currentCharacter = lesson[2];
                kochLessonElement.textContent = "Koch " + value + " '" + currentCharacter + "'";
            }
        }

        // FIXME: does not work - use event to publish this?
        // if (menues.length > 1 && menues[1] === 'Echo Trainer') {
        //     openTabForMode(MODE_ECHO_TRAINER);
        // }
    }

    receivedM32KochLesson(kochlesson) {
        var value = kochlesson['value'];
        var characters = kochlesson['characters'];
        var currentCharacter  = characters[value - 1];
        var kochLessonElement = document.getElementById("m32KochLesson");
        if (kochLessonElement) {
            kochLessonElement.textContent = "Koch " + value + " '" + currentCharacter + "'";
        }
    }

}

module.exports = { M32CommandUIHandler } 


},{"loglevel":19}],18:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.Diff = {}));
}(this, (function (exports) { 'use strict';

  function Diff() {}
  Diff.prototype = {
    diff: function diff(oldString, newString) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var callback = options.callback;

      if (typeof options === 'function') {
        callback = options;
        options = {};
      }

      this.options = options;
      var self = this;

      function done(value) {
        if (callback) {
          setTimeout(function () {
            callback(undefined, value);
          }, 0);
          return true;
        } else {
          return value;
        }
      } // Allow subclasses to massage the input prior to running


      oldString = this.castInput(oldString);
      newString = this.castInput(newString);
      oldString = this.removeEmpty(this.tokenize(oldString));
      newString = this.removeEmpty(this.tokenize(newString));
      var newLen = newString.length,
          oldLen = oldString.length;
      var editLength = 1;
      var maxEditLength = newLen + oldLen;
      var bestPath = [{
        newPos: -1,
        components: []
      }]; // Seed editLength = 0, i.e. the content starts with the same values

      var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);

      if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
        // Identity per the equality and tokenizer
        return done([{
          value: this.join(newString),
          count: newString.length
        }]);
      } // Main worker method. checks all permutations of a given edit length for acceptance.


      function execEditLength() {
        for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
          var basePath = void 0;

          var addPath = bestPath[diagonalPath - 1],
              removePath = bestPath[diagonalPath + 1],
              _oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;

          if (addPath) {
            // No one else is going to attempt to use this value, clear it
            bestPath[diagonalPath - 1] = undefined;
          }

          var canAdd = addPath && addPath.newPos + 1 < newLen,
              canRemove = removePath && 0 <= _oldPos && _oldPos < oldLen;

          if (!canAdd && !canRemove) {
            // If this path is a terminal then prune
            bestPath[diagonalPath] = undefined;
            continue;
          } // Select the diagonal that we want to branch from. We select the prior
          // path whose position in the new string is the farthest from the origin
          // and does not pass the bounds of the diff graph


          if (!canAdd || canRemove && addPath.newPos < removePath.newPos) {
            basePath = clonePath(removePath);
            self.pushComponent(basePath.components, undefined, true);
          } else {
            basePath = addPath; // No need to clone, we've pulled it from the list

            basePath.newPos++;
            self.pushComponent(basePath.components, true, undefined);
          }

          _oldPos = self.extractCommon(basePath, newString, oldString, diagonalPath); // If we have hit the end of both strings, then we are done

          if (basePath.newPos + 1 >= newLen && _oldPos + 1 >= oldLen) {
            return done(buildValues(self, basePath.components, newString, oldString, self.useLongestToken));
          } else {
            // Otherwise track this path as a potential candidate and continue.
            bestPath[diagonalPath] = basePath;
          }
        }

        editLength++;
      } // Performs the length of edit iteration. Is a bit fugly as this has to support the
      // sync and async mode which is never fun. Loops over execEditLength until a value
      // is produced.


      if (callback) {
        (function exec() {
          setTimeout(function () {
            // This should not happen, but we want to be safe.

            /* istanbul ignore next */
            if (editLength > maxEditLength) {
              return callback();
            }

            if (!execEditLength()) {
              exec();
            }
          }, 0);
        })();
      } else {
        while (editLength <= maxEditLength) {
          var ret = execEditLength();

          if (ret) {
            return ret;
          }
        }
      }
    },
    pushComponent: function pushComponent(components, added, removed) {
      var last = components[components.length - 1];

      if (last && last.added === added && last.removed === removed) {
        // We need to clone here as the component clone operation is just
        // as shallow array clone
        components[components.length - 1] = {
          count: last.count + 1,
          added: added,
          removed: removed
        };
      } else {
        components.push({
          count: 1,
          added: added,
          removed: removed
        });
      }
    },
    extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
      var newLen = newString.length,
          oldLen = oldString.length,
          newPos = basePath.newPos,
          oldPos = newPos - diagonalPath,
          commonCount = 0;

      while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
        newPos++;
        oldPos++;
        commonCount++;
      }

      if (commonCount) {
        basePath.components.push({
          count: commonCount
        });
      }

      basePath.newPos = newPos;
      return oldPos;
    },
    equals: function equals(left, right) {
      if (this.options.comparator) {
        return this.options.comparator(left, right);
      } else {
        return left === right || this.options.ignoreCase && left.toLowerCase() === right.toLowerCase();
      }
    },
    removeEmpty: function removeEmpty(array) {
      var ret = [];

      for (var i = 0; i < array.length; i++) {
        if (array[i]) {
          ret.push(array[i]);
        }
      }

      return ret;
    },
    castInput: function castInput(value) {
      return value;
    },
    tokenize: function tokenize(value) {
      return value.split('');
    },
    join: function join(chars) {
      return chars.join('');
    }
  };

  function buildValues(diff, components, newString, oldString, useLongestToken) {
    var componentPos = 0,
        componentLen = components.length,
        newPos = 0,
        oldPos = 0;

    for (; componentPos < componentLen; componentPos++) {
      var component = components[componentPos];

      if (!component.removed) {
        if (!component.added && useLongestToken) {
          var value = newString.slice(newPos, newPos + component.count);
          value = value.map(function (value, i) {
            var oldValue = oldString[oldPos + i];
            return oldValue.length > value.length ? oldValue : value;
          });
          component.value = diff.join(value);
        } else {
          component.value = diff.join(newString.slice(newPos, newPos + component.count));
        }

        newPos += component.count; // Common case

        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = diff.join(oldString.slice(oldPos, oldPos + component.count));
        oldPos += component.count; // Reverse add and remove so removes are output first to match common convention
        // The diffing algorithm is tied to add then remove output and this is the simplest
        // route to get the desired output with minimal overhead.

        if (componentPos && components[componentPos - 1].added) {
          var tmp = components[componentPos - 1];
          components[componentPos - 1] = components[componentPos];
          components[componentPos] = tmp;
        }
      }
    } // Special case handle for when one terminal is ignored (i.e. whitespace).
    // For this case we merge the terminal into the prior string and drop the change.
    // This is only available for string mode.


    var lastComponent = components[componentLen - 1];

    if (componentLen > 1 && typeof lastComponent.value === 'string' && (lastComponent.added || lastComponent.removed) && diff.equals('', lastComponent.value)) {
      components[componentLen - 2].value += lastComponent.value;
      components.pop();
    }

    return components;
  }

  function clonePath(path) {
    return {
      newPos: path.newPos,
      components: path.components.slice(0)
    };
  }

  var characterDiff = new Diff();
  function diffChars(oldStr, newStr, options) {
    return characterDiff.diff(oldStr, newStr, options);
  }

  function generateOptions(options, defaults) {
    if (typeof options === 'function') {
      defaults.callback = options;
    } else if (options) {
      for (var name in options) {
        /* istanbul ignore else */
        if (options.hasOwnProperty(name)) {
          defaults[name] = options[name];
        }
      }
    }

    return defaults;
  }

  //
  // Ranges and exceptions:
  // Latin-1 Supplement, 0080–00FF
  //  - U+00D7  × Multiplication sign
  //  - U+00F7  ÷ Division sign
  // Latin Extended-A, 0100–017F
  // Latin Extended-B, 0180–024F
  // IPA Extensions, 0250–02AF
  // Spacing Modifier Letters, 02B0–02FF
  //  - U+02C7  ˇ &#711;  Caron
  //  - U+02D8  ˘ &#728;  Breve
  //  - U+02D9  ˙ &#729;  Dot Above
  //  - U+02DA  ˚ &#730;  Ring Above
  //  - U+02DB  ˛ &#731;  Ogonek
  //  - U+02DC  ˜ &#732;  Small Tilde
  //  - U+02DD  ˝ &#733;  Double Acute Accent
  // Latin Extended Additional, 1E00–1EFF

  var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;
  var reWhitespace = /\S/;
  var wordDiff = new Diff();

  wordDiff.equals = function (left, right) {
    if (this.options.ignoreCase) {
      left = left.toLowerCase();
      right = right.toLowerCase();
    }

    return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
  };

  wordDiff.tokenize = function (value) {
    // All whitespace symbols except newline group into one token, each newline - in separate token
    var tokens = value.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/); // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.

    for (var i = 0; i < tokens.length - 1; i++) {
      // If we have an empty string in the next field and we have only word chars before and after, merge
      if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
        tokens[i] += tokens[i + 2];
        tokens.splice(i + 1, 2);
        i--;
      }
    }

    return tokens;
  };

  function diffWords(oldStr, newStr, options) {
    options = generateOptions(options, {
      ignoreWhitespace: true
    });
    return wordDiff.diff(oldStr, newStr, options);
  }
  function diffWordsWithSpace(oldStr, newStr, options) {
    return wordDiff.diff(oldStr, newStr, options);
  }

  var lineDiff = new Diff();

  lineDiff.tokenize = function (value) {
    var retLines = [],
        linesAndNewlines = value.split(/(\n|\r\n)/); // Ignore the final empty token that occurs if the string ends with a new line

    if (!linesAndNewlines[linesAndNewlines.length - 1]) {
      linesAndNewlines.pop();
    } // Merge the content and line separators into single tokens


    for (var i = 0; i < linesAndNewlines.length; i++) {
      var line = linesAndNewlines[i];

      if (i % 2 && !this.options.newlineIsToken) {
        retLines[retLines.length - 1] += line;
      } else {
        if (this.options.ignoreWhitespace) {
          line = line.trim();
        }

        retLines.push(line);
      }
    }

    return retLines;
  };

  function diffLines(oldStr, newStr, callback) {
    return lineDiff.diff(oldStr, newStr, callback);
  }
  function diffTrimmedLines(oldStr, newStr, callback) {
    var options = generateOptions(callback, {
      ignoreWhitespace: true
    });
    return lineDiff.diff(oldStr, newStr, options);
  }

  var sentenceDiff = new Diff();

  sentenceDiff.tokenize = function (value) {
    return value.split(/(\S.+?[.!?])(?=\s+|$)/);
  };

  function diffSentences(oldStr, newStr, callback) {
    return sentenceDiff.diff(oldStr, newStr, callback);
  }

  var cssDiff = new Diff();

  cssDiff.tokenize = function (value) {
    return value.split(/([{}:;,]|\s+)/);
  };

  function diffCss(oldStr, newStr, callback) {
    return cssDiff.diff(oldStr, newStr, callback);
  }

  function _typeof(obj) {
    "@babel/helpers - typeof";

    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
  }

  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  var objectPrototypeToString = Object.prototype.toString;
  var jsonDiff = new Diff(); // Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
  // dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:

  jsonDiff.useLongestToken = true;
  jsonDiff.tokenize = lineDiff.tokenize;

  jsonDiff.castInput = function (value) {
    var _this$options = this.options,
        undefinedReplacement = _this$options.undefinedReplacement,
        _this$options$stringi = _this$options.stringifyReplacer,
        stringifyReplacer = _this$options$stringi === void 0 ? function (k, v) {
      return typeof v === 'undefined' ? undefinedReplacement : v;
    } : _this$options$stringi;
    return typeof value === 'string' ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), stringifyReplacer, '  ');
  };

  jsonDiff.equals = function (left, right) {
    return Diff.prototype.equals.call(jsonDiff, left.replace(/,([\r\n])/g, '$1'), right.replace(/,([\r\n])/g, '$1'));
  };

  function diffJson(oldObj, newObj, options) {
    return jsonDiff.diff(oldObj, newObj, options);
  } // This function handles the presence of circular references by bailing out when encountering an
  // object that is already on the "stack" of items being processed. Accepts an optional replacer

  function canonicalize(obj, stack, replacementStack, replacer, key) {
    stack = stack || [];
    replacementStack = replacementStack || [];

    if (replacer) {
      obj = replacer(key, obj);
    }

    var i;

    for (i = 0; i < stack.length; i += 1) {
      if (stack[i] === obj) {
        return replacementStack[i];
      }
    }

    var canonicalizedObj;

    if ('[object Array]' === objectPrototypeToString.call(obj)) {
      stack.push(obj);
      canonicalizedObj = new Array(obj.length);
      replacementStack.push(canonicalizedObj);

      for (i = 0; i < obj.length; i += 1) {
        canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, key);
      }

      stack.pop();
      replacementStack.pop();
      return canonicalizedObj;
    }

    if (obj && obj.toJSON) {
      obj = obj.toJSON();
    }

    if (_typeof(obj) === 'object' && obj !== null) {
      stack.push(obj);
      canonicalizedObj = {};
      replacementStack.push(canonicalizedObj);

      var sortedKeys = [],
          _key;

      for (_key in obj) {
        /* istanbul ignore else */
        if (obj.hasOwnProperty(_key)) {
          sortedKeys.push(_key);
        }
      }

      sortedKeys.sort();

      for (i = 0; i < sortedKeys.length; i += 1) {
        _key = sortedKeys[i];
        canonicalizedObj[_key] = canonicalize(obj[_key], stack, replacementStack, replacer, _key);
      }

      stack.pop();
      replacementStack.pop();
    } else {
      canonicalizedObj = obj;
    }

    return canonicalizedObj;
  }

  var arrayDiff = new Diff();

  arrayDiff.tokenize = function (value) {
    return value.slice();
  };

  arrayDiff.join = arrayDiff.removeEmpty = function (value) {
    return value;
  };

  function diffArrays(oldArr, newArr, callback) {
    return arrayDiff.diff(oldArr, newArr, callback);
  }

  function parsePatch(uniDiff) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var diffstr = uniDiff.split(/\r\n|[\n\v\f\r\x85]/),
        delimiters = uniDiff.match(/\r\n|[\n\v\f\r\x85]/g) || [],
        list = [],
        i = 0;

    function parseIndex() {
      var index = {};
      list.push(index); // Parse diff metadata

      while (i < diffstr.length) {
        var line = diffstr[i]; // File header found, end parsing diff metadata

        if (/^(\-\-\-|\+\+\+|@@)\s/.test(line)) {
          break;
        } // Diff index


        var header = /^(?:Index:|diff(?: -r \w+)+)\s+(.+?)\s*$/.exec(line);

        if (header) {
          index.index = header[1];
        }

        i++;
      } // Parse file headers if they are defined. Unified diff requires them, but
      // there's no technical issues to have an isolated hunk without file header


      parseFileHeader(index);
      parseFileHeader(index); // Parse hunks

      index.hunks = [];

      while (i < diffstr.length) {
        var _line = diffstr[i];

        if (/^(Index:|diff|\-\-\-|\+\+\+)\s/.test(_line)) {
          break;
        } else if (/^@@/.test(_line)) {
          index.hunks.push(parseHunk());
        } else if (_line && options.strict) {
          // Ignore unexpected content unless in strict mode
          throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(_line));
        } else {
          i++;
        }
      }
    } // Parses the --- and +++ headers, if none are found, no lines
    // are consumed.


    function parseFileHeader(index) {
      var fileHeader = /^(---|\+\+\+)\s+(.*)$/.exec(diffstr[i]);

      if (fileHeader) {
        var keyPrefix = fileHeader[1] === '---' ? 'old' : 'new';
        var data = fileHeader[2].split('\t', 2);
        var fileName = data[0].replace(/\\\\/g, '\\');

        if (/^".*"$/.test(fileName)) {
          fileName = fileName.substr(1, fileName.length - 2);
        }

        index[keyPrefix + 'FileName'] = fileName;
        index[keyPrefix + 'Header'] = (data[1] || '').trim();
        i++;
      }
    } // Parses a hunk
    // This assumes that we are at the start of a hunk.


    function parseHunk() {
      var chunkHeaderIndex = i,
          chunkHeaderLine = diffstr[i++],
          chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      var hunk = {
        oldStart: +chunkHeader[1],
        oldLines: typeof chunkHeader[2] === 'undefined' ? 1 : +chunkHeader[2],
        newStart: +chunkHeader[3],
        newLines: typeof chunkHeader[4] === 'undefined' ? 1 : +chunkHeader[4],
        lines: [],
        linedelimiters: []
      }; // Unified Diff Format quirk: If the chunk size is 0,
      // the first number is one lower than one would expect.
      // https://www.artima.com/weblogs/viewpost.jsp?thread=164293

      if (hunk.oldLines === 0) {
        hunk.oldStart += 1;
      }

      if (hunk.newLines === 0) {
        hunk.newStart += 1;
      }

      var addCount = 0,
          removeCount = 0;

      for (; i < diffstr.length; i++) {
        // Lines starting with '---' could be mistaken for the "remove line" operation
        // But they could be the header for the next file. Therefore prune such cases out.
        if (diffstr[i].indexOf('--- ') === 0 && i + 2 < diffstr.length && diffstr[i + 1].indexOf('+++ ') === 0 && diffstr[i + 2].indexOf('@@') === 0) {
          break;
        }

        var operation = diffstr[i].length == 0 && i != diffstr.length - 1 ? ' ' : diffstr[i][0];

        if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
          hunk.lines.push(diffstr[i]);
          hunk.linedelimiters.push(delimiters[i] || '\n');

          if (operation === '+') {
            addCount++;
          } else if (operation === '-') {
            removeCount++;
          } else if (operation === ' ') {
            addCount++;
            removeCount++;
          }
        } else {
          break;
        }
      } // Handle the empty block count case


      if (!addCount && hunk.newLines === 1) {
        hunk.newLines = 0;
      }

      if (!removeCount && hunk.oldLines === 1) {
        hunk.oldLines = 0;
      } // Perform optional sanity checking


      if (options.strict) {
        if (addCount !== hunk.newLines) {
          throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
        }

        if (removeCount !== hunk.oldLines) {
          throw new Error('Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
        }
      }

      return hunk;
    }

    while (i < diffstr.length) {
      parseIndex();
    }

    return list;
  }

  // Iterator that traverses in the range of [min, max], stepping
  // by distance from a given start position. I.e. for [0, 4], with
  // start of 2, this will iterate 2, 3, 1, 4, 0.
  function distanceIterator (start, minLine, maxLine) {
    var wantForward = true,
        backwardExhausted = false,
        forwardExhausted = false,
        localOffset = 1;
    return function iterator() {
      if (wantForward && !forwardExhausted) {
        if (backwardExhausted) {
          localOffset++;
        } else {
          wantForward = false;
        } // Check if trying to fit beyond text length, and if not, check it fits
        // after offset location (or desired location on first iteration)


        if (start + localOffset <= maxLine) {
          return localOffset;
        }

        forwardExhausted = true;
      }

      if (!backwardExhausted) {
        if (!forwardExhausted) {
          wantForward = true;
        } // Check if trying to fit before text beginning, and if not, check it fits
        // before offset location


        if (minLine <= start - localOffset) {
          return -localOffset++;
        }

        backwardExhausted = true;
        return iterator();
      } // We tried to fit hunk before text beginning and beyond text length, then
      // hunk can't fit on the text. Return undefined

    };
  }

  function applyPatch(source, uniDiff) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (typeof uniDiff === 'string') {
      uniDiff = parsePatch(uniDiff);
    }

    if (Array.isArray(uniDiff)) {
      if (uniDiff.length > 1) {
        throw new Error('applyPatch only works with a single input.');
      }

      uniDiff = uniDiff[0];
    } // Apply the diff to the input


    var lines = source.split(/\r\n|[\n\v\f\r\x85]/),
        delimiters = source.match(/\r\n|[\n\v\f\r\x85]/g) || [],
        hunks = uniDiff.hunks,
        compareLine = options.compareLine || function (lineNumber, line, operation, patchContent) {
      return line === patchContent;
    },
        errorCount = 0,
        fuzzFactor = options.fuzzFactor || 0,
        minLine = 0,
        offset = 0,
        removeEOFNL,
        addEOFNL;
    /**
     * Checks if the hunk exactly fits on the provided location
     */


    function hunkFits(hunk, toPos) {
      for (var j = 0; j < hunk.lines.length; j++) {
        var line = hunk.lines[j],
            operation = line.length > 0 ? line[0] : ' ',
            content = line.length > 0 ? line.substr(1) : line;

        if (operation === ' ' || operation === '-') {
          // Context sanity check
          if (!compareLine(toPos + 1, lines[toPos], operation, content)) {
            errorCount++;

            if (errorCount > fuzzFactor) {
              return false;
            }
          }

          toPos++;
        }
      }

      return true;
    } // Search best fit offsets for each hunk based on the previous ones


    for (var i = 0; i < hunks.length; i++) {
      var hunk = hunks[i],
          maxLine = lines.length - hunk.oldLines,
          localOffset = 0,
          toPos = offset + hunk.oldStart - 1;
      var iterator = distanceIterator(toPos, minLine, maxLine);

      for (; localOffset !== undefined; localOffset = iterator()) {
        if (hunkFits(hunk, toPos + localOffset)) {
          hunk.offset = offset += localOffset;
          break;
        }
      }

      if (localOffset === undefined) {
        return false;
      } // Set lower text limit to end of the current hunk, so next ones don't try
      // to fit over already patched text


      minLine = hunk.offset + hunk.oldStart + hunk.oldLines;
    } // Apply patch hunks


    var diffOffset = 0;

    for (var _i = 0; _i < hunks.length; _i++) {
      var _hunk = hunks[_i],
          _toPos = _hunk.oldStart + _hunk.offset + diffOffset - 1;

      diffOffset += _hunk.newLines - _hunk.oldLines;

      for (var j = 0; j < _hunk.lines.length; j++) {
        var line = _hunk.lines[j],
            operation = line.length > 0 ? line[0] : ' ',
            content = line.length > 0 ? line.substr(1) : line,
            delimiter = _hunk.linedelimiters[j];

        if (operation === ' ') {
          _toPos++;
        } else if (operation === '-') {
          lines.splice(_toPos, 1);
          delimiters.splice(_toPos, 1);
          /* istanbul ignore else */
        } else if (operation === '+') {
          lines.splice(_toPos, 0, content);
          delimiters.splice(_toPos, 0, delimiter);
          _toPos++;
        } else if (operation === '\\') {
          var previousOperation = _hunk.lines[j - 1] ? _hunk.lines[j - 1][0] : null;

          if (previousOperation === '+') {
            removeEOFNL = true;
          } else if (previousOperation === '-') {
            addEOFNL = true;
          }
        }
      }
    } // Handle EOFNL insertion/removal


    if (removeEOFNL) {
      while (!lines[lines.length - 1]) {
        lines.pop();
        delimiters.pop();
      }
    } else if (addEOFNL) {
      lines.push('');
      delimiters.push('\n');
    }

    for (var _k = 0; _k < lines.length - 1; _k++) {
      lines[_k] = lines[_k] + delimiters[_k];
    }

    return lines.join('');
  } // Wrapper that supports multiple file patches via callbacks.

  function applyPatches(uniDiff, options) {
    if (typeof uniDiff === 'string') {
      uniDiff = parsePatch(uniDiff);
    }

    var currentIndex = 0;

    function processIndex() {
      var index = uniDiff[currentIndex++];

      if (!index) {
        return options.complete();
      }

      options.loadFile(index, function (err, data) {
        if (err) {
          return options.complete(err);
        }

        var updatedContent = applyPatch(data, index, options);
        options.patched(index, updatedContent, function (err) {
          if (err) {
            return options.complete(err);
          }

          processIndex();
        });
      });
    }

    processIndex();
  }

  function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
    if (!options) {
      options = {};
    }

    if (typeof options.context === 'undefined') {
      options.context = 4;
    }

    var diff = diffLines(oldStr, newStr, options);
    diff.push({
      value: '',
      lines: []
    }); // Append an empty value to make cleanup easier

    function contextLines(lines) {
      return lines.map(function (entry) {
        return ' ' + entry;
      });
    }

    var hunks = [];
    var oldRangeStart = 0,
        newRangeStart = 0,
        curRange = [],
        oldLine = 1,
        newLine = 1;

    var _loop = function _loop(i) {
      var current = diff[i],
          lines = current.lines || current.value.replace(/\n$/, '').split('\n');
      current.lines = lines;

      if (current.added || current.removed) {
        var _curRange;

        // If we have previous context, start with that
        if (!oldRangeStart) {
          var prev = diff[i - 1];
          oldRangeStart = oldLine;
          newRangeStart = newLine;

          if (prev) {
            curRange = options.context > 0 ? contextLines(prev.lines.slice(-options.context)) : [];
            oldRangeStart -= curRange.length;
            newRangeStart -= curRange.length;
          }
        } // Output our changes


        (_curRange = curRange).push.apply(_curRange, _toConsumableArray(lines.map(function (entry) {
          return (current.added ? '+' : '-') + entry;
        }))); // Track the updated file position


        if (current.added) {
          newLine += lines.length;
        } else {
          oldLine += lines.length;
        }
      } else {
        // Identical context lines. Track line changes
        if (oldRangeStart) {
          // Close out any changes that have been output (or join overlapping)
          if (lines.length <= options.context * 2 && i < diff.length - 2) {
            var _curRange2;

            // Overlapping
            (_curRange2 = curRange).push.apply(_curRange2, _toConsumableArray(contextLines(lines)));
          } else {
            var _curRange3;

            // end the range and output
            var contextSize = Math.min(lines.length, options.context);

            (_curRange3 = curRange).push.apply(_curRange3, _toConsumableArray(contextLines(lines.slice(0, contextSize))));

            var hunk = {
              oldStart: oldRangeStart,
              oldLines: oldLine - oldRangeStart + contextSize,
              newStart: newRangeStart,
              newLines: newLine - newRangeStart + contextSize,
              lines: curRange
            };

            if (i >= diff.length - 2 && lines.length <= options.context) {
              // EOF is inside this hunk
              var oldEOFNewline = /\n$/.test(oldStr);
              var newEOFNewline = /\n$/.test(newStr);
              var noNlBeforeAdds = lines.length == 0 && curRange.length > hunk.oldLines;

              if (!oldEOFNewline && noNlBeforeAdds && oldStr.length > 0) {
                // special case: old has no eol and no trailing context; no-nl can end up before adds
                // however, if the old file is empty, do not output the no-nl line
                curRange.splice(hunk.oldLines, 0, '\\ No newline at end of file');
              }

              if (!oldEOFNewline && !noNlBeforeAdds || !newEOFNewline) {
                curRange.push('\\ No newline at end of file');
              }
            }

            hunks.push(hunk);
            oldRangeStart = 0;
            newRangeStart = 0;
            curRange = [];
          }
        }

        oldLine += lines.length;
        newLine += lines.length;
      }
    };

    for (var i = 0; i < diff.length; i++) {
      _loop(i);
    }

    return {
      oldFileName: oldFileName,
      newFileName: newFileName,
      oldHeader: oldHeader,
      newHeader: newHeader,
      hunks: hunks
    };
  }
  function formatPatch(diff) {
    var ret = [];

    if (diff.oldFileName == diff.newFileName) {
      ret.push('Index: ' + diff.oldFileName);
    }

    ret.push('===================================================================');
    ret.push('--- ' + diff.oldFileName + (typeof diff.oldHeader === 'undefined' ? '' : '\t' + diff.oldHeader));
    ret.push('+++ ' + diff.newFileName + (typeof diff.newHeader === 'undefined' ? '' : '\t' + diff.newHeader));

    for (var i = 0; i < diff.hunks.length; i++) {
      var hunk = diff.hunks[i]; // Unified Diff Format quirk: If the chunk size is 0,
      // the first number is one lower than one would expect.
      // https://www.artima.com/weblogs/viewpost.jsp?thread=164293

      if (hunk.oldLines === 0) {
        hunk.oldStart -= 1;
      }

      if (hunk.newLines === 0) {
        hunk.newStart -= 1;
      }

      ret.push('@@ -' + hunk.oldStart + ',' + hunk.oldLines + ' +' + hunk.newStart + ',' + hunk.newLines + ' @@');
      ret.push.apply(ret, hunk.lines);
    }

    return ret.join('\n') + '\n';
  }
  function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
    return formatPatch(structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options));
  }
  function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
    return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
  }

  function arrayEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    return arrayStartsWith(a, b);
  }
  function arrayStartsWith(array, start) {
    if (start.length > array.length) {
      return false;
    }

    for (var i = 0; i < start.length; i++) {
      if (start[i] !== array[i]) {
        return false;
      }
    }

    return true;
  }

  function calcLineCount(hunk) {
    var _calcOldNewLineCount = calcOldNewLineCount(hunk.lines),
        oldLines = _calcOldNewLineCount.oldLines,
        newLines = _calcOldNewLineCount.newLines;

    if (oldLines !== undefined) {
      hunk.oldLines = oldLines;
    } else {
      delete hunk.oldLines;
    }

    if (newLines !== undefined) {
      hunk.newLines = newLines;
    } else {
      delete hunk.newLines;
    }
  }
  function merge(mine, theirs, base) {
    mine = loadPatch(mine, base);
    theirs = loadPatch(theirs, base);
    var ret = {}; // For index we just let it pass through as it doesn't have any necessary meaning.
    // Leaving sanity checks on this to the API consumer that may know more about the
    // meaning in their own context.

    if (mine.index || theirs.index) {
      ret.index = mine.index || theirs.index;
    }

    if (mine.newFileName || theirs.newFileName) {
      if (!fileNameChanged(mine)) {
        // No header or no change in ours, use theirs (and ours if theirs does not exist)
        ret.oldFileName = theirs.oldFileName || mine.oldFileName;
        ret.newFileName = theirs.newFileName || mine.newFileName;
        ret.oldHeader = theirs.oldHeader || mine.oldHeader;
        ret.newHeader = theirs.newHeader || mine.newHeader;
      } else if (!fileNameChanged(theirs)) {
        // No header or no change in theirs, use ours
        ret.oldFileName = mine.oldFileName;
        ret.newFileName = mine.newFileName;
        ret.oldHeader = mine.oldHeader;
        ret.newHeader = mine.newHeader;
      } else {
        // Both changed... figure it out
        ret.oldFileName = selectField(ret, mine.oldFileName, theirs.oldFileName);
        ret.newFileName = selectField(ret, mine.newFileName, theirs.newFileName);
        ret.oldHeader = selectField(ret, mine.oldHeader, theirs.oldHeader);
        ret.newHeader = selectField(ret, mine.newHeader, theirs.newHeader);
      }
    }

    ret.hunks = [];
    var mineIndex = 0,
        theirsIndex = 0,
        mineOffset = 0,
        theirsOffset = 0;

    while (mineIndex < mine.hunks.length || theirsIndex < theirs.hunks.length) {
      var mineCurrent = mine.hunks[mineIndex] || {
        oldStart: Infinity
      },
          theirsCurrent = theirs.hunks[theirsIndex] || {
        oldStart: Infinity
      };

      if (hunkBefore(mineCurrent, theirsCurrent)) {
        // This patch does not overlap with any of the others, yay.
        ret.hunks.push(cloneHunk(mineCurrent, mineOffset));
        mineIndex++;
        theirsOffset += mineCurrent.newLines - mineCurrent.oldLines;
      } else if (hunkBefore(theirsCurrent, mineCurrent)) {
        // This patch does not overlap with any of the others, yay.
        ret.hunks.push(cloneHunk(theirsCurrent, theirsOffset));
        theirsIndex++;
        mineOffset += theirsCurrent.newLines - theirsCurrent.oldLines;
      } else {
        // Overlap, merge as best we can
        var mergedHunk = {
          oldStart: Math.min(mineCurrent.oldStart, theirsCurrent.oldStart),
          oldLines: 0,
          newStart: Math.min(mineCurrent.newStart + mineOffset, theirsCurrent.oldStart + theirsOffset),
          newLines: 0,
          lines: []
        };
        mergeLines(mergedHunk, mineCurrent.oldStart, mineCurrent.lines, theirsCurrent.oldStart, theirsCurrent.lines);
        theirsIndex++;
        mineIndex++;
        ret.hunks.push(mergedHunk);
      }
    }

    return ret;
  }

  function loadPatch(param, base) {
    if (typeof param === 'string') {
      if (/^@@/m.test(param) || /^Index:/m.test(param)) {
        return parsePatch(param)[0];
      }

      if (!base) {
        throw new Error('Must provide a base reference or pass in a patch');
      }

      return structuredPatch(undefined, undefined, base, param);
    }

    return param;
  }

  function fileNameChanged(patch) {
    return patch.newFileName && patch.newFileName !== patch.oldFileName;
  }

  function selectField(index, mine, theirs) {
    if (mine === theirs) {
      return mine;
    } else {
      index.conflict = true;
      return {
        mine: mine,
        theirs: theirs
      };
    }
  }

  function hunkBefore(test, check) {
    return test.oldStart < check.oldStart && test.oldStart + test.oldLines < check.oldStart;
  }

  function cloneHunk(hunk, offset) {
    return {
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart + offset,
      newLines: hunk.newLines,
      lines: hunk.lines
    };
  }

  function mergeLines(hunk, mineOffset, mineLines, theirOffset, theirLines) {
    // This will generally result in a conflicted hunk, but there are cases where the context
    // is the only overlap where we can successfully merge the content here.
    var mine = {
      offset: mineOffset,
      lines: mineLines,
      index: 0
    },
        their = {
      offset: theirOffset,
      lines: theirLines,
      index: 0
    }; // Handle any leading content

    insertLeading(hunk, mine, their);
    insertLeading(hunk, their, mine); // Now in the overlap content. Scan through and select the best changes from each.

    while (mine.index < mine.lines.length && their.index < their.lines.length) {
      var mineCurrent = mine.lines[mine.index],
          theirCurrent = their.lines[their.index];

      if ((mineCurrent[0] === '-' || mineCurrent[0] === '+') && (theirCurrent[0] === '-' || theirCurrent[0] === '+')) {
        // Both modified ...
        mutualChange(hunk, mine, their);
      } else if (mineCurrent[0] === '+' && theirCurrent[0] === ' ') {
        var _hunk$lines;

        // Mine inserted
        (_hunk$lines = hunk.lines).push.apply(_hunk$lines, _toConsumableArray(collectChange(mine)));
      } else if (theirCurrent[0] === '+' && mineCurrent[0] === ' ') {
        var _hunk$lines2;

        // Theirs inserted
        (_hunk$lines2 = hunk.lines).push.apply(_hunk$lines2, _toConsumableArray(collectChange(their)));
      } else if (mineCurrent[0] === '-' && theirCurrent[0] === ' ') {
        // Mine removed or edited
        removal(hunk, mine, their);
      } else if (theirCurrent[0] === '-' && mineCurrent[0] === ' ') {
        // Their removed or edited
        removal(hunk, their, mine, true);
      } else if (mineCurrent === theirCurrent) {
        // Context identity
        hunk.lines.push(mineCurrent);
        mine.index++;
        their.index++;
      } else {
        // Context mismatch
        conflict(hunk, collectChange(mine), collectChange(their));
      }
    } // Now push anything that may be remaining


    insertTrailing(hunk, mine);
    insertTrailing(hunk, their);
    calcLineCount(hunk);
  }

  function mutualChange(hunk, mine, their) {
    var myChanges = collectChange(mine),
        theirChanges = collectChange(their);

    if (allRemoves(myChanges) && allRemoves(theirChanges)) {
      // Special case for remove changes that are supersets of one another
      if (arrayStartsWith(myChanges, theirChanges) && skipRemoveSuperset(their, myChanges, myChanges.length - theirChanges.length)) {
        var _hunk$lines3;

        (_hunk$lines3 = hunk.lines).push.apply(_hunk$lines3, _toConsumableArray(myChanges));

        return;
      } else if (arrayStartsWith(theirChanges, myChanges) && skipRemoveSuperset(mine, theirChanges, theirChanges.length - myChanges.length)) {
        var _hunk$lines4;

        (_hunk$lines4 = hunk.lines).push.apply(_hunk$lines4, _toConsumableArray(theirChanges));

        return;
      }
    } else if (arrayEqual(myChanges, theirChanges)) {
      var _hunk$lines5;

      (_hunk$lines5 = hunk.lines).push.apply(_hunk$lines5, _toConsumableArray(myChanges));

      return;
    }

    conflict(hunk, myChanges, theirChanges);
  }

  function removal(hunk, mine, their, swap) {
    var myChanges = collectChange(mine),
        theirChanges = collectContext(their, myChanges);

    if (theirChanges.merged) {
      var _hunk$lines6;

      (_hunk$lines6 = hunk.lines).push.apply(_hunk$lines6, _toConsumableArray(theirChanges.merged));
    } else {
      conflict(hunk, swap ? theirChanges : myChanges, swap ? myChanges : theirChanges);
    }
  }

  function conflict(hunk, mine, their) {
    hunk.conflict = true;
    hunk.lines.push({
      conflict: true,
      mine: mine,
      theirs: their
    });
  }

  function insertLeading(hunk, insert, their) {
    while (insert.offset < their.offset && insert.index < insert.lines.length) {
      var line = insert.lines[insert.index++];
      hunk.lines.push(line);
      insert.offset++;
    }
  }

  function insertTrailing(hunk, insert) {
    while (insert.index < insert.lines.length) {
      var line = insert.lines[insert.index++];
      hunk.lines.push(line);
    }
  }

  function collectChange(state) {
    var ret = [],
        operation = state.lines[state.index][0];

    while (state.index < state.lines.length) {
      var line = state.lines[state.index]; // Group additions that are immediately after subtractions and treat them as one "atomic" modify change.

      if (operation === '-' && line[0] === '+') {
        operation = '+';
      }

      if (operation === line[0]) {
        ret.push(line);
        state.index++;
      } else {
        break;
      }
    }

    return ret;
  }

  function collectContext(state, matchChanges) {
    var changes = [],
        merged = [],
        matchIndex = 0,
        contextChanges = false,
        conflicted = false;

    while (matchIndex < matchChanges.length && state.index < state.lines.length) {
      var change = state.lines[state.index],
          match = matchChanges[matchIndex]; // Once we've hit our add, then we are done

      if (match[0] === '+') {
        break;
      }

      contextChanges = contextChanges || change[0] !== ' ';
      merged.push(match);
      matchIndex++; // Consume any additions in the other block as a conflict to attempt
      // to pull in the remaining context after this

      if (change[0] === '+') {
        conflicted = true;

        while (change[0] === '+') {
          changes.push(change);
          change = state.lines[++state.index];
        }
      }

      if (match.substr(1) === change.substr(1)) {
        changes.push(change);
        state.index++;
      } else {
        conflicted = true;
      }
    }

    if ((matchChanges[matchIndex] || '')[0] === '+' && contextChanges) {
      conflicted = true;
    }

    if (conflicted) {
      return changes;
    }

    while (matchIndex < matchChanges.length) {
      merged.push(matchChanges[matchIndex++]);
    }

    return {
      merged: merged,
      changes: changes
    };
  }

  function allRemoves(changes) {
    return changes.reduce(function (prev, change) {
      return prev && change[0] === '-';
    }, true);
  }

  function skipRemoveSuperset(state, removeChanges, delta) {
    for (var i = 0; i < delta; i++) {
      var changeContent = removeChanges[removeChanges.length - delta + i].substr(1);

      if (state.lines[state.index + i] !== ' ' + changeContent) {
        return false;
      }
    }

    state.index += delta;
    return true;
  }

  function calcOldNewLineCount(lines) {
    var oldLines = 0;
    var newLines = 0;
    lines.forEach(function (line) {
      if (typeof line !== 'string') {
        var myCount = calcOldNewLineCount(line.mine);
        var theirCount = calcOldNewLineCount(line.theirs);

        if (oldLines !== undefined) {
          if (myCount.oldLines === theirCount.oldLines) {
            oldLines += myCount.oldLines;
          } else {
            oldLines = undefined;
          }
        }

        if (newLines !== undefined) {
          if (myCount.newLines === theirCount.newLines) {
            newLines += myCount.newLines;
          } else {
            newLines = undefined;
          }
        }
      } else {
        if (newLines !== undefined && (line[0] === '+' || line[0] === ' ')) {
          newLines++;
        }

        if (oldLines !== undefined && (line[0] === '-' || line[0] === ' ')) {
          oldLines++;
        }
      }
    });
    return {
      oldLines: oldLines,
      newLines: newLines
    };
  }

  // See: http://code.google.com/p/google-diff-match-patch/wiki/API
  function convertChangesToDMP(changes) {
    var ret = [],
        change,
        operation;

    for (var i = 0; i < changes.length; i++) {
      change = changes[i];

      if (change.added) {
        operation = 1;
      } else if (change.removed) {
        operation = -1;
      } else {
        operation = 0;
      }

      ret.push([operation, change.value]);
    }

    return ret;
  }

  function convertChangesToXML(changes) {
    var ret = [];

    for (var i = 0; i < changes.length; i++) {
      var change = changes[i];

      if (change.added) {
        ret.push('<ins>');
      } else if (change.removed) {
        ret.push('<del>');
      }

      ret.push(escapeHTML(change.value));

      if (change.added) {
        ret.push('</ins>');
      } else if (change.removed) {
        ret.push('</del>');
      }
    }

    return ret.join('');
  }

  function escapeHTML(s) {
    var n = s;
    n = n.replace(/&/g, '&amp;');
    n = n.replace(/</g, '&lt;');
    n = n.replace(/>/g, '&gt;');
    n = n.replace(/"/g, '&quot;');
    return n;
  }

  exports.Diff = Diff;
  exports.applyPatch = applyPatch;
  exports.applyPatches = applyPatches;
  exports.canonicalize = canonicalize;
  exports.convertChangesToDMP = convertChangesToDMP;
  exports.convertChangesToXML = convertChangesToXML;
  exports.createPatch = createPatch;
  exports.createTwoFilesPatch = createTwoFilesPatch;
  exports.diffArrays = diffArrays;
  exports.diffChars = diffChars;
  exports.diffCss = diffCss;
  exports.diffJson = diffJson;
  exports.diffLines = diffLines;
  exports.diffSentences = diffSentences;
  exports.diffTrimmedLines = diffTrimmedLines;
  exports.diffWords = diffWords;
  exports.diffWordsWithSpace = diffWordsWithSpace;
  exports.merge = merge;
  exports.parsePatch = parsePatch;
  exports.structuredPatch = structuredPatch;

  Object.defineProperty(exports, '__esModule', { value: true });

})));

},{}],19:[function(require,module,exports){
/*
* loglevel - https://github.com/pimterry/loglevel
*
* Copyright (c) 2013 Tim Perry
* Licensed under the MIT license.
*/
(function (root, definition) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        define(definition);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = definition();
    } else {
        root.log = definition();
    }
}(this, function () {
    "use strict";

    // Slightly dubious tricks to cut down minimized file size
    var noop = function() {};
    var undefinedType = "undefined";
    var isIE = (typeof window !== undefinedType) && (typeof window.navigator !== undefinedType) && (
        /Trident\/|MSIE /.test(window.navigator.userAgent)
    );

    var logMethods = [
        "trace",
        "debug",
        "info",
        "warn",
        "error"
    ];

    // Cross-browser bind equivalent that works at least back to IE6
    function bindMethod(obj, methodName) {
        var method = obj[methodName];
        if (typeof method.bind === 'function') {
            return method.bind(obj);
        } else {
            try {
                return Function.prototype.bind.call(method, obj);
            } catch (e) {
                // Missing bind shim or IE8 + Modernizr, fallback to wrapping
                return function() {
                    return Function.prototype.apply.apply(method, [obj, arguments]);
                };
            }
        }
    }

    // Trace() doesn't print the message in IE, so for that case we need to wrap it
    function traceForIE() {
        if (console.log) {
            if (console.log.apply) {
                console.log.apply(console, arguments);
            } else {
                // In old IE, native console methods themselves don't have apply().
                Function.prototype.apply.apply(console.log, [console, arguments]);
            }
        }
        if (console.trace) console.trace();
    }

    // Build the best logging method possible for this env
    // Wherever possible we want to bind, not wrap, to preserve stack traces
    function realMethod(methodName) {
        if (methodName === 'debug') {
            methodName = 'log';
        }

        if (typeof console === undefinedType) {
            return false; // No method possible, for now - fixed later by enableLoggingWhenConsoleArrives
        } else if (methodName === 'trace' && isIE) {
            return traceForIE;
        } else if (console[methodName] !== undefined) {
            return bindMethod(console, methodName);
        } else if (console.log !== undefined) {
            return bindMethod(console, 'log');
        } else {
            return noop;
        }
    }

    // These private functions always need `this` to be set properly

    function replaceLoggingMethods(level, loggerName) {
        /*jshint validthis:true */
        for (var i = 0; i < logMethods.length; i++) {
            var methodName = logMethods[i];
            this[methodName] = (i < level) ?
                noop :
                this.methodFactory(methodName, level, loggerName);
        }

        // Define log.log as an alias for log.debug
        this.log = this.debug;
    }

    // In old IE versions, the console isn't present until you first open it.
    // We build realMethod() replacements here that regenerate logging methods
    function enableLoggingWhenConsoleArrives(methodName, level, loggerName) {
        return function () {
            if (typeof console !== undefinedType) {
                replaceLoggingMethods.call(this, level, loggerName);
                this[methodName].apply(this, arguments);
            }
        };
    }

    // By default, we use closely bound real methods wherever possible, and
    // otherwise we wait for a console to appear, and then try again.
    function defaultMethodFactory(methodName, level, loggerName) {
        /*jshint validthis:true */
        return realMethod(methodName) ||
               enableLoggingWhenConsoleArrives.apply(this, arguments);
    }

    function Logger(name, defaultLevel, factory) {
      var self = this;
      var currentLevel;
      defaultLevel = defaultLevel == null ? "WARN" : defaultLevel;

      var storageKey = "loglevel";
      if (typeof name === "string") {
        storageKey += ":" + name;
      } else if (typeof name === "symbol") {
        storageKey = undefined;
      }

      function persistLevelIfPossible(levelNum) {
          var levelName = (logMethods[levelNum] || 'silent').toUpperCase();

          if (typeof window === undefinedType || !storageKey) return;

          // Use localStorage if available
          try {
              window.localStorage[storageKey] = levelName;
              return;
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=" + levelName + ";";
          } catch (ignore) {}
      }

      function getPersistedLevel() {
          var storedLevel;

          if (typeof window === undefinedType || !storageKey) return;

          try {
              storedLevel = window.localStorage[storageKey];
          } catch (ignore) {}

          // Fallback to cookies if local storage gives us nothing
          if (typeof storedLevel === undefinedType) {
              try {
                  var cookie = window.document.cookie;
                  var location = cookie.indexOf(
                      encodeURIComponent(storageKey) + "=");
                  if (location !== -1) {
                      storedLevel = /^([^;]+)/.exec(cookie.slice(location))[1];
                  }
              } catch (ignore) {}
          }

          // If the stored level is not valid, treat it as if nothing was stored.
          if (self.levels[storedLevel] === undefined) {
              storedLevel = undefined;
          }

          return storedLevel;
      }

      function clearPersistedLevel() {
          if (typeof window === undefinedType || !storageKey) return;

          // Use localStorage if available
          try {
              window.localStorage.removeItem(storageKey);
              return;
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
          } catch (ignore) {}
      }

      /*
       *
       * Public logger API - see https://github.com/pimterry/loglevel for details
       *
       */

      self.name = name;

      self.levels = { "TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3,
          "ERROR": 4, "SILENT": 5};

      self.methodFactory = factory || defaultMethodFactory;

      self.getLevel = function () {
          return currentLevel;
      };

      self.setLevel = function (level, persist) {
          if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
              level = self.levels[level.toUpperCase()];
          }
          if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
              currentLevel = level;
              if (persist !== false) {  // defaults to true
                  persistLevelIfPossible(level);
              }
              replaceLoggingMethods.call(self, level, name);
              if (typeof console === undefinedType && level < self.levels.SILENT) {
                  return "No console available for logging";
              }
          } else {
              throw "log.setLevel() called with invalid level: " + level;
          }
      };

      self.setDefaultLevel = function (level) {
          defaultLevel = level;
          if (!getPersistedLevel()) {
              self.setLevel(level, false);
          }
      };

      self.resetLevel = function () {
          self.setLevel(defaultLevel, false);
          clearPersistedLevel();
      };

      self.enableAll = function(persist) {
          self.setLevel(self.levels.TRACE, persist);
      };

      self.disableAll = function(persist) {
          self.setLevel(self.levels.SILENT, persist);
      };

      // Initialize with the right level
      var initialLevel = getPersistedLevel();
      if (initialLevel == null) {
          initialLevel = defaultLevel;
      }
      self.setLevel(initialLevel, false);
    }

    /*
     *
     * Top-level API
     *
     */

    var defaultLogger = new Logger();

    var _loggersByName = {};
    defaultLogger.getLogger = function getLogger(name) {
        if ((typeof name !== "symbol" && typeof name !== "string") || name === "") {
          throw new TypeError("You must supply a name when creating a logger.");
        }

        var logger = _loggersByName[name];
        if (!logger) {
          logger = _loggersByName[name] = new Logger(
            name, defaultLogger.getLevel(), defaultLogger.methodFactory);
        }
        return logger;
    };

    // Grab the current global log variable in case of overwrite
    var _log = (typeof window !== undefinedType) ? window.log : undefined;
    defaultLogger.noConflict = function() {
        if (typeof window !== undefinedType &&
               window.log === defaultLogger) {
            window.log = _log;
        }

        return defaultLogger;
    };

    defaultLogger.getLoggers = function getLoggers() {
        return _loggersByName;
    };

    // ES6 default export, for compatibility
    defaultLogger['default'] = defaultLogger;

    return defaultLogger;
}));

},{}],20:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegexpGroup = exports.RegexpGroupItem = exports.RegexpASCII = exports.RegexpUnicodeAll = exports.RegexpUnicode = exports.RegexpHexCode = exports.RegexpRange = exports.RegexpSet = exports.RegexpTimesQuantifiers = exports.RegexpTimesMulti = exports.RegexpTimes = exports.RegexpRefOrNumber = exports.RegexpOctal = exports.RegexpTranslateChar = exports.RegexpChar = exports.RegexpAnchor = exports.RegexpPrint = exports.RegexpCharset = exports.RegexpControl = exports.RegexpBegin = exports.RegexpBackspace = exports.RegexpNull = exports.RegexpAny = exports.RegexpLookaround = exports.RegexpSpecial = exports.RegexpReference = exports.RegexpOrigin = exports.RegexpEmpty = exports.RegexpPart = exports.regexpRule = exports.parserRule = exports.CharsetHelper = void 0;
var isOptional = function () {
    return Math.random() >= 0.5;
};
var makeRandom = function (min, max) {
    if (min === max) {
        return min;
    }
    else {
        return min + Math.floor(Math.random() * (max + 1 - min));
    }
};
var getRandomTotalIndex = function (totals) {
    var total = getLastItem(totals);
    var rand = makeRandom(1, total);
    var nums = totals.length;
    var index = 0;
    while (nums > 1) {
        var avg = Math.floor(nums / 2);
        var prev = totals[index + avg - 1];
        var next = totals[index + avg];
        if (rand >= prev && rand <= next) {
            index += avg - (rand === prev ? 1 : 0);
            break;
        }
        else {
            if (rand > next) {
                index += avg + 1;
                nums -= avg + 1;
            }
            else {
                nums -= avg;
            }
        }
    }
    return {
        rand: rand,
        index: index,
    };
};
var getLastItem = function (arr) {
    return arr[arr.length - 1];
};
var CharsetHelper = (function () {
    function CharsetHelper() {
    }
    CharsetHelper.charsetOfAll = function () {
        return CharsetHelper.charsetOfNegated('ALL');
    };
    CharsetHelper.charsetOfDotall = function () {
        return CharsetHelper.charsetOfNegated('DOTALL');
    };
    CharsetHelper.charsetOfNegated = function (type) {
        var points = CharsetHelper.points, cache = CharsetHelper.cache;
        if (cache[type]) {
            return cache[type];
        }
        else {
            var start = 0x0000;
            var max = 0xdbff;
            var nextStart = 0xe000;
            var nextMax = 0xffff;
            var ranges_1 = [];
            var totals_1 = [];
            var total_1 = 0;
            var add = function (begin, end) {
                var num = end - begin + 1;
                if (num <= 0) {
                    return;
                }
                else {
                    ranges_1.push(num > 1 ? [begin, end] : [begin]);
                }
                total_1 += num;
                totals_1.push(total_1);
            };
            if (type === 'DOTALL') {
                add(start, max);
                add(nextStart, nextMax);
            }
            else {
                var excepts = type === 'ALL'
                    ? [[0x000a], [0x000d], [0x2028, 0x2029]]
                    : points[type.toLowerCase()];
                var isNegaWhitespace = type === 'S';
                var count = excepts.length - (isNegaWhitespace ? 1 : 0);
                var looped = 0;
                while (start <= max && count > looped) {
                    var _a = excepts[looped++], begin = _a[0], end = _a[1];
                    add(start, begin - 1);
                    start = (end || begin) + 1;
                }
                if (start < max) {
                    add(start, max);
                }
                if (isNegaWhitespace) {
                    var last = getLastItem(excepts)[0];
                    add(nextStart, last - 1);
                    add(last + 1, nextMax);
                }
                else {
                    add(nextStart, nextMax);
                }
            }
            return (cache[type] = {
                ranges: ranges_1,
                totals: totals_1,
            });
        }
    };
    CharsetHelper.charsetOf = function (type) {
        var lens = CharsetHelper.lens, points = CharsetHelper.points;
        return {
            ranges: points[type],
            totals: lens[type],
        };
    };
    CharsetHelper.getCharsetInfo = function (type, flags) {
        if (flags === void 0) { flags = {}; }
        var last;
        var helper = CharsetHelper;
        if (['w', 'd', 's'].includes(type)) {
            last = helper.charsetOf(type);
        }
        else {
            if (type === '.') {
                if (flags.s) {
                    last = helper.charsetOfDotall();
                }
                else {
                    last = helper.charsetOfAll();
                }
            }
            else {
                last = helper.charsetOfNegated(type);
            }
            if (flags.u) {
                last = {
                    ranges: last.ranges.concat([helper.bigCharPoint]),
                    totals: last.totals.concat(helper.bigCharTotal),
                };
            }
        }
        return last;
    };
    CharsetHelper.make = function (type, flags) {
        if (flags === void 0) { flags = {}; }
        return CharsetHelper.makeOne(CharsetHelper.getCharsetInfo(type, flags));
    };
    CharsetHelper.makeOne = function (info) {
        var totals = info.totals, ranges = info.ranges;
        var _a = getRandomTotalIndex(totals), rand = _a.rand, index = _a.index;
        var codePoint = ranges[index][0] + (rand - (totals[index - 1] || 0)) - 1;
        return String.fromCodePoint(codePoint);
    };
    CharsetHelper.points = {
        d: [[48, 57]],
        w: [[48, 57], [65, 90], [95], [97, 122]],
        s: [
            [0x0009, 0x000d],
            [0x0020],
            [0x00a0],
            [0x1680],
            [0x2000, 0x200a],
            [0x2028, 0x2029],
            [0x202f],
            [0x205f],
            [0x3000],
            [0xfeff],
        ],
    };
    CharsetHelper.lens = {
        d: [10],
        w: [10, 36, 37, 63],
        s: [5, 6, 7, 8, 18, 20, 21, 22, 23, 24],
    };
    CharsetHelper.bigCharPoint = [0x10000, 0x10ffff];
    CharsetHelper.bigCharTotal = 0x10ffff - 0x10000 + 1;
    CharsetHelper.cache = {};
    return CharsetHelper;
}());
exports.CharsetHelper = CharsetHelper;
var charH = CharsetHelper;
var symbols = {
    beginWith: '^',
    endWith: '$',
    matchAny: '.',
    groupBegin: '(',
    groupEnd: ')',
    uncapture: '?:',
    lookahead: '?=',
    lookaheadNot: '?!',
    groupSplitor: '|',
    setBegin: '[',
    setEnd: ']',
    rangeSplitor: '-',
    multipleBegin: '{',
    multipleEnd: '}',
    multipleSplitor: ',',
    translate: '\\',
    leastOne: '+',
    multiple: '*',
    optional: '?',
    setNotIn: '^',
    delimiter: '/',
};
var flagsBinary = {
    i: 1,
    u: 2,
    s: 4,
    g: 8,
    m: 16,
    y: 32,
};
var flagItems = Object.keys(flagsBinary).join('');
exports.parserRule = new RegExp("^\\/(?:\\\\.|\\[[^\\]]*\\]|[^\\/])+?/[" + flagItems + "]*");
var regexpRuleContext = "((?:\\\\.|\\[[^\\]]*\\]|[^\\/])+?)";
exports.regexpRule = new RegExp("^\\/" + regexpRuleContext + "\\/([" + flagItems + "]*)$");
var regexpNoFlagsRule = new RegExp("^" + regexpRuleContext + "$");
var octalRule = /^(0[0-7]{0,2}|[1-3][0-7]{0,2}|[4-7][0-7]?)/;
var Parser = (function () {
    function Parser(rule, config) {
        if (config === void 0) { config = {}; }
        this.rule = rule;
        this.config = config;
        this.context = '';
        this.flags = [];
        this.lastRule = '';
        this.queues = [];
        this.ruleInput = '';
        this.flagsHash = {};
        this.totalFlagBinary = 0;
        this.rootQueues = [];
        this.hasLookaround = false;
        this.hasNullRoot = null;
        if (rule instanceof RegExp) {
            this.rule = rule.toString();
            this.context = rule.source;
            this.flags = rule.flags.split('');
        }
        else {
            if (exports.regexpRule.test(rule) || regexpNoFlagsRule.test(rule)) {
                this.rule = rule;
                this.context = RegExp.$1;
                this.flags = RegExp.$2 ? RegExp.$2.split('') : [];
            }
            else {
                throw new Error("wrong regexp:" + rule);
            }
        }
        this.checkFlags();
        this.parse();
        this.lastRule = this.ruleInput;
    }
    Parser.prototype.build = function () {
        if (this.hasLookaround) {
            throw new Error('the build method does not support lookarounds.');
        }
        var rootQueues = this.rootQueues;
        var result = '';
        var conf = __assign(__assign({}, this.config), { flags: this.flagsHash, namedGroupData: {}, captureGroupData: {}, beginWiths: [], endWiths: [] });
        var nullRootErr = 'the regexp has null expression, will match nothing';
        if (this.hasNullRoot === true) {
            throw new Error(nullRootErr);
        }
        else {
            this.hasNullRoot = rootQueues.some(function (queue) {
                if (queue.isMatchNothing) {
                    return true;
                }
                result += queue.build(conf);
                return false;
            });
            if (this.hasNullRoot)
                throw new Error(nullRootErr);
        }
        return result;
    };
    Parser.prototype.info = function () {
        var _a = this, rule = _a.rule, context = _a.context, lastRule = _a.lastRule, flags = _a.flags, queues = _a.queues;
        return {
            rule: rule,
            context: context,
            lastRule: lastRule,
            flags: flags,
            queues: queues,
        };
    };
    Parser.prototype.parse = function () {
        var _this = this;
        var context = this.context;
        var s = symbols;
        var i = 0;
        var j = context.length;
        var queues = [new RegexpBegin()];
        var groups = [];
        var lookarounds = [];
        var captureGroups = [];
        var namedCaptures = {};
        var refGroups = {};
        var captureRule = /^(\?(?:<(.+?)>|:))/;
        var lookaroundRule = /^(\?(?:<=|<!|=|!))/;
        var hasFlagU = this.hasFlag('u');
        var nestQueues = [];
        var refOrNumbers = [];
        var addToQueue = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            args.forEach(function (queue) { return (queue.parser = _this); });
            queues.push.apply(queues, args);
        };
        var groupCaptureIndex = 0;
        var curSet = null;
        var curRange = null;
        var addToGroupOrLookaround = function (cur) {
            var curQueue = getLastItem(nestQueues) ||
                getLastItem(groups) ||
                getLastItem(lookarounds);
            if (['group', 'lookaround'].includes(cur.type)) {
                var lists = cur.type === 'group' ? groups : lookarounds;
                lists.push(cur);
                nestQueues.push(cur);
            }
            if (curQueue) {
                if (curQueue.type === 'group') {
                    curQueue.addItem(cur);
                }
                else {
                    cur.parent = curQueue;
                }
            }
        };
        var isWrongRepeat = function (type, prev) {
            var denyTypes = [
                'groupBegin',
                'groupSplitor',
                'times',
                'begin',
                'anchor',
            ];
            return (denyTypes.includes(type) ||
                (type === 'charset' && prev.charset.toLowerCase() === 'b'));
        };
        while (i < j) {
            var char = context.charAt(i++);
            if ((curRange || curSet) &&
                [
                    '[',
                    '(',
                    ')',
                    '|',
                    '*',
                    '?',
                    '+',
                    '{',
                    '.',
                    '}',
                    '^',
                    '$',
                    '/',
                ].includes(char)) {
                var newChar = new RegexpChar(char);
                if (curRange) {
                    newChar.parent = curRange;
                    curRange = null;
                }
                else {
                    newChar.parent = curSet;
                }
                addToQueue(newChar);
                continue;
            }
            var nextAll = context.slice(i);
            var lastGroup = getLastItem(groups);
            var lastQueue = getLastItem(queues);
            var target = null;
            var special = null;
            switch (char) {
                case s.translate:
                    var next = context.charAt(i++);
                    var input = char + next;
                    if (next === 'u' || next === 'x') {
                        target =
                            next === 'x'
                                ? new RegexpASCII()
                                : hasFlagU
                                    ? new RegexpUnicodeAll()
                                    : new RegexpUnicode();
                        var matchedNum = target.untilEnd(context.slice(i));
                        if (matchedNum === 0) {
                            if (hasFlagU) {
                                throw new Error("invalid unicode code point:" + context);
                            }
                            target = new RegexpTranslateChar("\\" + next);
                        }
                        else {
                            i += matchedNum;
                        }
                    }
                    else if (next === 'c') {
                        var code = context.charAt(i);
                        if (hasFlagU) {
                            if (/[a-zA-Z]/.test(code)) {
                                target = new RegexpControl(code);
                                i++;
                            }
                            else {
                                throw new Error("invalid unicode escape,unexpect control character[" + i + "]:\\c" + code);
                            }
                        }
                        else {
                            if (/[A-Za-z]/.test(code)) {
                                target = new RegexpControl(code);
                                i++;
                            }
                            else {
                                target = new RegexpChar('\\');
                                i--;
                            }
                        }
                    }
                    else if (['d', 'D', 'w', 'W', 's', 'S', 'b', 'B'].includes(next)) {
                        target = new RegexpCharset(input);
                    }
                    else if (['t', 'r', 'n', 'f', 'v'].includes(next)) {
                        target = new RegexpPrint(input);
                    }
                    else if (/^(\d+)/.test(nextAll)) {
                        var no = RegExp.$1;
                        if (curSet) {
                            if (octalRule.test(no)) {
                                var octal = RegExp.$1;
                                target = new RegexpOctal("\\" + octal);
                                i += octal.length - 1;
                            }
                            else {
                                target = new RegexpTranslateChar("\\" + no.charAt(0));
                            }
                        }
                        else {
                            if (no.charAt(0) === '0') {
                                if (no.length === 1) {
                                    target = new RegexpNull();
                                }
                                else {
                                    if (+no.charAt(1) > 7) {
                                        target = new RegexpNull();
                                    }
                                    else {
                                        var octal = no.length >= 3 && +no.charAt(2) <= 7
                                            ? no.slice(1, 3)
                                            : no.charAt(1);
                                        target = new RegexpOctal("\\0" + octal);
                                        i += octal.length;
                                    }
                                }
                            }
                            else {
                                i += no.length - 1;
                                if (+no <= captureGroups.length) {
                                    target = new RegexpReference("\\" + no);
                                    var refGroup = captureGroups[+no - 1];
                                    refGroups[no] = refGroup;
                                    if (refGroup.isAncestorOf(lastGroup)) {
                                        target.ref = null;
                                    }
                                    else {
                                        target.ref = refGroup;
                                    }
                                }
                                else {
                                    target = new RegexpRefOrNumber("\\" + no);
                                    refOrNumbers.push(target);
                                }
                            }
                        }
                    }
                    else if (next === 'k' && /^<([^>]+?)>/.test(context.slice(i))) {
                        var name_1 = RegExp.$1;
                        if (!namedCaptures[name_1]) {
                            throw new Error("Invalid named capture referenced:" + name_1);
                        }
                        else {
                            i += name_1.length + 2;
                            var refGroup = namedCaptures[name_1];
                            target = new RegexpReference("\\" + refGroup.captureIndex, name_1);
                            if (refGroup.isAncestorOf(lastGroup)) {
                                target.ref = null;
                            }
                            else {
                                target.ref = refGroup;
                            }
                        }
                    }
                    else {
                        target = new RegexpTranslateChar(input);
                    }
                    break;
                case s.groupBegin:
                    var isLookaround = lookaroundRule.test(nextAll);
                    if (isLookaround) {
                        var lookType = RegExp.$1;
                        target = new RegexpLookaround(lookType);
                        special = new RegexpSpecial('lookaroundBegin');
                        this.hasLookaround = true;
                        i += lookType.length;
                    }
                    else {
                        target = new RegexpGroup();
                        special = new RegexpSpecial('groupBegin');
                    }
                    if (!isLookaround) {
                        target = target;
                        if (captureRule.test(nextAll)) {
                            var all = RegExp.$1, captureName = RegExp.$2;
                            if (all === '?:') {
                            }
                            else {
                                target.captureIndex = ++groupCaptureIndex;
                                target.captureName = captureName;
                                namedCaptures[captureName] = target;
                            }
                            i += all.length;
                        }
                        else {
                            target.captureIndex = ++groupCaptureIndex;
                        }
                        if (target.captureIndex > 0) {
                            captureGroups.push(target);
                        }
                    }
                    break;
                case s.groupEnd:
                    if (nestQueues.length) {
                        var curNest = nestQueues.pop();
                        var last = (curNest.type === 'group'
                            ? groups
                            : lookarounds).pop();
                        last.isComplete = true;
                        special = new RegexpSpecial(curNest.type + "End");
                        special.parent = last;
                    }
                    else {
                        throw new Error("unmatched " + char + ",you mean \"\\" + char + "\"?");
                    }
                    break;
                case s.groupSplitor:
                    var group = getLastItem(groups);
                    if (!group) {
                        var rootGroup = new RegexpGroup();
                        rootGroup.isRoot = true;
                        rootGroup.addRootItem(queues.slice(1));
                        queues.splice(1, 0, rootGroup);
                        groups.push(rootGroup);
                    }
                    else {
                        group.addNewGroup();
                    }
                    special = new RegexpSpecial('groupSplitor');
                    break;
                case s.setBegin:
                    if (/^\\b]/.test(nextAll)) {
                        target = new RegexpBackspace();
                        i += 3;
                    }
                    else {
                        curSet = new RegexpSet();
                        if (nextAll.charAt(0) === '^') {
                            curSet.reverse = true;
                            i += 1;
                        }
                        addToQueue(curSet);
                        addToGroupOrLookaround(curSet);
                        special = new RegexpSpecial('setBegin');
                        special.parent = curSet;
                    }
                    break;
                case s.setEnd:
                    if (curSet) {
                        curSet.isComplete = true;
                        special = new RegexpSpecial('setEnd');
                        special.parent = curSet;
                        curSet = null;
                    }
                    else {
                        target = new RegexpChar(char);
                    }
                    break;
                case s.rangeSplitor:
                    if (curSet) {
                        if (lastQueue.codePoint < 0) {
                            target = new RegexpChar(char);
                        }
                        else {
                            var nextChar = nextAll.charAt(0);
                            if (nextChar === s.setEnd) {
                                curSet.isComplete = true;
                                curSet = null;
                                i += 1;
                            }
                            else {
                                curSet.pop();
                                curRange = new RegexpRange();
                                curRange.parent = curSet;
                                queues.pop().parent = curRange;
                                addToQueue(curRange, lastQueue);
                                special = new RegexpSpecial('rangeSplitor');
                                special.parent = curRange;
                            }
                        }
                    }
                    else {
                        target = new RegexpChar(char);
                    }
                    break;
                case s.multipleBegin:
                case s.optional:
                case s.multiple:
                case s.leastOne:
                    target =
                        char === s.multipleBegin
                            ? new RegexpTimesMulti()
                            : new (RegexpTimesQuantifiers.bind.apply(RegexpTimesQuantifiers, __spreadArrays([void 0], (this.config.maxRepeat ? [this.config.maxRepeat] : []))))();
                    var num = target.untilEnd(context.slice(i - 1));
                    if (num > 0) {
                        var type = lastQueue instanceof RegexpSpecial
                            ? lastQueue.special
                            : lastQueue.type;
                        var error = "[" + lastQueue.input + "]nothing to repeat[index:" + i + "]:" + context.slice(i - 1, i - 1 + num);
                        if (isWrongRepeat(type, lastQueue)) {
                            throw new Error(error);
                        }
                        else {
                            i += num - 1;
                            if (type === 'groupEnd' || type === 'setEnd') {
                                target.target = lastQueue.parent;
                            }
                            else {
                                target.target = lastQueue;
                            }
                        }
                    }
                    else {
                        target = new RegexpChar(char);
                    }
                    break;
                case s.matchAny:
                    target = new RegexpAny();
                    break;
                case s.beginWith:
                case s.endWith:
                    target = new RegexpAnchor(char);
                    break;
                case s.delimiter:
                    throw new Error("unexpected pattern end delimiter:\"/" + nextAll + "\"");
                default:
                    target = new RegexpChar(char);
            }
            if (target) {
                var cur = target;
                addToQueue(cur);
                if (curRange) {
                    if (target.codePoint < 0) {
                        var _a = queues.splice(-4, 4), first = _a[1], second = _a[3];
                        var middle = new RegexpChar('-');
                        curSet.pop();
                        [first, middle, second].map(function (item) {
                            item.parent = curSet;
                            addToQueue(item);
                            return item;
                        });
                    }
                    else {
                        target.parent = curRange;
                    }
                    curRange = null;
                }
                else if (curSet) {
                    cur.parent = curSet;
                }
                else {
                    addToGroupOrLookaround(cur);
                }
            }
            if (special) {
                if (target) {
                    special.parent = target;
                }
                addToQueue(special);
            }
        }
        if (refOrNumbers.length) {
            var replace_1 = function (lists, search, rep) {
                var idx = 0;
                var finded = false;
                for (var len = lists.length; idx < len; idx++) {
                    if (search === lists[idx]) {
                        finded = true;
                        break;
                    }
                }
                if (finded) {
                    lists.splice.apply(lists, __spreadArrays([idx, 1], rep));
                }
            };
            var refLen_1 = captureGroups.length;
            refOrNumbers.map(function (item) {
                var strNum = item.input.slice(1);
                var total = strNum.length;
                var matchLen = 0;
                var instance;
                if (strNum.charAt(0) !== '0' && +strNum <= refLen_1) {
                    instance = new RegexpReference(item.input);
                    instance.ref = null;
                    matchLen = total;
                }
                else {
                    if (/^([1-3][0-7]{0,2}|[4-7][0-7]?)/.test(strNum)) {
                        var octal = RegExp.$1;
                        instance = new RegexpOctal("\\" + octal);
                        matchLen += octal.length;
                    }
                    else {
                        instance = new RegexpTranslateChar("\\" + strNum.charAt(0));
                        matchLen += 1;
                    }
                }
                instance.linkParent = item.parent;
                var res = [instance];
                while (matchLen < total) {
                    var curChar = new RegexpChar(strNum.charAt(matchLen++));
                    curChar.linkParent = item.parent;
                    res.push(curChar);
                }
                if (item.parent) {
                    replace_1(item.parent.queues, item, res);
                }
                replace_1(queues, item, res);
            });
        }
        if (queues.length > 1 &&
            queues[1].type === 'group' &&
            queues[1].isRoot === true) {
            queues[1].isComplete = true;
        }
        var rootQueues = [];
        var ruleInput = '';
        queues.every(function (queue) {
            if (!queue.isComplete) {
                throw new Error("the regexp segment " + queue.type + " is not completed:" + queue.input);
            }
            if (queue.parent === null) {
                rootQueues.push(queue);
                ruleInput += queue.getRuleInput();
            }
            return true;
        });
        this.ruleInput = ruleInput;
        this.rootQueues = rootQueues;
        this.queues = queues;
    };
    Parser.prototype.checkFlags = function () {
        var _a;
        var flags = this.flags;
        var len = flags.length;
        if (len === 0) {
            return;
        }
        if (len > Object.keys(flagsBinary).length) {
            throw new Error("The rule may has repeated or unrecognized flags<got '" + flags.join('') + "'>, please check.");
        }
        var first = flags[0];
        var totalFlagBinary = flagsBinary[first];
        var flagsHash = (_a = {},
            _a[first] = true,
            _a);
        for (var i = 1, j = flags.length; i < j; i++) {
            var flag = flags[i];
            var binary = flagsBinary[flag];
            if ((totalFlagBinary & binary) === 0) {
                totalFlagBinary += binary;
                flagsHash[flag] = true;
            }
            else {
                throw new Error("wrong flag[" + i + "]:" + flag);
            }
        }
        this.flagsHash = flagsHash;
        this.totalFlagBinary = totalFlagBinary;
        if (flagsHash.y || flagsHash.m || flagsHash.g) {
            console.warn("the flags of 'g','m','y' will ignore,but you can set flags such as 'i','u','s'");
        }
    };
    Parser.prototype.hasFlag = function (flag) {
        var totalFlagBinary = this.totalFlagBinary;
        var binary = flagsBinary[flag];
        return binary && (binary & totalFlagBinary) !== 0;
    };
    Parser.prototype.getFlagsHash = function () {
        return this.flagsHash;
    };
    Parser.maxRepeat = 5;
    return Parser;
}());
exports.default = Parser;
var RegexpPart = (function () {
    function RegexpPart(input) {
        if (input === void 0) { input = ''; }
        this.input = input;
        this.queues = [];
        this.codePoint = -1;
        this.min = 1;
        this.max = 1;
        this.dataConf = {};
        this.buildForTimes = false;
        this.curParent = null;
        this.matchNothing = false;
        this.completed = true;
    }
    Object.defineProperty(RegexpPart.prototype, "parser", {
        get: function () {
            return this.parserInstance;
        },
        set: function (parser) {
            this.parserInstance = parser;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RegexpPart.prototype, "count", {
        get: function () {
            return this.getCodePointCount();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RegexpPart.prototype, "parent", {
        get: function () {
            return this.curParent;
        },
        set: function (value) {
            this.curParent = value;
            if (this.type !== 'special') {
                value.add(this);
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RegexpPart.prototype, "linkParent", {
        set: function (value) {
            this.curParent = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RegexpPart.prototype, "isComplete", {
        get: function () {
            return this.completed;
        },
        set: function (value) {
            this.completed = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RegexpPart.prototype, "isMatchNothing", {
        get: function () {
            return this.matchNothing;
        },
        set: function (value) {
            this.matchNothing = value;
            if (this.parent) {
                this.parent.isMatchNothing = value;
            }
        },
        enumerable: false,
        configurable: true
    });
    RegexpPart.prototype.setRange = function (options) {
        var _this = this;
        Object.keys(options).forEach(function (key) {
            _this[key] = options[key];
        });
    };
    RegexpPart.prototype.add = function (target) {
        this.queues = this.queues.concat(target);
    };
    RegexpPart.prototype.pop = function () {
        return this.queues.pop();
    };
    RegexpPart.prototype.build = function (conf) {
        var _this = this;
        var _a = this, min = _a.min, max = _a.max;
        var result = '';
        if (min === 0 && max === 0) {
        }
        else {
            var total = min + Math.floor(Math.random() * (max - min + 1));
            if (total !== 0) {
                var makeOnce = function () {
                    var cur = _this.prebuild(conf);
                    if (conf.flags && conf.flags.i) {
                        cur = isOptional()
                            ? isOptional()
                                ? cur.toLowerCase()
                                : cur.toUpperCase()
                            : cur;
                    }
                    return cur;
                };
                if (!this.buildForTimes) {
                    result = makeOnce().repeat(total);
                }
                else {
                    while (total--) {
                        result += makeOnce();
                    }
                }
            }
        }
        this.dataConf = conf;
        this.setDataConf(conf, result);
        return result;
    };
    RegexpPart.prototype.untilEnd = function (_context) {
    };
    RegexpPart.prototype.setDataConf = function (_conf, _result) {
    };
    RegexpPart.prototype.isAncestorOf = function (target) {
        do {
            if (target === this) {
                return true;
            }
        } while ((target = target === null || target === void 0 ? void 0 : target.parent));
        return false;
    };
    RegexpPart.prototype.getRuleInput = function (_parseReference) {
        if (this.queues.length) {
            return this.buildRuleInputFromQueues();
        }
        else {
            return this.input;
        }
    };
    RegexpPart.prototype.buildRuleInputFromQueues = function () {
        return this.queues.reduce(function (result, next) {
            return result + next.getRuleInput();
        }, '');
    };
    RegexpPart.prototype.prebuild = function (conf) {
        if (this.queues.length) {
            return this.queues.reduce(function (res, cur) {
                return res + cur.build(conf);
            }, '');
        }
        else {
            return '';
        }
    };
    RegexpPart.prototype.getCodePointCount = function () {
        return 1;
    };
    return RegexpPart;
}());
exports.RegexpPart = RegexpPart;
var RegexpEmpty = (function (_super) {
    __extends(RegexpEmpty, _super);
    function RegexpEmpty(input) {
        var _this = _super.call(this, input) || this;
        _this.min = 0;
        _this.max = 0;
        return _this;
    }
    return RegexpEmpty;
}(RegexpPart));
exports.RegexpEmpty = RegexpEmpty;
var RegexpOrigin = (function (_super) {
    __extends(RegexpOrigin, _super);
    function RegexpOrigin() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RegexpOrigin.prototype.prebuild = function () {
        return this.input;
    };
    return RegexpOrigin;
}(RegexpPart));
exports.RegexpOrigin = RegexpOrigin;
var RegexpReference = (function (_super) {
    __extends(RegexpReference, _super);
    function RegexpReference(input, name) {
        if (name === void 0) { name = ''; }
        var _this = _super.call(this, input) || this;
        _this.name = name;
        _this.type = 'reference';
        _this.ref = null;
        _this.index = Number("" + input.slice(1));
        return _this;
    }
    RegexpReference.prototype.prebuild = function (conf) {
        var ref = this.ref;
        if (ref === null) {
            return '';
        }
        else {
            var captureIndex = ref.captureIndex;
            var captureGroupData = conf.captureGroupData;
            return captureGroupData.hasOwnProperty(captureIndex)
                ? captureGroupData[captureIndex]
                : '';
        }
    };
    return RegexpReference;
}(RegexpPart));
exports.RegexpReference = RegexpReference;
var RegexpSpecial = (function (_super) {
    __extends(RegexpSpecial, _super);
    function RegexpSpecial(special) {
        var _this = _super.call(this) || this;
        _this.special = special;
        _this.type = 'special';
        return _this;
    }
    return RegexpSpecial;
}(RegexpEmpty));
exports.RegexpSpecial = RegexpSpecial;
var RegexpLookaround = (function (_super) {
    __extends(RegexpLookaround, _super);
    function RegexpLookaround(input) {
        var _this = _super.call(this) || this;
        _this.type = 'lookaround';
        _this.looktype = input;
        _this.isComplete = false;
        return _this;
    }
    RegexpLookaround.prototype.getRuleInput = function () {
        return '(' + this.looktype + this.buildRuleInputFromQueues() + ')';
    };
    return RegexpLookaround;
}(RegexpEmpty));
exports.RegexpLookaround = RegexpLookaround;
var RegexpAny = (function (_super) {
    __extends(RegexpAny, _super);
    function RegexpAny() {
        var _this = _super.call(this, '.') || this;
        _this.type = 'any';
        _this.buildForTimes = true;
        return _this;
    }
    RegexpAny.prototype.prebuild = function (conf) {
        return charH.make('.', conf.flags);
    };
    return RegexpAny;
}(RegexpPart));
exports.RegexpAny = RegexpAny;
var RegexpNull = (function (_super) {
    __extends(RegexpNull, _super);
    function RegexpNull() {
        var _this = _super.call(this, '\\0') || this;
        _this.type = 'null';
        return _this;
    }
    RegexpNull.prototype.prebuild = function () {
        return '\x00';
    };
    return RegexpNull;
}(RegexpPart));
exports.RegexpNull = RegexpNull;
var RegexpBackspace = (function (_super) {
    __extends(RegexpBackspace, _super);
    function RegexpBackspace() {
        var _this = _super.call(this, '[\\b]') || this;
        _this.type = 'backspace';
        return _this;
    }
    RegexpBackspace.prototype.prebuild = function () {
        return '\u0008';
    };
    return RegexpBackspace;
}(RegexpPart));
exports.RegexpBackspace = RegexpBackspace;
var RegexpBegin = (function (_super) {
    __extends(RegexpBegin, _super);
    function RegexpBegin() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.type = 'begin';
        return _this;
    }
    return RegexpBegin;
}(RegexpEmpty));
exports.RegexpBegin = RegexpBegin;
var RegexpControl = (function (_super) {
    __extends(RegexpControl, _super);
    function RegexpControl(input) {
        var _this = _super.call(this, "\\c" + input) || this;
        _this.type = 'control';
        _this.codePoint = parseInt(input.charCodeAt(0).toString(2).slice(-5), 2);
        return _this;
    }
    RegexpControl.prototype.prebuild = function () {
        return String.fromCharCode(this.codePoint);
    };
    return RegexpControl;
}(RegexpPart));
exports.RegexpControl = RegexpControl;
var RegexpCharset = (function (_super) {
    __extends(RegexpCharset, _super);
    function RegexpCharset(input) {
        var _this = _super.call(this, input) || this;
        _this.type = 'charset';
        _this.charset = _this.input.slice(-1);
        _this.buildForTimes = true;
        return _this;
    }
    RegexpCharset.prototype.prebuild = function (conf) {
        var charset = this.charset;
        if (charset === 'b' || charset === 'B') {
            console.warn('please do not use \\b or \\B');
            return '';
        }
        else {
            return charH.make(charset, conf.flags);
        }
    };
    RegexpCharset.prototype.getCodePointCount = function () {
        var _a = this, parser = _a.parser, charset = _a.charset;
        var totals = charH.getCharsetInfo(charset, parser.getFlagsHash()).totals;
        return getLastItem(totals);
    };
    return RegexpCharset;
}(RegexpPart));
exports.RegexpCharset = RegexpCharset;
var RegexpPrint = (function (_super) {
    __extends(RegexpPrint, _super);
    function RegexpPrint() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.type = 'print';
        return _this;
    }
    RegexpPrint.prototype.prebuild = function () {
        return new Function('', "return '" + this.input + "'")();
    };
    return RegexpPrint;
}(RegexpPart));
exports.RegexpPrint = RegexpPrint;
var RegexpAnchor = (function (_super) {
    __extends(RegexpAnchor, _super);
    function RegexpAnchor(input) {
        var _this = _super.call(this, input) || this;
        _this.type = 'anchor';
        _this.anchor = input;
        console.warn("the anchor of \"" + _this.input + "\" will ignore.");
        return _this;
    }
    return RegexpAnchor;
}(RegexpEmpty));
exports.RegexpAnchor = RegexpAnchor;
var RegexpChar = (function (_super) {
    __extends(RegexpChar, _super);
    function RegexpChar(input) {
        var _this = _super.call(this, input) || this;
        _this.type = 'char';
        _this.codePoint = input.codePointAt(0);
        return _this;
    }
    return RegexpChar;
}(RegexpOrigin));
exports.RegexpChar = RegexpChar;
var RegexpTranslateChar = (function (_super) {
    __extends(RegexpTranslateChar, _super);
    function RegexpTranslateChar(input) {
        var _this = _super.call(this, input) || this;
        _this.type = 'translate';
        _this.codePoint = input.slice(-1).codePointAt(0);
        return _this;
    }
    RegexpTranslateChar.prototype.prebuild = function () {
        return this.input.slice(-1);
    };
    return RegexpTranslateChar;
}(RegexpOrigin));
exports.RegexpTranslateChar = RegexpTranslateChar;
var RegexpOctal = (function (_super) {
    __extends(RegexpOctal, _super);
    function RegexpOctal(input) {
        var _this = _super.call(this, input) || this;
        _this.type = 'octal';
        _this.codePoint = Number("0o" + input.slice(1));
        return _this;
    }
    RegexpOctal.prototype.prebuild = function () {
        return String.fromCodePoint(this.codePoint);
    };
    return RegexpOctal;
}(RegexpPart));
exports.RegexpOctal = RegexpOctal;
var RegexpRefOrNumber = (function (_super) {
    __extends(RegexpRefOrNumber, _super);
    function RegexpRefOrNumber(input) {
        var _this = _super.call(this, input) || this;
        _this.type = 'refornumber';
        return _this;
    }
    RegexpRefOrNumber.prototype.prebuild = function () {
        throw new Error("the \"" + this.input + "\" must parse again,either reference or number");
    };
    return RegexpRefOrNumber;
}(RegexpPart));
exports.RegexpRefOrNumber = RegexpRefOrNumber;
var RegexpTimes = (function (_super) {
    __extends(RegexpTimes, _super);
    function RegexpTimes() {
        var _this = _super.call(this) || this;
        _this.type = 'times';
        _this.maxNum = Parser.maxRepeat;
        _this.greedy = true;
        _this.minRepeat = 0;
        _this.maxRepeat = 0;
        _this.isComplete = false;
        return _this;
    }
    Object.defineProperty(RegexpTimes.prototype, "target", {
        set: function (target) {
            target.setRange({
                min: this.minRepeat,
                max: this.maxRepeat,
            });
        },
        enumerable: false,
        configurable: true
    });
    RegexpTimes.prototype.untilEnd = function (context) {
        if (this.rule.test(context)) {
            var all = RegExp.$1;
            this.isComplete = true;
            this.input = all;
            this.parse();
            return all.length;
        }
        return 0;
    };
    return RegexpTimes;
}(RegexpPart));
exports.RegexpTimes = RegexpTimes;
var RegexpTimesMulti = (function (_super) {
    __extends(RegexpTimesMulti, _super);
    function RegexpTimesMulti() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.rule = /^(\{(\d+)(,|,(\d*))?}(\??))/;
        return _this;
    }
    RegexpTimesMulti.prototype.parse = function () {
        var min = RegExp.$2, code = RegExp.$3, max = RegExp.$4, optional = RegExp.$5;
        this.greedy = optional !== '?';
        this.minRepeat = parseInt(min, 10);
        this.maxRepeat = Number(max)
            ? parseInt(max, 10)
            : code
                ? this.minRepeat + this.maxNum * 2
                : this.minRepeat;
        if (this.maxRepeat < this.minRepeat) {
            throw new Error("wrong quantifier: {" + this.minRepeat + ", " + this.maxRepeat + "}");
        }
    };
    return RegexpTimesMulti;
}(RegexpTimes));
exports.RegexpTimesMulti = RegexpTimesMulti;
var RegexpTimesQuantifiers = (function (_super) {
    __extends(RegexpTimesQuantifiers, _super);
    function RegexpTimesQuantifiers(maxNum) {
        if (maxNum === void 0) { maxNum = Parser.maxRepeat; }
        var _this = _super.call(this) || this;
        _this.maxNum = maxNum;
        _this.rule = /^(\*\?|\+\?|\?\?|\*|\+|\?)/;
        return _this;
    }
    RegexpTimesQuantifiers.prototype.parse = function () {
        var all = RegExp.$1;
        this.greedy = all.length === 1;
        switch (all.charAt(0)) {
            case '*':
                this.maxRepeat = this.maxNum;
                break;
            case '+':
                this.minRepeat = 1;
                this.maxRepeat = this.maxNum;
                break;
            case '?':
                this.maxRepeat = 1;
                break;
        }
    };
    return RegexpTimesQuantifiers;
}(RegexpTimes));
exports.RegexpTimesQuantifiers = RegexpTimesQuantifiers;
var RegexpSet = (function (_super) {
    __extends(RegexpSet, _super);
    function RegexpSet() {
        var _this = _super.call(this) || this;
        _this.type = 'set';
        _this.reverse = false;
        _this.isMatchAnything = false;
        _this.codePointResult = null;
        _this.isComplete = false;
        _this.buildForTimes = true;
        return _this;
    }
    Object.defineProperty(RegexpSet.prototype, "parser", {
        get: function () {
            return this.parserInstance;
        },
        set: function (parser) {
            this.parserInstance = parser;
            this.makeCodePointResult();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RegexpSet.prototype, "isComplete", {
        get: function () {
            return this.completed;
        },
        set: function (value) {
            this.completed = value;
            if (value === true) {
                var isEmptyQueue = this.queues.length === 0;
                if (isEmptyQueue) {
                    if (this.reverse) {
                        this.isMatchAnything = true;
                    }
                    else {
                        this.isMatchNothing = true;
                    }
                }
                else {
                    this.makeCodePointResult();
                }
            }
        },
        enumerable: false,
        configurable: true
    });
    RegexpSet.prototype.getRuleInput = function () {
        return ('[' + (this.reverse ? '^' : '') + this.buildRuleInputFromQueues() + ']');
    };
    RegexpSet.prototype.prebuild = function (conf) {
        if (this.isMatchAnything) {
            return new RegexpAny().build(conf);
        }
        var queues = this.queues;
        if (this.reverse) {
            return charH.makeOne(this.codePointResult);
        }
        var index;
        if (conf.extractSetAverage) {
            var total_2 = 0;
            var totals = queues.map(function (queue) { return (total_2 = total_2 + queue.count); });
            index = getRandomTotalIndex(totals).index;
        }
        else {
            index = makeRandom(0, queues.length - 1);
        }
        return this.queues[index].build(conf);
    };
    RegexpSet.prototype.makeCodePointResult = function () {
        if (!this.reverse || !this.parser || !this.isComplete)
            return;
        if (!this.codePointResult) {
            var _a = this, queues = _a.queues, parser = _a.parser;
            var flags_1 = parser.getFlagsHash();
            if (queues.length === 1 &&
                queues[0].type === 'charset' &&
                ['w', 's', 'd'].includes(queues[0].charset.toLowerCase())) {
                var charCode = queues[0].charset.charCodeAt(0) ^ 32;
                var charset = String.fromCharCode(charCode);
                this.codePointResult = charH.getCharsetInfo(charset, flags_1);
            }
            else {
                var ranges = queues.reduce(function (res, item) {
                    var type = item.type;
                    var cur;
                    if (type === 'charset') {
                        var charset = item.charset;
                        if (charset === 'b' || charset === 'B') {
                            console.warn('the charset \\b or \\B will ignore');
                            cur = [];
                        }
                        else {
                            cur = charH.getCharsetInfo(charset, flags_1).ranges.slice(0);
                        }
                    }
                    else if (type === 'range') {
                        cur = [
                            item.queues.map(function (e) {
                                return e.codePoint;
                            }),
                        ];
                    }
                    else {
                        cur = [[item.codePoint]];
                    }
                    return res.concat(cur);
                }, []);
                ranges.push([0xd800, 0xdfff], flags_1.u ? [0x110000] : [0x10000]);
                ranges.sort(function (a, b) {
                    return b[0] > a[0] ? -1 : b[0] === a[0] ? (b[1] > a[1] ? 1 : -1) : 1;
                });
                var negated = [];
                var point = 0;
                for (var i = 0, j = ranges.length; i < j; i++) {
                    var cur = ranges[i];
                    var start = cur[0];
                    var end = cur[1] || start;
                    if (point < start) {
                        negated.push(point + 1 === start ? [point] : [point, start - 1]);
                    }
                    point = Math.max(end + 1, point);
                }
                if (negated.length === 0) {
                    this.isMatchNothing = true;
                }
                else {
                    var total_3 = 0;
                    var totals = negated.map(function (item) {
                        if (item.length === 1) {
                            total_3 += 1;
                        }
                        else {
                            total_3 += item[1] - item[0] + 1;
                        }
                        return total_3;
                    });
                    this.codePointResult = { totals: totals, ranges: negated };
                }
            }
        }
    };
    return RegexpSet;
}(RegexpPart));
exports.RegexpSet = RegexpSet;
var RegexpRange = (function (_super) {
    __extends(RegexpRange, _super);
    function RegexpRange() {
        var _this = _super.call(this) || this;
        _this.type = 'range';
        _this.isComplete = false;
        return _this;
    }
    RegexpRange.prototype.add = function (target) {
        _super.prototype.add.call(this, target);
        if (this.queues.length === 2) {
            this.isComplete = true;
            var _a = this.queues, prev = _a[0], next = _a[1];
            if (prev.codePoint > next.codePoint) {
                throw new Error("invalid range:" + prev.getRuleInput() + "-" + next.getRuleInput());
            }
        }
    };
    RegexpRange.prototype.getRuleInput = function () {
        var _a = this.queues, prev = _a[0], next = _a[1];
        return prev.getRuleInput() + '-' + next.getRuleInput();
    };
    RegexpRange.prototype.prebuild = function () {
        var _a = this.queues, prev = _a[0], next = _a[1];
        var min = prev.codePoint;
        var max = next.codePoint;
        return String.fromCodePoint(makeRandom(min, max));
    };
    RegexpRange.prototype.getCodePointCount = function () {
        var _a = this.queues, prev = _a[0], next = _a[1];
        var min = prev.codePoint;
        var max = next.codePoint;
        return max - min + 1;
    };
    return RegexpRange;
}(RegexpPart));
exports.RegexpRange = RegexpRange;
var RegexpHexCode = (function (_super) {
    __extends(RegexpHexCode, _super);
    function RegexpHexCode() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.type = 'hexcode';
        return _this;
    }
    RegexpHexCode.prototype.untilEnd = function (context) {
        var _a = this, rule = _a.rule, codeType = _a.codeType;
        if (rule.test(context)) {
            var all = RegExp.$1, codePoint = RegExp.$2;
            var lastCode = codePoint || all;
            this.codePoint = Number("0x" + lastCode);
            if (this.codePoint > 0x10ffff) {
                throw new Error("invalid unicode code point:\\u{" + lastCode + "},can not great than 0x10ffff");
            }
            this.input = "\\" + codeType + all;
            return all.length;
        }
        return 0;
    };
    return RegexpHexCode;
}(RegexpOrigin));
exports.RegexpHexCode = RegexpHexCode;
var RegexpUnicode = (function (_super) {
    __extends(RegexpUnicode, _super);
    function RegexpUnicode() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.rule = /^([0-9A-Fa-f]{4})/;
        _this.codeType = 'u';
        return _this;
    }
    return RegexpUnicode;
}(RegexpHexCode));
exports.RegexpUnicode = RegexpUnicode;
var RegexpUnicodeAll = (function (_super) {
    __extends(RegexpUnicodeAll, _super);
    function RegexpUnicodeAll() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.rule = /^({(0*[0-9A-Fa-f]{1,6})}|[0-9A-Fa-f]{4})/;
        _this.codeType = 'u';
        return _this;
    }
    return RegexpUnicodeAll;
}(RegexpHexCode));
exports.RegexpUnicodeAll = RegexpUnicodeAll;
var RegexpASCII = (function (_super) {
    __extends(RegexpASCII, _super);
    function RegexpASCII() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.rule = /^([0-9A-Fa-f]{2})/;
        _this.codeType = 'x';
        return _this;
    }
    return RegexpASCII;
}(RegexpHexCode));
exports.RegexpASCII = RegexpASCII;
var RegexpGroupItem = (function (_super) {
    __extends(RegexpGroupItem, _super);
    function RegexpGroupItem(index) {
        var _this = _super.call(this) || this;
        _this.index = index;
        _this.type = 'group-item';
        return _this;
    }
    RegexpGroupItem.prototype.getRuleInput = function (parseReference) {
        var _this = this;
        if (parseReference === void 0) { parseReference = false; }
        return this.queues.reduce(function (res, item) {
            var cur;
            if (parseReference &&
                item.type === 'reference' &&
                item.ref !== null) {
                cur = item.ref.getRuleInput(parseReference);
            }
            else {
                cur = _this.isEndLimitChar(item)
                    ? ''
                    : item.getRuleInput(parseReference);
            }
            return res + cur;
        }, '');
    };
    RegexpGroupItem.prototype.prebuild = function (conf) {
        var _this = this;
        return this.queues.reduce(function (res, queue) {
            var cur;
            if (_this.isEndLimitChar(queue)) {
                console.warn('the ^ and $ of the regexp will ignore');
                cur = '';
            }
            else {
                cur = queue.build(conf);
            }
            return res + cur;
        }, '');
    };
    RegexpGroupItem.prototype.isEndLimitChar = function (target) {
        return target.type === 'anchor';
    };
    return RegexpGroupItem;
}(RegexpPart));
exports.RegexpGroupItem = RegexpGroupItem;
var RegexpGroup = (function (_super) {
    __extends(RegexpGroup, _super);
    function RegexpGroup() {
        var _this = _super.call(this) || this;
        _this.type = 'group';
        _this.captureIndex = 0;
        _this.captureName = '';
        _this.queues = [];
        _this.isRoot = false;
        _this.curGroupItem = null;
        _this.curRule = null;
        _this.isComplete = false;
        _this.buildForTimes = true;
        _this.addNewGroup();
        return _this;
    }
    Object.defineProperty(RegexpGroup.prototype, "isComplete", {
        get: function () {
            return this.completed;
        },
        set: function (value) {
            this.completed = value;
            if (value === true) {
                this.isMatchNothing = this.queues.every(function (item) {
                    return item.isMatchNothing;
                });
            }
        },
        enumerable: false,
        configurable: true
    });
    RegexpGroup.prototype.addNewGroup = function () {
        var queues = this.queues;
        var groupItem = new RegexpGroupItem(queues.length);
        this.curGroupItem = groupItem;
        groupItem.parent = this;
        return groupItem;
    };
    RegexpGroup.prototype.addRootItem = function (target) {
        var _this = this;
        target.map(function (item) {
            if (item.parent === null) {
                item.parent = _this.curGroupItem;
            }
        });
        this.addNewGroup();
    };
    RegexpGroup.prototype.addItem = function (target) {
        target.parent = this.curGroupItem;
    };
    RegexpGroup.prototype.getRuleInput = function (parseReference) {
        if (parseReference === void 0) { parseReference = false; }
        var _a = this, groups = _a.queues, captureIndex = _a.captureIndex, isRoot = _a.isRoot;
        var result = '';
        var segs = groups.map(function (groupItem) {
            return groupItem.getRuleInput(parseReference);
        });
        if (captureIndex === 0 && !isRoot) {
            result = '?:' + result;
        }
        result += segs.join('|');
        return isRoot ? result : "(" + result + ")";
    };
    RegexpGroup.prototype.buildRule = function (flags) {
        if (this.curRule) {
            return this.curRule;
        }
        else {
            var rule = this.getRuleInput(true);
            var flag = Object.keys(flags).join('');
            return (this.curRule = new Function('', "return /^" + rule + "$/" + flag)());
        }
    };
    RegexpGroup.prototype.prebuild = function (conf) {
        var _a = this, groups = _a.queues, captureIndex = _a.captureIndex, captureName = _a.captureName;
        var result = '';
        var flags = conf.flags, namedGroupConf = conf.namedGroupConf;
        var groupsLen = groups.length;
        var filterGroups = [];
        var overrideGroups = [];
        var overrideValues = [];
        var segNamedGroup;
        var segNamedValue = [];
        if (captureName && captureName.includes('_') && namedGroupConf) {
            var segs = captureName.split('_');
            if (segs.length === groupsLen) {
                var hasGroup_1 = false;
                if (typeof namedGroupConf[captureName] === 'object') {
                    var conf_1 = namedGroupConf[captureName];
                    segs.forEach(function (key, index) {
                        if (typeof conf_1[key] === 'boolean' && conf_1[key] === false) {
                        }
                        else {
                            hasGroup_1 = true;
                            var groupItem = groups[index];
                            if (Array.isArray(conf_1[key])) {
                                overrideGroups.push(groupItem);
                                overrideValues.push(conf_1[key]);
                            }
                            else {
                                filterGroups.push(groupItem);
                            }
                        }
                    });
                }
                if (!hasGroup_1) {
                    throw new Error("the specified named group '" + captureName + "' are all filtered by the config.");
                }
                else {
                    var overrideItemNum = overrideGroups.length;
                    if (overrideItemNum) {
                        var index = makeRandom(0, overrideItemNum + filterGroups.length - 1);
                        if (index < overrideItemNum) {
                            segNamedGroup = overrideGroups[index];
                            segNamedValue = overrideValues[index];
                        }
                    }
                }
            }
        }
        if (captureName &&
            namedGroupConf &&
            namedGroupConf[captureName] &&
            (Array.isArray(namedGroupConf[captureName]) || segNamedGroup)) {
            var namedGroup = void 0;
            var curRule = void 0;
            if (!segNamedGroup) {
                namedGroup = namedGroupConf[captureName];
                curRule = this.buildRule(flags);
            }
            else {
                namedGroup = segNamedValue;
                curRule = this.buildRule.call(segNamedGroup, flags);
            }
            var index = makeRandom(0, namedGroup.length - 1);
            result = namedGroup[index];
            if (!curRule.test(result)) {
                throw new Error("the namedGroupConf of " + captureName + "'s value \"" + result + "\" is not match the rule " + curRule.toString());
            }
        }
        else {
            var lastGroups = filterGroups.length ? filterGroups : groups;
            var index = makeRandom(0, lastGroups.length - 1);
            var group = lastGroups[index];
            result = group.build(conf);
        }
        if (captureName) {
            conf.namedGroupData[captureName] = result;
        }
        if (captureIndex) {
            conf.captureGroupData[captureIndex] = result;
        }
        return result;
    };
    return RegexpGroup;
}(RegexpPart));
exports.RegexpGroup = RegexpGroup;

},{}]},{},[13]);
