var demon = (function() {
	'use strict';

	// shortcut for demon.init
	var demon = {};

	// globals.

	// constant that is nice to have easily available.
	demon.dpi = window.devicePixelRatio || window.webkitDevicePixelRatio || 1.0;

	// globals. these should be treated as readonly.
	demon.width = 0; // current width of the screen -- not dpi adjusted.
	demon.height = 0; // current height of the screen -- not dpi adjusted.
	demon.screen = null; // current screen.

	// the actual on-screen canvas. same as demon.screen
	// for webgl or if the noOffscreenCanvas flag was set.
	demon.visibleScreen = null;

	demon.gl = null; // a reference to the screen's gl context, if any.
	demon.ctx = null; // a reference to the screen's 2d context, if any.

	demon.options = null; // options demon was initialized width
	demon.demo = null;

	demon.running = false; // true if we're started and not paused.

	// read-only
	demon.fps = 60.0; // target framerate.
	demon.deltaTime = 1.0/60.0; // target frames per second.
	demon.totalFrames = 0;

	// @TODO(thom): move more things into this, or move everything out of it
	var demonInternal = {}; // namespace for internal variables.
	demon.debug__internals__ = demonInternal;
	function noop() {}
	function passThrough(v) { return v; }


	var DEBUG = true;
	// debugging and logging
	(function() {
		demon.log = console.log.bind(console);
		demon.warn = console.warn ? console.warn.bind(console) : console.log.bind(console, "WARNING: ");
		demon.error = console.error ? console.error.bind(console) : console.log.bind(console, "ERROR: ");
		demon.logWarn = demon.logWarning = demon.warning = demon.warn;
		demon.logError = demon.error;

		function assert(cnd, msg) {
			if (!cnd) {
				demon.logError("Assertation failed:", msg);
				if (DEBUG) {
					debugger;
				}
				else {
					throw new Error("Assertation failed:", msg)
				}
			}
		};
		// like an assert that returns the value of the condition
		function check(cnd, msg) {
			if (!cnd) {
				demon.logError("Check failed:", msg);
				if (DEBUG) {
					debugger;
				}
			}
			return cnd;
		}
		// like check but doesn't ever debugger.
		function checkSoft(cnd, msg) {
			if (!cnd) {
				demon.logError("Check failed: ", msg);
			}
			return cnd;
		}

		demon.assert = assert;
		demon.check = check;
		demon.checkSoft = checkSoft;

		// versions of the above that can't be turned on or off.
		demon.mustAssert = assert;
		demon.mustCheck = check;
		demon.mustCheckSoft = checkSoft;

		demon.setDebug = function(b) {
			DEBUG = b;
			if (b) {
				demon.assert = assert;
				demon.check = check;
				demon.checkSoft = checkSoft;
			}
			else {
				demon.assert = demon.check = demon.checkSoft = passThrough;
			}
		};

	}());



	var keyboardInternal = (function() {
		// map of mnemonics for key names
		demon.KC = demon.KeyCodes = {};
		demon.CodeToKey = {}; // inverse of above map

		// @NOTE(thom) this has been micro-optimized because at one point the profiler
		// seemed to imply it was a problem. (this turned out to be false, but
		// i don't see a reason to undo the optimizations).
		var KEYMAX = 256; // just needs to be bigger than the highest value in keysToCodes (it also needs)

		var keysDown = new Uint8Array(KEYMAX); // 1 if the key is currently down. 0 otherwise.
		var keyChanges = new Uint8Array(KEYMAX); // the number of state transitions that happened to the key.

		// constant (after initialization) lookup that is 1 a keycode is sane.
		var knownKeys = new Uint8Array(KEYMAX);

		// used to clear the buffers faster.
		var keysDown32 = new Uint32Array(keysDown.buffer);
		var keyChanges32 = new Uint32Array(keyChanges.buffer);

		// demon.KC without any dupes/aliases.
		// @TODO(thom): this probably isn't exhaustive.
		var keysToCodes = {
			A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74, K: 75, L: 76, M: 77, N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90,
			Left: 37, Up: 38, Right: 39, Down: 40,
			Escape: 27, Return: 13,
			Backspace: 8, Space: 32, Tab: 9,
			Num0: 48, Num1: 49, Num2: 50, Num3: 51, Num4: 52, Num5: 53, Num6: 54, Num7: 55, Num8: 56, Num9: 57,
			Numpad0: 96, Numpad1: 97, Numpad2: 98, Numpad3: 99, Numpad4: 100, Numpad5: 101, Numpad6: 102, Numpad7: 103, Numpad8: 104, Numpad9: 105,
			NumpadMinus: 109, NumpadPlus: 107, NumpadEqual: 12, NumpadSlash: 111,
			F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117, F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123,

			Tilde: 192, Backtick: 192,
			Shift: 16, Ctrl: 17, Alt: 18,
			Colon: 186, Equals: 187, Comma: 188, Minus: 189, Period: 190, Slash: 191, OpenBracket: 219, CloseBracket: 221, Backslash: 220, Quote: 222
		};

		var kcAliases = { Return: ['Enter'], Escape: ['Esc'], Ctrl: ['Control'], Alt: ['Meta'] };
		// fill demon.KC with keysToCodes and aliases.
		// we explicitly alias 'Return' to 'Enter', 'Escape' to 'Esc',
		// 'Ctrl' to 'Control', and 'Alt' to 'Meta'
		Object.keys(keysToCodes).forEach(function(key) {
			var code = keysToCodes[key];
			demon.assert(code < KEYMAX, "[BUG] keycode for "+key+" is greater than KEYMAX");
			demon.CodeToKey[code] = key;
			knownKeys[code] = 1;
			var keys = [key].concat(kcAliases[key] || []);
			keys.forEach(function(keyName) {
				demon.KC[keyName] = code;
				demon.KC[keyName.toLowerCase()] = code;
				var camelCase = keyName[0].toLowerCase()+keyName.slice(1);
				demon.KC[camelCase] = code;
				var capCase = keyName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()
				demon.KC[capCase] = code;
			});
		});

		demon.mustAssert(KEYMAX > 0 && (KEYMAX % 4) === 0, "Illegal KEYMAX value");

		// true if we should preventDefault on a key. false otherwise.
		// intended to be modified from user code.
		// @TODO(thom): this is janky.
		demon.defaultPreventedKeys = new Array(KEYMAX).map(function() { return true; });
		for (var i = 1; i <= 12; ++i) {
			demon.defaultPreventedKeys[demon.KC["F"+i]] = false;
		}

		function keyToCode(key) {
			var code = 0;
			if (typeof key === 'number') {
				code = key >>> 0;
				if (!demon.checkSoft(code < KEYMAX, "Keycode "+key+" is outside valid range")) {
					return 0;
				}
				demon.checkSoft(knownKeys[code] !== 0, "Keycode "+key+" is not mapped to any known key...");
			}
			else {
				var maybeCode = demon.KC[key];
				if (!demon.checkSoft(maybeCode !== 0, "Unknown key: "+key)) {
					return 0;
				}
				code = maybeCode >>> 0;
			}
			if (!demon.checkSoft(code < KEYMAX && code !== 0, "Keycode for "+key+" is outside valid range: "+code)) {
				return 0;
			}
			return code;
		};

		demon.isKeyDown = demon.keyDown = demon.getKey = isKeyDown;
		demon.isKCDown = demon.kcDown = demon.getKC = isKCDown;

		demon.wasKeyPressed = demon.keyPressed = demon.getKeyPressed = wasKeyPressed;
		demon.wasKCPressed = demon.kcPressed = demon.getKCPressed = wasKCPressed;

		demon.wasKeyReleased = demon.keyReleased = demon.getKeyReleased = wasKeyReleased;
		demon.wasKCReleased = demon.kcReleased = demon.getKCReleased = wasKCReleased;

		demon.keyTransitions = demon.getKeyTransitions = keyTransitions;
		demon.kcTransitions = demon.getKCTransitions = kcTransitions;

		function isKCDown(kc) {
			return !!keysDown[kc >>> 0];
		}

		function isKeyDown(key) {
			return isKCDown(keyToCode(key));
		}

		function kcTransitions(kc) {
			return keyChanges[kc >>> 0];
		}

		function keyTransitions(key) {
			return kcTransitions(keyToCode(key));
		};

		function wasKCPressed(kc) {
			var code = kc >>> 0;
			var isPressed = !!keysDown[code];
			var didChange = !!keyChanges[code];
			return isPressed && didChange;
		}

		function wasKeyPressed(key) {
			return wasKCPressed(keyToCode(key));
		}

		function wasKCReleased(kc) {
			var code = kc >>> 0;
			var isNotPressed = !keysDown[code];
			var didChange = !!keyChanges[code];
			return isNotPressed && didChange;
		}

		function wasKeyReleased(key) {
			return wasKCReleased(keyToCode(key));
		}

		function onKeyDown(e) {
			var kc = e.keyCode >>> 0;
			if (kc > KEYMAX || kc === 0) {
				demon.warn("Unknown keycode value from DOM event.", e);
				return;
			}
			if (!keysDown[kc]) {
				keysDown[kc] = 1;
				keyChanges[kc]++;
			}
			if (demon.defaultPreventedKeys[kc]) {
				e.preventDefault();
			}
		}

		function onKeyUp(e) {
			var kc = e.keyCode >>> 0;
			if (kc > KEYMAX || kc === 0) {
				demon.warn("Unknown keycode value from DOM event.", e);
				return;
			}
			keysDown[kc] = 0;
			keyChanges[kc]++;
			if (demon.defaultPreventedKeys[kc]) {
				e.preventDefault();
			}
		}

		var keyChanges32 = new Uint32Array(keyChanges.buffer);
		var keysDown32 = new Uint32Array(keysDown.buffer);

		function onBlur() {
			var len = keyChanges32.length >>> 0;
			for (var i = 0; i < len; ++i) {
				keyChanges32[i] = 0;
				keysDown32[i] = 0;
			}
		}

		function initKeyboard() {
			window.addEventListener('keydown', onKeyDown);
			window.addEventListener('keyup', onKeyUp);
			window.addEventListener('blur', onBlur);
		};

		function updateKeyboard() {
			var len = keyChanges32.length >>> 0;
			for (var i = 0; i < len; ++i) {
				keyChanges32[i] = 0;
			}
		}

		return {
			init: initKeyboard,
			update: updateKeyboard,
			// for debugging
			keysDown: keysDown,
			keyChanges: keyChanges,
			knownKeys: knownKeys,
		};

	}());

	// mouse crap
	var mouseInternal = (function() {
		// @TODO(thom): wheel
		demon.mouse = { x: 0, y: 0 };
		// @NOTE(thom): support for buttons other than x or y is "experimental".
		// @NOTE(thom): these have one fake button at the front (spot 0) so that we can use it as an
		// 'illegal button' value. we offset valid button indices by 1.
		var mbtnDown    = [false, false, false, false, false, false];
		var mbtnChanges = [0, 0, 0, 0, 0, 0];
		demon.mouseIsInitialized = false;

		demon.isMouseDown = demon.getMouse = demon.mouseDown = isMouseDown;
		demon.mouseTransitions = demon.getMouseTransitions = mouseTransitions;
		demon.wasMousePressed = demon.mousePressed = demon.getMousePressed = wasMousePressed;
		demon.wasMouseReleased = demon.mouseReleased = demon.getMouseReleased = wasMouseReleased;

		function getButton(button) {
			var b = button >>> 0;
			if (b >= mbtnDown.length-1) {
				demon.error("unknown mouse button: ", button);
				return 0;
			}
			return b+1;
		}

		function isMouseDown(button) {
			return mbtnDown[getButton(button)];
		}

		function mouseTransitions(button) {
			return mbtnChanges[getButton(button)];
		}

		function wasMousePressed(button) {
			var btn = getButton(button);
			return mbtnDown[btn] && mbtnChanges[btn] > 0;
		}

		function wasMouseReleased(button) {
			var btn = getButton(button);
			return (!mbtnDown[btn]) && mbtnChanges[btn] > 0;
		}

		var screenBorderInfo = {top: 0, left: 0};
		var screenClientRect = null;
		function getScreenClientRect() {
			if (screenClientRect) {
				return screenClientRect;
			}
			return screenClientRect = demon.visibleScreen.getBoundingClientRect();
		}

		function updateMousePos(lx, ly) {
			var rect = getScreenClientRect();
			lx -= rect.left + screenBorderInfo.left;
			ly -= rect.top + screenBorderInfo.top;
			demon.mouse.x = lx;
			demon.mouse.y = ly;
		}

		function onBlur() {
			for (var i = 0; i < mbtnDown.length; ++i) {
				mbtnDown[i] = false;
				mbtnChanges[i] = 0;
			}
		}

		function onMouseMove(e) {
			e.preventDefault();
			updateMousePos(e.clientX, e.clientY);
		}

		function onMouseDown(e) {
			//e.preventDefault();
			var btn = (e.button+1) || 0;
			if (btn) {
				mbtnDown[btn] = true;
				mbtnChanges[btn]++;
			}
			updateMousePos(e.clientX, e.clientY);
		}

		function onMouseOut(e) {
			onBlur();
			updateMousePos(e.clientX, e.clientY);
		}

		function onMouseUp(e) {
			e.preventDefault();
			var btn = (e.button+1) || 0;
			if (btn) {
				mbtnDown[btn] = false;
				mbtnChanges[btn]++;
			}
			updateMousePos(e.clientX, e.clientY);
		}

		// @TODO(thom): does this need to be public?
		demon.resetCachedClientRect = function() {
			screenClientRect = null;
		}

		function initMouse() {
			demon.assert(demon.visibleScreen != null, "can't initMouse before we have a screen");
			var screen = demon.visibleScreen;
			var style = getComputedStyle(screen, null);
			var borderTop = style.getPropertyValue("border-top-width");
			var borderLeft = style.getPropertyValue("border-left-width");
			screenBorderInfo.top = parseInt(borderTop, 10) || 0;
			screenBorderInfo.left = parseInt(borderLeft, 10) || 0;

			window.addEventListener('resize', demon.resetCachedClientRect);
			window.addEventListener('blur', demon.resetCachedClientRect);
			window.addEventListener('scroll', demon.resetCachedClientRect);

			// @TODO(thom): touch event support...
			screen.addEventListener('mousedown', onMouseDown);
			screen.addEventListener('mousemove', onMouseMove);
			screen.addEventListener('mouseup', onMouseUp);
			screen.addEventListener('mouseout', onMouseOut);
		}

		function updateMouse() {
			for (var i = 0; i < mbtnChanges.length; ++i) {
				mbtnChanges[i] = 0;
			}
			mbtnDown[0] = false;
		}
		return {
			update: updateMouse,
			init: initMouse,
			mbtnChanges: mbtnChanges,
			mbtnDown: mbtnDown
		};
	}());

	// misc game programming utilities -- arrays, math, randomness
	(function() {
		// removes the element at index i in O(1), but doesn't maintain array order.
		demon.fastRemoveAt = function(arr, i) {
			arr[i] = arr[arr.length-1];
			arr.pop();
		};

		// in-place filter in O(n). `func` is called with (elem, i). no .call parameter
		// (manage it yourself), and modify the array from `func` at your own peril
		demon.removeIf = function(arr, func) {
			var j = 0;
			for (var i = 0; i < arr.length; ++i) {
				if (!func(arr[i], i)) {
					arr[j++] = arr[i];
				}
			}
			arr.length = j;
			return arr;
		};

		// does the obvious thing.
		var randIntUpTo = demon.randIntUpTo = function(x) {
			return Math.floor(Math.random() * x);
		}

		// in place shuffle in O(n).
		demon.shuffle = function(arr) {
			for (var i = arr.length-1; i > 0; --i) {
				var r = randIntUpTo(i+1);
				var tmp = arr[r];
				arr[r] = arr[i];
				arr[i] = tmp;
			}
			return arr;
		};

		// does a weighted random choice an array of weights (returns the index).
		demon.weightedChoice = function(arr) {
			if (!demon.check(arr.length != 0, "Empty array given to weightedChoice")) {
				return 0;
			}
			var sum = 0;
			for (var i = 0; i < weights.length; ++i) {
				sum += weights[i];
			}
			sum *= Math.random();
			for (var i = 0; i < weights.length; ++i) {
				sum -= weights[i];
				if (sum <= 0) {
					return i;
				}
			}
			return randIntUpTo(weights.length);
		};

		demon.randInt = function(min, max) {
			if (min == null) {
				max = 0x7fffffff;
				min = 0;
			}
			else if (max == null) {
				max = min;
				min = 0;
			}
			else if (max <= min) {
				return min;
			}
			return Math.floor(Math.random() * (max - min + 1) + min);
		};

		var randIntX = demon.randIntX = function(min, max) {
			return randInt(min, max-1);
		};

		var randFloat = demon.randFloat = function(min, max) {
			if (min == null) {
				max = 1.0;
				min = 0;
			}
			else if (max == null) {
				max = min;
				min = 0;
			}
			else if (max <= min) {
				return min;
			}
			return Math.random() * (max - min) + min;
		};

		// returns the sign of v or 0.
		demon.signOf = function(v) {
			return v < 0 ? -1 : (v > 0 ? 1 : 0);
		};

		// same as signOf but never returns 0.
		demon.signum = function() {
			return v < 0 ? -1 : 1;
		};

		demon.clamp = function(v, min, max) {
			return v < min ? min : (v > max ? max : v);
		};

		demon.lerp = function(a, b, t) {
			return a * (1.0 - t) + b * t;
		};

		demon.clamp01 = demon.saturate = function(v) {
			return v < 0 ? 0 : (v > 1 ? 1 : v);
		};

		demon.sqr = demon.square = function(v) {
			return v*v;
		};

		var cube = demon.cube = function(v) {
			return v*v*v;
		};

		var D2R = Math.PI / 180;
		var R2D = 180 / Math.PI;

		demon.degToRad = demon.toRadians = function(deg) {
			return deg * D2R;
		};

		demon.radToDeg = demon.toDegrees = function(rad) {
			return rad * R2D;
		};

		var wrap = demon.wrap = demon.repeat = function(n, wrapPoint) {
			return n - Math.floor(n / wrapPoint) * wrapPoint;
		};

		demon.pingpong = function(n, end) {
			var v = wrap(n, end*2);
			return end - Math.abs(v - end);
		};

		var magnitudeSquared = demon.magnitudeSquared = demon.magSq = function(x, y) {
			return x*x+y*y;
		}

		var magnitude = demon.magnitude = function(x, y) {
			return Math.sqrt(magnitudeSquared(x, y));
		};

		demon.distance = function(x0, y0, x1, y1) {
			return magnitude(x1-x0, y1-y0);
		};

		demon.distanceSq = demon.distSq = function(x0, y0, x1, y1) {
			return magnitudeSquared(x1-x0, y1-y0);
		};


		demon.TWOPI = Math.PI*2;
		demon.DEG2RAD = D2R;
		demon.RAD2DEG = R2D;
	}());

	// canvas and dom management
	(function() {
		demon.createCanvas = function(width, height, dpiAware) {
			var canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			if (dpiAware) {
				canvas.width = demon.dpi*width;
				canvas.height = demon.dpi*height;
				canvas.style.width = width+"px";
				canvas.style.height = height+"px";
			}
			return canvas;
		}

		demon.addCSS = addCSS;
		function addCSS(css) {
			var head = document.getElementsByTagName('head')[0] || document.body;
			var styleElem = document.createElement('style');
			styleElem.setAttribute('type', 'text/css');
			if ('textContent' in styleElem) {
				styleElem.textContent = css;
			}
			else {
				styleElem.styleSheet.cssText = css;
			}
			head.appendChild(styleElem);
		}

		demon.setStyles = function(elem, styles) {
			Object.keys(styles).forEach(function(key) {
				var value = styles[key];
				if (typeof value === 'number') {
					value = value+"px";
				}
				elem.style[key] = value;
			});
			return elem;
		}

		demonInternal.autoSizedCanvases = [];

		demonInternal.getOverlayCanvas = function() {
			if (demonInternal.overlayCanvas == null) {
				demonInternal.overlayCanvas = demon.createSizeManagedCanvas(true, 100);
				document.body.appendChild(demonInternal.overlayCanvas);
				demonInternal.autoSizedCanvases.push(demonInternal.overlayCanvas);
			}
			return demonInternal.overlayCanvas;
		};

		demon.fatalError = fatalError;
		function fatalError(msg) {
			demon.running = false;
			var canvas = demonInternal.getOverlayCanvas();
			var newCtx = newCanvas.getContext('2d');
			newCtx.fillStyle = 'black';
			newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
			newCtx.font = '80px monospace';
			newCtx.textAlign = 'center';
			newCtx.textBaseline = 'middle';
			newCtx.fillStyle = 'white';
			newCtx.fillText(msg, screen.width/2, screen.height/2);
			throw new Error(msg);
		}

	}());

	function onFullWindowResize() {
		var oldWidth = demon.width;
		var oldHeight = demon.height;
		var width = window.innerWidth;
		var height = window.innerHeight;
		if (oldWidth === width && oldHeight === height) {
			console.log("unchanged resize");
			return;
		}
		demon.width = width;
		demon.height = height;
		demonInternal.autoSizedCanvases.forEach(function(canv) {
			demon.screen.style.width = width+"px";
			demon.screen.style.height = height+"px";

			demon.screen.width = width*demon.dpi;
			demon.screen.height = height*demon.dpi;
		})

		if (demon.running && demon.demo != null && demon.demo.resize) {
			demon.demo.resize(demon.width, demon.height, demon.screen.width, demon.screen.height);
		}
		console.log("resized window from "+oldWidth+"x"+oldHeight+" to "+width+"x"+height);
	}

	var now = demon.now = Date.now;
	if (window.performance != null && window.performance.now != null) {
		now = demon.now = function() { return window.performance.now(); };
	}

	demon.createSizeManagedCanvas = function(overlay, zIndex) {
		var canv = demon.createCanvas(demon.width, demon.height, true);
		demonInternal.autoSizedCanvases.push(canv);
		if (overlay) {
			demon.setStyles(canv, {
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				pointerEvents: 'none',
				zIndex: zIndex || 2,
			});
		}
		return canv;
	};

	demon.destroySizeManagedCanvas = function(c) {
		var ascs = demonInternal.autoSizedCanvases;
		var i = ascs.indexOf(c);
		if (!demon.check(i >= 0, "destroySizeManagedCanvas() on canvas that isn't size managed")) {
			return;
		}
		ascs.splice(i, 1);
	};

	function initWebGL(contextAttributes) {
		try {
			demon.gl = screen.getContext('webgl', contextAttributes) || screen.getContext('experimental-webgl', contextAttributes);
		}
		catch (e) {
			demon.gl = null;
			console.error && console.error(e);
			if (e.statusMsg) {
				demon.fatalError("WebGL initialization failed"+(e.statusMsg ? ": "+e.statusMsg : ""));
			}
			return false;
		}
	};

	function initCanvas2D(attribs) {
		demon.ctx = demon.screen.getContext('2d', attribs);
		if (demon.visibleScreen !== demon.screen) {
			demonInternal.visCtx = demon.visibleScreen.getContext('2d', attribs);
		}
	}

	demon.DEFAULT_OPTIONS = {
		webgl: false,
		fps: 60.0,
		showFPS: true,
		autoScaleDpi: true,
		// draw to an onscreen canvas (disabled for webgl)
		noOffscreenCanvas: false,
		fixedTimestep: true,
		useDebugKeybindings: true,

	};

	demon.DEFAULT_WEBGL_CONTEXT_ATTRIBUTES = {
		failIfMajorPerformanceCaveat: true,
	};


	demon.DEFAULT_2D_CONTEXT_ATTRIBUTES = {
		alpha: false,
	};



	demon.start = start;
	function start(demo, options, contextAttributes) {
		if (options == null) {
			options = {};
		}
		Object.keys(demon.DEFAULT_OPTIONS).forEach(function(key) {
			if (!(key in options)) {
				options[key] = demon.DEFAULT_OPTIONS[key];
			}
		});
		if (contextAttributes == null) {
			if (options.webgl) {
				contextAttributes = demon.DEFAULT_WEBGL_CONTEXT_ATTRIBUTES;
			}
			else {
				contextAttributes = demon.DEFAULT_2D_CONTEXT_ATTRIBUTES;
			}
		}

		demon.addCSS("body, html, canvas { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }");

		var mainScreen = demon.createCanvas(window.innerWidth, window.innerHeight, true);
		demonInternal.autoSizedCanvases.push(mainScreen);

		document.body.innerHTML = '';
		document.body.appendChild(mainScreen);
		demon.visibleScreen = mainScreen;

		demon.width = window.innerWidth;
		demon.height = window.innerHeight;
		demon.options = options;
		if (demon.options.webgl || demon.options.noOffscreenCanvas) {
			demon.screen = mainScreen;
		}
		else {
			demon.screen = demon.createSizeManagedCanvas(false);
		}
		window.addEventListener('resize', onFullWindowResize);

		if (demon.options.webgl) {
			initWebGL(contextAttributes);
		}
		else {
			initCanvas2D(contextAttributes);
		}

		mouseInternal.init();
		keyboardInternal.init();

		demon.fps = options.fps;
		demon.deltaTime = 1.0/options.fps;
		lastPrint = now();
		demon.demo = demo;
		demon.running = true;
		if (demon.options.useDebugKeybindings) {
			window.addEventListener('keydown', function(e) {
				switch (e.keyCode) {
				case demon.KC.Escape:
					demon.togglePause();
					break;
				case demon.KC.Tilde:
					demon.options.showFPS = !demon.options.showFPS;
					break;
				case demon.KC.Space:
					if (!demon.running) {
						keyboardInternal.update();
						mouseInternal.update();
						demon.demo.update(1.0 / demon.options.fps);
						doRender();
					}
					break;
				}
			});
		}
		if (demo.init) {
			demo.init();
		}
		run();
	}

	demon.pause = function() {
		if (demon.demo.pause) {
			demon.demo.pause();
		}
		demon.running = false;
	}

	demon.unpause = function() {
		if (!demon.running) {
			demon.running = true;
			if (demon.demo.unpause) {
				demon.demo.unpause();
			}
			run();
		}
	};

	demon.togglePause = function() {
		if (!demon.running) {
			demon.unpause();
		}
		else {
			demon.pause();
		}
	};


	function doRender() {
		if (demon.demo.render) {
			if (!demon.gl) {
				demon.ctx.save();
				if (demon.options.autoScaleDpi) {
					demon.ctx.scale(demon.dpi, demon.dpi);
				}
				demon.demo.render(demon.ctx, demon.screen);
				demon.ctx.restore();
				if (demon.visibleScreen !== demon.screen) {
					//demonInternal.visCtx.clearRect(0, 0, demon.visibleScreen.width, demon.visibleScreen.height);
					demonInternal.visCtx.drawImage(demon.screen, 0, 0);
				}
			}
			else {
				demon.demo.render(demon.gl);
			}
		}
	}

	var currentTime = 0.0;
	var accum = 0.0;
	var frames = 0;
	var displayMspf = 0;
	var displayUpdateMs = 0;
	var displayRenderMs = 0;
	var displayFps = 0;
	var lastPrint = 0;


	// demon.run = run;
	function run() {
		if (!demon.running) {
			currentTime = 0;
			return;
		}
		if (currentTime === 0) {
			currentTime = now() / 1000.0;
			requestAnimationFrame(run);
			return;
		}
		if (!lastPrint) {
			lastPrint = now();
		}
		var demo = demon.demo;
		var deltaTime = 1.0/demon.options.fps;

		var frameStart = now();
		var newTime = frameStart / 1000.0;
		var frameTime = newTime - currentTime;

		if (frameTime > 20*deltaTime) {
			// coming back from debugger or pause something.
			frameTime = deltaTime;
		}

		currentTime = newTime;

		var updateStart = now();
		if (demon.options.fixedTimestep) {
			accum += frameTime;
			demon.deltaTime = deltaTime;
			while (accum >= deltaTime) {
				demo.update(deltaTime);
				++demon.totalFrames;
				accum -= deltaTime;
				keyboardInternal.update();
				mouseInternal.update();
			}
		}
		else {
			++demon.totalFrames;
			demon.deltaTime = frameTime;
			demo.update(frameTime);
			keyboardInternal.update();
			mouseInternal.update();
		}
		var updateEnd = now();

		requestAnimationFrame(run);
		var renderStart = now();
		doRender();
		var renderEnd = now();

		var frameEnd = now();
		var mspf = (frameEnd - frameStart);
		++frames;
		if (frameEnd - lastPrint > 1000) {
			displayFps = frames;
			lastPrint = frameEnd;
			displayMspf = mspf;
			displayRenderMs = renderEnd - renderStart;
			displayUpdateMs = updateEnd - updateStart;
			frames = 0;
		}
		else if (false && mspf > displayMspf) {
			displayMspf = mspf;
			displayRenderMs = renderEnd - renderStart;
			displayUpdateMs = updateEnd - updateStart;
		}

		if (demon.running && demon.options.showFPS) {
			var canvas = demonInternal.getOverlayCanvas();
			var ctx = canvas.getContext('2d');
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.save();
			{
				ctx.scale(demon.dpi * 0.75, demon.dpi * 0.75);
				ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
				ctx.fillRect(0, 0, 400, 100);
				ctx.font = '15px monospace'
				ctx.fillStyle = 'white'
				var line = 0;
				ctx.fillText("fps:  "+displayFps.toFixed(1), 10, ++line * 17);
				ctx.fillText("ms/f: "+displayMspf.toFixed(3), 10, ++line * 17);
				ctx.fillText("  (u: "+displayUpdateMs.toFixed(3)+")", 10, ++line * 17);
				ctx.fillText("  (r: "+displayRenderMs.toFixed(3)+")", 10, ++line * 17);
			}
			ctx.restore();
		}
	}

	return demon;
}());

if (typeof module !== 'undefined' && module.exports) {
	module.exports = demon;
}
