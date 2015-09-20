'use strict';
var demon = (function() {

	var demon = {};
	demon.DEBUG = (typeof __DEBUG__ !== 'undefined') ? (!!__DEBUG__) : window.DEBUG;
	demon.log = console.log.bind(console);
	demon.logWarn = console.warn ? console.warn.bind(console) : console.log.bind(console, "WARNING: ");
	demon.logError = console.error ? console.error.bind(console) : console.log.bind(console, "ERROR: ");
	demon.debugAssertations = false;
	demon.check = demonCheck;
	function demonCheck(cnd, msg) {
		if (!demon.DEBUG) {
			return cnd;
		}
		if (!cnd) {
			demon.logError("assertation failed");
			if (msg) {
				demon.logError(msg);
			}
			if (demon.debugAssertations) {
				debugger;
			}
			return false;
		}
		return true;
	};

	demon.assert = demonAssert;
	function demonAssert(cnd, msg) {
		if (!demon.DEBUG) {
			return;
		}
		if (!cnd) {
			demon.logError("assertation failed", msg);
			if (demon.debugAssertations) {
				debugger;
			}
			else {
				throw new Error("assertation failed", msg)
			}
		}
	};

	function noopAssert(cnd) {
		return cnd;
	}

	demon.disableAsserts = function() {
		demon.assert = demon.check = noopAssert;
	};

	demon.enableAsserts = function() {
		demon.DEBUG = true;
		demon.assert = demonAssert;
		demon.check = demonCheck;
	};

	demon.dpi = window.devicePixelRatio || window.webkitDevicePixelRatio || 1.0;

	demon.width = 0;
	demon.height = 0;
	demon.screen = null;
	demon.fps = 60.0;

	demon.deltaTime = 1.0/60.0;

	demon.gl = null;
	demon.ctx = null;

	var demonInternal = {};

	// keyboard crap
	(function() {
		demon.KC = {};
		demon.CodeToKey = {};

		var KEYMAX = 256;
		demon.defaultPreventedKeys = new Array(KEYMAX).map(function() { return true; });

		// @TODO(thom): this isn't exhaustive... (not sure how much i care...)
		// @TODO(thom): maybe this should actually be equivalent to the KeyboardEvent.code
		// property values instead?
		var plainKeycodes = {
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
		Object.keys(plainKeycodes).forEach(function(key) {
			var code = plainKeycodes[key];
			demon.CodeToKey[code] = key;
			var keys = [key].concat(kcAliases[key] || []);
			keys.forEach(function(keyName) {
				demon.KC[keyName] = code;
				demon.KC[keyName.toLowerCase()] = code;
				demon.KC[keyName[0].toLowerCase()+keyName.slice(1)] = code;
			});
		});

		var keysDown = new Uint8Array(KEYMAX);
		var keyChanges = new Uint8Array(KEYMAX);
		for (var i = 1; i <= 12; ++i) {
			demon.defaultPreventedKeys[demon.KC["F"+i]] = false;
		}

		function keyToCode(key) {
			var code = 0;
			if (typeof key === 'number') {
				code = key >>> 0;
				return code;
			}
			else {
				var maybeCode = demon.KC[key];
				if (!maybeCode) {
					demon.error("Unknown key!", key);
					return 0;
				}
				code = maybeCode >>> 0;
			}
			if (code > KEYMAX || key === 0) {
				console.error("Keycode is outside valid range!", key)
				return 0;
			}
			return code;
		}

		demon.keyIsDown = keyIsDown;
		demon.kcIsDown = kcIsDown;

		demon.keyTransitions = keyTransitions;
		demon.kcTransitions = kcTransitions;

		demon.keyWasPressed = keyWasPressed;
		demon.kcWasPressed = kcWasPressed;

		demon.keyWasReleased = keyWasReleased;
		demon.kcWasReleased = kcWasReleased;

		function kcIsDown(kc) {
			return !!keysDown[kc >>> 0];
		}

		function keyIsDown(key) {
			return kcIsDown(keyToCode(key));
		}

		function kcTransitions(kc) {
			return keyChanges[kc >>> 0];
		}

		function keyTransitions(key) {
			return kcTransitions(keyToCode(key));
		};

		function kcWasPressed(kc) {
			var code = kc >>> 0;
			var isPressed = !!keysDown[code];
			var didChange = !!keyChanges[code];
			return isPressed && didChange;
		}

		function keyWasPressed(key) {
			return kcWasPressed(keyToCode(key));
		}

		function kcWasReleased(kc) {
			var code = kc >>> 0;
			var isNotPressed = !keysDown[code];
			var didChange = !!keyChanges[code];
			return isNotPressed && didChange;
		}

		function keyWasReleased(key) {
			return kcWasReleased(keyToCode(key));
		}

		demon.keyboardIsInitialized = false;

		function onKeyDown(e) {
			var kc = e.keyCode >>> 0;
			if (kc > KEYMAX || kc === 0) {
				demon.warn("Unknown keycode value", e)
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
				demon.warn("Unknown keycode value", e)
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

		demonInternal.initKeyboard = initKeyboard;
		function initKeyboard() {
			window.addEventListener('keydown', onKeyDown);
			window.addEventListener('keyup', onKeyUp);
			window.addEventListener('blur', onBlur);
		};

		demonInternal.updateKeyboard = updateKB;
		function updateKB() {
			var len = keyChanges32.length >>> 0;
			for (var i = 0; i < len; ++i) {
				keyChanges32[i] = 0;
			}
		}

	}());

	// mouse crap
	(function() {
		var lastMouseX = 0;
		var lastMouseY = 0;
		demon.mouse = { x: 0, y: 0, dx: 0, dy: 0 };
		// not worth doing the crap we did with the keys...
		// @NOTE: right now we don't actually track the values for mouse buttons other than left.

		// @NOTE: these have one fake button at the front (spot 0) so that we can use it as an
		// 'illegal button' value. we offset valid button indices by 1.
		var mbtnDown = [false, false, false, false, false, false];
		var mbtnChanges = [0, 0, 0, 0, 0, 0];
		demon.mouseIsInitialized = false;

		demon.mouseIsDown = mouseIsDown;
		demon.mouseTransitions = mouseTransitions;
		demon.mouseWasPressed = mouseWasPressed;
		demon.mouseWasReleased = mouseWasReleased;

		function getButton(button) {
			var b = button >>> 0;
			if (b >= mbtnDown.length-1) {
				demon.error("unknown mouse button: ", button);
				return 0;
			}
			return b+1;
		}

		function mouseIsDown(button) {
			return mbtnDown[getButton(button)];
		}

		function mouseTransitions(button) {
			return mbtnChanges[getButton(button)];
		}

		function mouseWasPressed(button) {
			var btn = getButton(button);
			return mbtnDown[btn] && mbtnChanges[btn] > 0;
		}

		function mouseWasReleased(button) {
			var btn = getButton(button);
			return (!mbtnDown[btn]) && mbtnChanges[btn] > 0;
		}


		var screenBorderInfo = {top: 0, left: 0};
		var screenClientRect = null;
		function getScreenClientRect() {
			if (screenClientRect) {
				return screenClientRect;
			}
			return screenClientRect = demon.screen.getBoundingClientRect();
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

		demon.resetCachedClientRect = function() {
			screenClientRect = null;
		};

		demonInternal.initMouse = initMouse;
		function initMouse() {
			demon.assert(demon.screen != null, "can't initMouse before we have a screen");
			var screen = demon.screen;
			var style = getComputedStyle(screen, null);
			var borderTop = style.getPropertyValue("border-top-width");
			var borderLeft = style.getPropertyValue("border-left-width");
			screenBorderInfo.top = parseInt(borderTop, 10) || 0;
			screenBorderInfo.left = parseInt(borderLeft, 10) || 0;

			window.addEventListener('resize', demon.resetCachedClientRect);
			window.addEventListener('blur', demon.resetCachedClientRect);
			window.addEventListener('scroll', demon.resetCachedClientRect);

			// @TODO: touch event support...
			demon.screen.addEventListener('mousedown', onMouseDown);
			demon.screen.addEventListener('mousemove', onMouseMove);
			demon.screen.addEventListener('mouseup', onMouseUp);
			demon.screen.addEventListener('mouseout', onMouseOut);
		}

		demonInternal.updateMouse = updateMouse;
		function updateMouse() {
			for (var i = 0; i < mbtnChanges.length; ++i) {
				mbtnChanges[i] = 0;
			}
			mbtnDown[0] = false;

			demon.mouse.dx = demon.mouse.x - lastMouseX;
			demon.mouse.dy = demon.mouse.y - lastMouseY;
			lastMouseX = demon.mouse.x;
			lastMouseY = demon.mouse.y;
		}

	}());

	// rng and math utils
	(function() {
		var randomInt = demon.randomInt = function randomInt(min, max) {
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
			return Math.floor(Math.random(max - min + 1) + min);
		};

		var randomIntX = demon.randomIntX = function randomIntX(min, max) {
			return randomInt(min, max-1);
		};

		var randomFloat = demon.randomFloat = function randomFloat(min, max) {
			if (max <= min) {
				return min;
			}
			return Math.random() * (max - min) + min;
		};

		var signOf = demon.signOf = function signOf(v) {
			return v < 0 ? -1 : (v > 0 ? 1 : 0);
		};

		var clamp = demon.clamp = function clamp(v, min, max) {
			return v < min ? min : (v > max ? max : v);
		};

		var lerp = demon.lerp = function lerp(a, b, t) {
			return a * (1.0 - t) + b * t;
		};

		var clamp01 = demon.clamp01 = function clamp01(v) {
			return clamp(v, 0, 1)
		};

		var sqr = demon.sqr = function sqr(v) {
			return v*v;
		};

		var cube = demon.cube = function cube(v) {
			return v*v*v;
		};

	}());


	// some utilities that are needed for the rest of the code but are generally useful.
	demon.createCanvas = createCanvas;
	function createCanvas(width, height, dpiAware) {
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

	demon.setStyles = setStyles;
	function setStyles(elem, styles) {
		Object.keys(styles).forEach(function(key) {
			var value = styles[key];
			if (typeof value === 'number') {
				value = value+"px";
			}
			elem.style[key] = value;
		});
		return elem;
	}

	demonInternal.getOverlayCanvas = function() {
		if (demonInternal.overlayCanvas == null) {
			demonInternal.overlayCanvas = setStyles(createCanvas(demon.width, demon.height, true), {
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				pointerEvents: 'none',
				zIndex: 2,
			});
			document.body.appendChild(demonInternal.overlayCanvas);
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

		demon.screen.style.width = width+"px";
		demon.screen.style.height = height+"px";

		demon.screen.width = width*demon.dpi;
		demon.screen.height = height*demon.dpi;

		if (demonInternal.overlayCanvas) {
			demonInternal.overlayCanvas.style.width = width+"px";
			demonInternal.overlayCanvas.style.height = height+"px";

			demonInternal.overlayCanvas.width = width*demon.dpi;
			demonInternal.overlayCanvas.height = height*demon.dpi;
		}
		if (demon.running && demon.demo != null && demon.demo.onResize) {
			demon.demo.onResize();
		}
		console.log("resized window from "+oldWidth+"x"+oldHeight+" to "+width+"x"+height);
	}


	var now = demon.now = Date.now;
	if (window.performance != null && window.performance.now != null) {
		now = demon.now = function() { return window.performance.now(); };
	}



	function initFullWindow() {
		demon.screen = createCanvas(window.innerWidth, window.innerHeight, true);
		demon.width = window.innerWidth;
		demon.height = window.innerHeight;
		window.addEventListener('resize', onFullWindowResize);
		document.body.innerHTML = '';
		addCSS("body, html, canvas {width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }");
		document.body.appendChild(demon.screen);
	}

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

	function initCanvas2D() {
		demon.ctx = demon.screen.getContext('2d');
	}

	demon.DEFAULT_OPTIONS = {
		webgl: false,
		fps: 60.0,
		// means create our own and fill the window
		// @TODO: demon should support fixed size (or at least fixed aspect) screens too
		screen: null
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
		var screen = options.screen;
		if (screen == null) {
			initFullWindow();
		}
		else if ('getContext' in screen) {
			demon.screen = screen;
			demon.width = screen.width;
			demon.height = screen.height;

			screen.style.width = demon.width+"px";
			screen.style.height = demon.height+"px";

			screen.width = (demon.width*demon.dpi);
			screen.height = (demon.height*demon.dpi);
		}
		else {
			demon.logError("illegal value provided for options.screen ", options.screen, options);
			initFullWindow();
		}

		demonInternal.initMouse();
		demonInternal.initKeyboard();

		if (contextAttributes == null) {
			if (options.webgl) {
				contextAttributes = demon.DEFAULT_WEBGL_CONTEXT_ATTRIBUTES;
			}
			else {
				contextAttributes = demon.DEFAULT_2D_CONTEXT_ATTRIBUTES;
			}
		}
		if (options.webgl) {
			initWebGL();
		}
		else {
			initCanvas2D();
		}
		demon.showFPS = options.showFPS;

		demon.fps = options.fps;
		demon.deltaTime = 1.0/options.fps;
		lastPrint = now();
		demon.demo = demo;
		demon.running = true;
		run();
	}

	demon.pause = pause;
	demon.unpause = unpause;

	function pause() {
		demon.running = false;
	}

	function unpause() {
		if (!demon.running) {
			demon.running = true;
			demon.run();
		}
	}

	var currentTime = 0.0;
	var accum = 0.0;
	var frames = 0;
	var displayMspf = 0;
	var displayFps = 0;
	var lastPrint = 0;

	demon.totalFrames = 0;

	// demon.run = run;
	function run() {
		if (!demon.running) {
			return;
		}
		if (!lastPrint) {
			lastPrint = now();
		}
		var demo = demon.demo;
		var deltaTime = demon.deltaTime;

		var frameStart = now();
		var newTime = frameStart / 1000.0;
		var frameTime = newTime - currentTime;
		if (frameTime > 20*deltaTime) {
			// coming back from debugger or pause something.
			frameTime = deltaTime;
		}
		currentTime = newTime;
		accum += frameTime;
		//console.time('update');
		while (accum >= deltaTime) {
			demo.update(deltaTime);
			++demon.totalFrames;
			accum -= deltaTime;
			demonInternal.updateKeyboard();
			demonInternal.updateMouse();
		}
		//console.timeEnd('update');
		requestAnimationFrame(run);
		//console.time('render');
		{
			if (!demon.gl) {
				demon.ctx.clearRect(0, 0, demon.screen.width, demon.screen.height);
				demon.ctx.save();
				demon.ctx.scale(demon.dpi, demon.dpi);
				demo.render(demon.ctx, demon.screen);
				demon.ctx.restore();
			}
			else {
				demo.render(demon.gl);
			}
		}
		//console.timeEnd('render');
		var frameEnd = now();
		var fps = 1.0 / frameTime;
		var mspf = (frameEnd - frameStart);
		++frames;
		if (frameEnd - lastPrint > 1000) {
			displayFps = frames;
			lastPrint = frameEnd;
			displayMspf = mspf;
			frames = 0;
		}
		else if (false && mspf > displayMspf) {
			displayMspf = mspf;
		}

		if (demon.running && demon.showFPS) {
			var canvas = demonInternal.getOverlayCanvas();
			var ctx = canvas.getContext('2d');
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.save();
			{
				ctx.scale(demon.dpi, demon.dpi);
				ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
				ctx.fillRect(0, 0, 200, 60);
				ctx.font = '15px monospace'
				ctx.fillStyle = 'white'
				ctx.fillText("fps:  "+displayFps.toFixed(1), 10, 15);
				ctx.fillText("mspf: "+displayMspf.toFixed(3), 10, 40);
			}
			ctx.restore();
		}
	}

	return demon;
}());

if (typeof module !== 'undefined' && module.exports) {
	module.exports = demon;
}
