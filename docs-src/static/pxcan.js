'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var pxcan = function pxcan(element) {
  var _this = this;

  // vars
  var self = this;
  element = element || window;
  if (typeof element === 'string') element = document.querySelector(element);
  var mode = { name: 'adapt' };
  var width = element.clientWidth || element.innerWidth;
  var height = element.clientHeight || element.innerWidth;
  var scale = 3;
  var needsRepaint = true;
  var prevDims = null;
  var font = "px8";
  var sheets = {};
  var _origin = { x: 0, y: 0 };
  var _offset = { x: 0, y: 0 };
  var binds = {};
  var buttons = {};
  var touch = {
    changed: false,
    isDown: false,
    isMouse: undefined,
    isRightClick: undefined,
    wasStarted: false,
    moved: false,
    isDrag: false,
    wasReleased: false,
    wasInterrupted: false,
    cur: undefined,
    last: undefined,
    start: undefined,
    x: null,
    y: null,
    inBounds: null,
    rel: null,
    bounded: null,
    unbounded: null
  };
  var frameskipCounter = 0;
  var clock = 0;

  // create canvas element
  var canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.margin = 'auto';
  // drawing context
  var context = canvas.getContext('2d');
  // if we're adding it to the WINDOW then make sure it is fullscreeny
  if (element == window) {
    var body = document.querySelector('body');
    body.style.padding = 0;
    body.style.margin = 0;
    body.style.overflow = 'hidden';
  }
  // put canvas on page
  (element !== window ? element : document.getElementsByTagName('body')[0]).appendChild(canvas);
  // make it selectable (if it's not just in the window)
  if (element !== window && element.tabIndex < 0) element.tabIndex = 0;

  // public properties
  function DEF(name, attr) {
    if (typeof attr === 'function') Object.defineProperty(self, name, { get: attr });else Object.defineProperty(self, name, attr);
  }
  DEF('id', { value: pxcan.assignId(this) });
  DEF('element', function () {
    return element;
  });
  DEF('canvas', function () {
    return canvas;
  });
  DEF('context', function () {
    return context;
  });
  DEF('canvasOffX', function () {
    return 0;
  });
  DEF('canvasOffY', function () {
    return 0;
  });
  DEF('left', function () {
    return Math.round(-_offset.x - width * (_origin.x + 1) / 2);
  });
  DEF('top', function () {
    return Math.round(-_offset.y - height * (_origin.y + 1) / 2);
  });
  DEF('right', function () {
    return _this.left + width - 1;
  });
  DEF('bottom', function () {
    return _this.top + height - 1;
  });
  DEF('width', function () {
    return width;
  });
  DEF('height', function () {
    return height;
  });
  DEF('drawScale', function () {
    return scale;
  });
  DEF('wasResized', function () {
    return needsRepaint;
  });
  DEF('clock', function () {
    return clock;
  });
  DEF('frameskip', { value: 0, writable: true });
  this.origin = function (x, y) {
    if (arguments.length === 0) return { x: _origin.x, y: _origin.y };
    if (arguments.length === 2) _origin = { x: x, y: y };else throw new Error('invalid arguments for origin');
  };
  this.offset = function (x, y) {
    if (arguments.length === 0) return { x: _offset.x, y: _offset.y };
    if (arguments.length === 2) _offset = { x: x, y: y };else throw new Error('invalid arguments for offset');
  };
  DEF('font', {
    set: function set(x) {
      if (!this.hasSheet(x)) throw new Error('invalid font: ' + x);
      font = x;
    },
    get: function get() {
      if (!font) throw new Error('font has not been set.');
      return font;
    }
  });

  // screen mode/sizing components
  this.mode = function (newMode) {
    // if no arguments are given, treat as getter function
    if (arguments.length === 0) return mode.name;
    // otherwise set appropriately
    if (newMode === 'adapt') {
      mode = { name: 'adapt' };
      scale = arguments[1] || 1;
      canvas.style.width = '';
      canvas.style.height = '';
    } else if (newMode === 'fixed') {
      mode = { name: 'fixed' };
      if (arguments.length <= 2) {
        scale = arguments[1] || 1;
        width = Math.floor((element.clientWidth || element.innerWidth) / scale);
        height = Math.floor((element.clientHeight || element.innerHeight) / scale);
      } else {
        width = arguments[1];
        height = arguments[2];
        scale = arguments[3] || 1;
      }
      canvas.style.width = '';
      canvas.style.height = '';
    } else if (newMode === 'scale-overflow') {
      mode = {
        name: 'scale-overflow',
        minWidth: arguments[1] || element.clientWidth || element.innerWidth,
        minHeight: arguments[2] || element.clientHeight || element.innerHeight
      };
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    } else if (newMode === 'scale') {
      throw new Error('not yet supported.');
    } else {
      throw new Error('unknown mode type.');
    }
    // reset these
    needsRepaint = true;
    prevDims = null;
    this.fitElement();
  };

  this.setSize = function (w, h) {
    if (mode.name === 'fixed' || mode.name === 'scale') {
      width = w;
      height = h;
    } else if (mode.name === 'scale-overflow') {
      mode.minWidth = w;
      mode.minHeight = h;
    } else {
      throw new Error('screen mode does not support setSize: ' + mode.name);
    }
    this.fitElement();
  };

  this.setScale = function (s) {
    if (mode.name === 'adapt' || mode.name === 'fixed') {
      scale = s;
    } else {
      throw new Error('screen mode does not support setScale: ' + mode.name);
    }
    this.fitElement();
  };

  // screen fitting
  this.fitElement = function () {
    // get the current width/height of the elemnt
    var w = element.clientWidth || element.innerWidth;
    var h = element.clientHeight || element.innerHeight;
    // has it actually changed? if not, no need to fit it.
    needsRepaint = !prevDims || prevDims.w !== w || prevDims.h !== h;
    if (!needsRepaint) return;
    // otherwise, do the correct resize function for the mode
    if (mode.name === 'adapt') fitAdapt(w, h);else if (mode.name === 'fixed') fitFixed(w, h);else if (mode.name === 'scale-overflow') fitScaleOverflow(w, h);
    // if the view is the whole window, then keep it at the right location
    if (element === window) {
      window.scrollTo(0, 0);
    }
    // record previous dimensions
    prevDims = { w: w, h: h };
  };

  function fitAdapt(w, h) {
    // resize canvas to fill window
    canvas.width = (width = Math.floor(w / scale)) * scale;
    canvas.height = (height = Math.floor(h / scale)) * scale;
  }

  function fitFixed(w, h) {
    // just resize to the expected dimensions if it's not already that
    if (canvas.width !== width * scale) canvas.width = width * scale;
    if (canvas.height !== height * scale) canvas.height = height * scale;
  }

  function fitScaleOverflow(w, h) {
    // if the desired aspect ratio is equal
    if (mode.minWidth * h === mode.minHeight * w) {
      width = mode.minWidth;
      height = mode.minHeight;
    }
    // if it needs to be WIDER
    else if (mode.minWidth * h < mode.minHeight * w) {
        width = Math.floor(w / h * mode.minHeight);
        height = mode.minHeight;
      }
      // if it needs to be TALLER
      else {
          width = mode.minWidth;
          height = Math.floor(h / w * mode.minWidth);
        }
    // draw at a lower scale...
    scale = Math.floor(Math.min(h / height, w / width));
    if (scale < 1) scale = 1; //unless it's smaller than minimum
    canvas.width = width * scale;
    canvas.height = height * scale;
  }

  this.fitElement();

  // sheet loading
  this.preload = function (src, alias, w, h) {
    if (!alias && alias !== 0) throw new Error("missing alias");
    if (sheets[alias]) throw new Error("sheet already exists with alias " + alias);
    if (pxcan.globalSheets[alias]) throw new Error("global sheet already exists with alias " + alias);
    if (!pxcan.hasImage(src)) {
      pxcan.preload(src, this);
    }
    sheets[alias] = new pxcan.Sheet(alias, src, w, h);
  };

  this.sheet = function (alias) {
    if (sheets[alias]) return sheets[alias];
    if (pxcan.globalSheets[alias]) return pxcan.globalSheets[alias];
    throw new Error("invalid sheet: " + alias);
  };

  this.hasSheet = function (alias) {
    return !!(sheets[alias] || pxcan.globalSheets[alias]);
  };

  // onReady and onFrame events
  DEF('isPreloading', function () {
    return pxcan.isPreloading(_this);
  });
  var _onready = null;
  DEF('onReady', {
    get: function get() {
      return _onready;
    },
    set: function set(x) {
      if (x && !this.isPreloading) x.call(this);else _onready = x;
    }
  });
  DEF('onFrame', { writable: true });

  var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.oRequestAnimationFrame;
  function rafFunc() {
    ++frameskipCounter;
    if (frameskipCounter > self.frameskip) {
      frameskipCounter = 0;
      // re-fit screen
      self.fitElement();
      // call frame function
      if (self.onFrame && !self.isPreloading) self.onFrame.call(self, self);
      // update input state
      updateButtons();
      updateTouch();
      // update clock
      ++clock;
    }
    // queue next call
    raf(rafFunc);
  }
  raf(rafFunc);

  // built-in button functions 
  this.bind = function (button /*, key1, [key2, [...]] */) {
    for (var i = 1; i < arguments.length; ++i) {
      var code = arguments[i];
      if (typeof code === 'string') code = code.toUpperCase().charCodeAt(0);
      binds[code] = button;
    }
    buttons[button] = {
      wasPressed: false,
      wasReleased: false,
      isDown: false,
      framesDown: 0
    };
  };

  this.button = function (b) {
    return buttons[b];
  };

  this.pad = function () /* ...buttons */{
    var padButtons;
    if (arguments.length === 1 && arguments[0] instanceof Array) padButtons = arguments[0];else padButtons = Array.prototype.slice.call(arguments);

    padButtons = padButtons.filter(function (x) {
      return buttons[x].isDown;
    });
    if (padButtons.length === 0) return null;
    return padButtons.reduce(function (a, b) {
      return buttons[b].framesDown < buttons[a].framesDown ? b : a;
    }, padButtons[0]);
  };

  function keyevt(evt) {
    if (binds[evt.keyCode] === undefined) return true;

    evt.preventDefault();
    var button = buttons[binds[evt.keyCode]];
    if (evt.type === 'keydown' && button.framesDown === 0) {
      button.wasPressed = button.isDown = true;
      button.framesDown = 0;
    } else if (evt.type === 'keyup' && button.isDown) {
      button.wasReleased = true;
      button.isDown = false;
    }
  }
  element.addEventListener("keydown", keyevt, false);
  element.addEventListener("keyup", keyevt, false);

  function updateButtons() {
    for (var b in buttons) {
      if (buttons[b].wasPressed) buttons[b].wasPressed = false;
      if (buttons[b].wasReleased) buttons[b].wasReleased = false;
      if (buttons[b].isDown) ++buttons[b].framesDown;else buttons[b].framesDown = 0;
    }
  }

  // touch stuff (mouse and touch)
  DEF('touch', function () {
    return touch;
  });
  DEF('contextMenu', { value: true, writable: true });

  function evtToCoords(evt) {
    // raw coordinates relative to screen top left
    var xOnScreen = evt.clientX - (element.clientLeft || 0) - (element.offsetLeft || 0) + window.scrollX;
    var yOnScreen = evt.clientY - (element.clientTop || 0) - (element.offsetTop || 0) + window.scrollY;

    // pixel based coordinates relative to screen top left
    return {
      fromLeft: Math.floor(xOnScreen / (element.clientWidth || element.innerWidth) * self.width),
      fromTop: Math.floor(yOnScreen / (element.clientHeight || element.innerHeight) * self.height)
    };
  }
  function TouchPoint(fromLeft, fromTop, ref, bounded) {
    ref = ref || self;
    bounded = bounded || false;

    Object.defineProperty(this, 'x', { get: function get() {
        return (bounded ? pxMath.clamp(fromLeft, ref.canvasOffX + 0, ref.canvasOffX + ref.width - 1) : fromLeft) + ref.left - ref.canvasOffX;
      } });
    Object.defineProperty(this, 'y', { get: function get() {
        return (bounded ? pxMath.clamp(fromTop, ref.canvasOffY + 0, ref.canvasOffY + ref.height - 1) : fromTop) + ref.top - ref.canvasOffY;
      } });
    Object.defineProperty(this, 'inBounds', { get: function get() {
        return bounded || this.x === this.bounded().x && this.y === this.bounded().y;
      } });
    this.rel = function (ref, bounded) {
      if (['bounded', 'b', 'unbounded', 'u', undefined].indexOf(bounded) === -1) {
        throw new Error('bad value for "bounded" parameter.');
      }
      return new TouchPoint(fromLeft, fromTop, ref, bounded && bounded.startsWith('b'));
    };
    (function (self) {
      self.bounded = function () {
        return self.rel(ref, 'bounded');
      };
      self.unbounded = function () {
        return self.rel(ref, 'unbounded');
      };
    })(this);
  }

  ['x', 'y', 'inBounds', 'rel', 'bounded', 'unbounded'].forEach(function (attr) {
    Object.defineProperty(touch, attr, { get: function get() {
        if (touch.cur === undefined) throw new Error('No touch events happening.');
        return touch.cur[attr];
      } });
  });

  function onTouchStart(fromLeft, fromTop) {
    touch.cur = touch.last = touch.start = new TouchPoint(fromLeft, fromTop);
    touch.changed = true;
    touch.isDown = true;
    touch.wasStarted = true;
  }
  function onTouchMove(fromLeft, fromTop) {
    touch.cur = new TouchPoint(fromLeft, fromTop);

    if (touch.x === touch.last.x && touch.y === touch.last.y) return;
    touch.changed = true;
    touch.moved = true;
    touch.isDrag = true;
  }
  function onTouchEnd() {
    touch.changed = true;
    touch.isDown = false;
    touch.wasReleased = true;
  }

  function updateTouch() {
    touch.changed = false;
    touch.wasStarted = false;
    touch.moved = false;
    touch.wasReleased = false;
    touch.wasInterrupted = false;
    if (touch.isDown) {
      touch.last = touch.cur;
    } else {
      touch.cur = touch.last = touch.start = undefined;
      touch.isMouse = undefined;
      touch.isRightClick = undefined;
      touch.isDrag = false;
    }
  }

  // mouse!
  element.addEventListener("mousedown", function (mouseEvt) {
    if (touch.isDown) return;
    var coords = evtToCoords(mouseEvt);
    onTouchStart(coords.fromLeft, coords.fromTop);
    touch.isMouse = true;
    touch.isRightClick = mouseEvt.button === 2;
  }, false);

  window.addEventListener("mousemove", function (mouseEvt) {
    if (!touch.isMouse) return;
    var coords = evtToCoords(mouseEvt);
    onTouchMove(coords.fromLeft, coords.fromTop);
  }, false);

  window.addEventListener("mouseup", function (mouseEvt) {
    if (!touch.isMouse) return;
    onTouchEnd();
  }, false);

  // touch.
  var currentTouchId = undefined;
  element.addEventListener("touchstart", function (touchEvt) {
    touchEvt.preventDefault();
    if (touch.isDown) return;

    var coords = evtToCoords(touchEvt.changedTouches[0]);
    onTouchStart(coords.fromLeft, coords.fromTop);
    touch.isMouse = false;
    currentTouchId = touchEvt.changedTouches[0].identifier;
  }, false);

  element.addEventListener("touchmove", function (touchEvt) {
    touchEvt.preventDefault();
    if (!touch.isDown || touch.isMouse) return;

    var currentTouch = Array.prototype.find.call(touchEvt.changedTouches, function (e) {
      return e.identifier === currentTouchId;
    });
    if (!currentTouch) return;

    var coords = evtToCoords(currentTouch);
    onTouchMove(coords.fromLeft, coords.fromTop);
  }, false);

  element.addEventListener("touchend", function (touchEvt) {
    touchEvt.preventDefault();
    if (!touch.isDown || touch.isMouse) return;

    var currentTouch = Array.prototype.find.call(touchEvt.changedTouches, function (e) {
      return e.identifier === currentTouchId;
    });
    if (!currentTouch) return;

    if (touchEvt.targetTouches.length === 0) {
      // no more touches; release
      onTouchEnd();
      currentTouchId = null;
    } else {
      // other touches on screen; 'drag' to the lastest one
      var nextTouch = touchEvt.targetTouches[touchEvt.targetTouches.length - 1];
      currentTouchId = nextTouch.identifier;
      onTouchMove(nextTouch);
    }
  }, false);

  // optional right click menu event capture
  element.addEventListener("contextmenu", function (e) {
    if (!self.contextMenu) e.preventDefault();
  });

  // does this element have focus?
  DEF('hasFocus', function () {
    return document.hasFocus() && document.activeElement === element;
  });
};
pxcan.Panel = function (parent, x, y, w, h, xAnchor, yAnchor) {
  // verify arguments
  if ([5, 7].indexOf(arguments.length) === -1) throw new Error('invalid number of arguments.');
  // vars
  if (arguments.length === 5) {
    xAnchor = parent.origin().x;
    yAnchor = parent.origin().y;
  }
  var self = this;
  var font = null;
  var _origin = parent.origin();
  var _offset = parent.offset();
  var screen = parent.screen || parent;

  // subcanvas size
  this.canvasOffX = Math.round(parent.canvasOffX + x + parent.width * (parent.origin().x + 1) / 2 - w * (xAnchor + 1) / 2);
  this.canvasOffY = Math.round(parent.canvasOffY + y + parent.height * (parent.origin().y + 1) / 2 - h * (yAnchor + 1) / 2);
  var width = Math.round(w);
  var height = Math.round(h);

  // inherited properties
  ['element', 'canvas', 'context', 'drawScale', 'sheet'].forEach(function (attr) {
    Object.defineProperty(self, attr, { get: function get() {
        return screen[attr];
      } });
  });

  // public properties
  Object.defineProperty(this, 'screen', { get: function get() {
      return screen;
    } });
  Object.defineProperty(this, 'left', { get: function get() {
      return Math.round(_offset.x - width * (_origin.x + 1) / 2);
    } });
  Object.defineProperty(this, 'top', { get: function get() {
      return Math.round(_offset.y - height * (_origin.y + 1) / 2);
    } });
  Object.defineProperty(this, 'right', { get: function get() {
      return this.left + width - 1;
    } });
  Object.defineProperty(this, 'bottom', { get: function get() {
      return this.top + height - 1;
    } });
  Object.defineProperty(this, 'width', { get: function get() {
      return width;
    } });
  Object.defineProperty(this, 'height', { get: function get() {
      return height;
    } });
  Object.defineProperty(this, 'font', {
    set: function set(x) {
      if (!this.hasSheet(x)) throw new Error('invalid font: ' + x);
      font = x;
    },
    get: function get() {
      return font || parent.font;
    }
  });
  // methods
  this.origin = function (x, y) {
    if (arguments.length === 0) return { x: _origin.x, y: _origin.y };
    if (arguments.length === 2) _origin = { x: x, y: y };else throw new Error('invalid arguments for origin');
  };
  this.offset = function (x, y) {
    if (arguments.length === 0) return { x: _offset.x, y: _offset.y };
    if (arguments.length === 2) _offset = { x: x, y: y };else throw new Error('invalid arguments for offset');
  };
};

pxcan.prototype.panel = pxcan.Panel.prototype.panel = function (x, y, w, h, xAnchor, yAnchor) {
  if (arguments.length === 4) return new pxcan.Panel(this, x, y, w, h);else if (arguments.length === 6) return new pxcan.Panel(this, x, y, w, h, xAnchor, yAnchor);else throw new Error('invalid number of arguments.');
};
pxcan.prototype.setBackground = function (bg) {
  (this.element !== window ? this.element : document.getElementsByTagName('body')[0]).style.background = bg;
};

pxcan.prototype.toCanvasCoords = pxcan.Panel.prototype.toCanvasCoords = function (x, y, w, h, xAnc, yAnc) {
  // make sure we got the right number of args
  if (arguments.length !== 6) throw new Error('toCanvasCoords requires 6 arguments');
  // define xAnc and yAnc if not defined
  if (xAnc === undefined || xAnc === null) xAnc = this.origin().x;
  if (yAnc === undefined || yAnc === null) yAnc = this.origin().y;
  // translate x and y into LEFT and TOP
  var l = Math.round(this.canvasOffX + x + this.offset().x + this.width * (this.origin().x + 1) / 2 - (w || 0) * (xAnc + 1) / 2);
  var t = Math.round(this.canvasOffY + y + this.offset().y + this.height * (this.origin().y + 1) / 2 - (h || 0) * (yAnc + 1) / 2);
  // how much may need to be cut off the sides for sprites
  var lcut = Math.max(0, this.canvasOffX - l, -l);
  var tcut = Math.max(0, this.canvasOffY - t, -t);
  var rcut = Math.max(0, l + w - (this.canvasOffX + this.width), l + w - (this.screen || this).width);
  var bcut = Math.max(0, t + h - (this.canvasOffY + this.height), t + h - (this.screen || this).height);
  // return null if the object didn't make it on the screen
  if (lcut + rcut >= w || tcut + bcut >= h) return null;
  // otherwise return a nice object
  return {
    x: l + lcut, y: t + tcut, width: w - lcut - rcut, height: h - tcut - bcut,
    lcut: lcut, tcut: tcut, rcut: rcut, bcut: bcut
  };
};

pxcan.prototype.clear = pxcan.Panel.prototype.clear = function (x, y, w, h, xAnc, yAnc) {
  // verify valid arguments
  if ([0, 4, 6].indexOf(arguments.length) === -1) throw new Error('bad arguments for clear');
  // if no arguments are provided, clear the whole area
  if (arguments.length === 0) {
    if (this instanceof pxcan) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.context.clearRect(this.canvasOffX * this.drawScale, this.canvasOffY * this.drawScale, this.width * this.drawScale, this.height * this.drawScale);
    }
    return;
  }
  // translate to coordinates on canvas element
  var coords = this.toCanvasCoords(x, y, w, h, xAnc, yAnc);
  if (!coords) return;
  // clear canvas
  this.context.clearRect(coords.x * this.drawScale, coords.y * this.drawScale, coords.width * this.drawScale, coords.height * this.drawScale);
};

pxcan.prototype.reset = function () {
  this.clear();
  this.origin(0, 0);
  this.offset(0, 0);
};

pxcan.prototype.fill = pxcan.Panel.prototype.fill = function (color, x, y, w, h, xAnc, yAnc) {
  // verify valid arguments
  if ([1, 5, 7].indexOf(arguments.length) === -1) throw new Error('bad arguments for fill');
  // set color
  var temp = this.context.fillStyle;
  this.context.fillStyle = color;
  // if only the color is provided, fill the whole area
  if (arguments.length === 1) {
    if (this instanceof pxcan) {
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.context.fillRect(this.canvasOffX * this.drawScale, this.canvasOffY * this.drawScale, this.width * this.drawScale, this.height * this.drawScale);
    }
    this.context.fillStyle = temp;
    return;
  }
  // translate to coordinates on canvas element
  var coords = this.toCanvasCoords(x, y, w, h, xAnc, yAnc);
  if (!coords) return;
  // do fill on canvas
  this.context.fillRect(coords.x * this.drawScale, coords.y * this.drawScale, coords.width * this.drawScale, coords.height * this.drawScale);
  // set color back
  this.context.fillStyle = temp;
};

pxcan.prototype.blit = pxcan.Panel.prototype.blit = function (sheetName /*, [recolor,] [frame,] [flip], x, y, [xAnc, yAnc] */) {
  var _arguments = arguments;

  // verify valid arguments
  if ([3, 4, 5, 6, 7, 8].indexOf(arguments.length) === -1) throw new Error('bad arguments for blit');
  // get variable arguments
  var recolorColors = null,
      frame = null,
      flipArgs = '',
      x,
      y,
      xAnc = undefined,
      yAnc = undefined;
  (function () {
    var xArgPosition = void 0;
    if (typeof _arguments[_arguments.length - 3] === 'number' && typeof _arguments[_arguments.length - 4] === 'number') {
      x = _arguments[_arguments.length - 4];
      y = _arguments[_arguments.length - 3];
      xAnc = _arguments[_arguments.length - 2];
      yAnc = _arguments[_arguments.length - 1];
      xArgPosition = _arguments.length - 4;
    } else {
      x = _arguments[_arguments.length - 2];
      y = _arguments[_arguments.length - 1];
      xArgPosition = _arguments.length - 2;
    }
    var iArg = 1;
    if (iArg < xArgPosition && Array.isArray(_arguments[iArg])) {
      recolorColors = _arguments[iArg];
      ++iArg;
    }
    if (iArg < xArgPosition && ['number', 'object'].indexOf(_typeof(_arguments[iArg])) !== -1) {
      frame = _arguments[iArg];
      ++iArg;
    }
    if (iArg < xArgPosition && typeof _arguments[iArg] === 'string') {
      flipArgs = _arguments[iArg];
      ++iArg;
    }
  })();

  // get the sheet
  var sheet = this.sheet(sheetName);
  if (!sheet) throw new Error('unknown sheet: ' + sheetName);
  // get the recolored sheet
  var sheetSrc = recolorColors && recolorColors.length > 0 ? pxcan.recolorImage(sheet.src, recolorColors) : sheet.src;
  // if a particular sprite is specified, get it
  var sprite = frame !== null ? sheet.getSprite(frame) : sheet;
  // determine flip+rot
  var xflip = false,
      yflip = false,
      cwrot = false;
  flipArgs.replace('90', 'c').replace('180', 'xy').replace('270', 'cxy').split('').forEach(function (flip) {
    if (flip === 'x' || flip === 'h') xflip = !xflip;else if (flip === 'y' || flip === 'v') yflip = !yflip;else if (flip === 'c') {
      if (cwrot) {
        xflip = !xflip;
        yflip = !yflip;
      }
      cwrot = !cwrot;
      var temp = xflip;
      xflip = yflip;
      yflip = temp;
    }
  });
  // coooordinates
  var coords = this.toCanvasCoords(x, y, cwrot ? sprite.height : sprite.width, cwrot ? sprite.width : sprite.height, xAnc, yAnc);
  if (!coords) return;
  // flip+rotate
  if (xflip || yflip || cwrot) {
    this.context.save();
    this.context.setTransform(+!cwrot && (xflip ? -1 : 1), +cwrot && (yflip ? -1 : 1), +cwrot && (xflip ? 1 : -1), +!cwrot && (yflip ? -1 : 1), this.canvas.width * +xflip, this.canvas.height * +yflip);
  }
  // draw it to the screen
  if (!cwrot) this.context.drawImage(
  // image
  pxcan.scaledImage(sheetSrc, this.drawScale),
  // location on the spritesheet
  (sprite.left + (xflip ? coords.rcut : coords.lcut)) * this.drawScale, (sprite.top + (yflip ? coords.bcut : coords.tcut)) * this.drawScale, coords.width * this.drawScale, coords.height * this.drawScale,
  // location on screen
  this.canvas.width * +xflip + (coords.x * (xflip ? -1 : 1) - coords.width * +xflip) * this.drawScale, this.canvas.height * +yflip + (coords.y * (yflip ? -1 : 1) - coords.height * +yflip) * this.drawScale, coords.width * this.drawScale, coords.height * this.drawScale);else this.context.drawImage(
  // image
  pxcan.scaledImage(sheetSrc, this.drawScale),
  // location on the spritesheet
  (sprite.left + (yflip ? coords.bcut : coords.tcut)) * this.drawScale, (sprite.top + (xflip ? coords.lcut : coords.rcut)) * this.drawScale, coords.height * this.drawScale, coords.width * this.drawScale,
  // location on screen
  this.canvas.height * +yflip + (coords.y * (yflip ? -1 : 1) - coords.height * +yflip) * this.drawScale, -this.canvas.width * +xflip - (coords.x * (xflip ? -1 : 1) + coords.width * +!xflip) * this.drawScale, coords.height * this.drawScale, coords.width * this.drawScale);
  // undo flipping
  if (cwrot || xflip || yflip) this.context.restore();
};

pxcan.prototype.write = pxcan.Panel.prototype.write = function (text /*, [color,] x, y [xAnc, yAnc], [align] */) {
  // arguments
  if ([3, 4, 5, 6].indexOf(arguments.length) === -1) throw new Error('bad arguments for write');
  if (text === undefined || text === null) throw new Error('text is ' + text);
  if (typeof text !== 'string') text = text.toString();
  var color, x, y, anchorX, anchorY, align;
  var xArgPos = typeof arguments[1] === 'number' ? 1 : 2;
  color = typeof arguments[1] === 'number' ? [] : [arguments[1]];
  x = arguments[xArgPos];
  y = arguments[xArgPos + 1];
  if (arguments.length >= xArgPos + 3) {
    anchorX = arguments[xArgPos + 2];
    anchorY = arguments[xArgPos + 3];
  } else {
    anchorX = this.origin().x;
    anchorY = this.origin().y;
  }
  align = [xArgPos + 3, xArgPos + 5].indexOf(arguments.length) !== -1 ? arguments[arguments.length - 1] : 0;

  // font
  var font = this.sheet(this.font);
  // text alignment
  if (typeof align === 'string') {
    if (align === "left") align = 0;else if (align === "center") align = 0.5;else if (align === "right") align = 1;else throw new Error("unknown text alignment: " + align);
  }
  // format text into lines & get max column width
  var lines = text.split('\n');
  var maxcol = 0;
  for (var i = 0; i < lines.length; ++i) {
    maxcol = Math.max(lines[i].length, maxcol);
  } // where the top left char at
  var ltrWidth = font.spriteWidth;
  var ltrHeight = font.spriteHeight;
  var leftx = Math.round(x - (maxcol - 1) * ltrWidth * ((anchorX + 1) / 2));
  var topy = Math.round(y - (lines.length - 1) * ltrHeight * ((anchorY + 1) / 2));
  // iterate
  for (var r = 0; r < lines.length; ++r) {
    var indent = Math.round((maxcol - lines[r].length) * align * ltrWidth);
    for (var c = 0; c < lines[r].length; ++c) {
      this.blit(this.font, color, lines[r].charCodeAt(c) - 32, leftx + indent + c * ltrWidth, topy + r * ltrHeight, anchorX, anchorY);
    }
  }
};

pxcan.prototype.border = pxcan.Panel.prototype.border = function () /* [sheet,] [colors] */{
  var sheet = 'pxborder',
      colors = null;
  if (arguments.length > 0) {
    if (typeof arguments[0] === 'string') sheet = arguments[0];
    if (Array.isArray(arguments[arguments.length - 1])) colors = arguments[arguments.length - 1];
  }
  // temporarily store origin and offset, then set them
  var oldOrigin = this.origin();
  var oldOffset = this.offset();
  this.origin(-1, -1);
  this.offset(0, 0);
  // horizontal edges
  var sw = this.sheet(sheet).spriteWidth;
  for (var x = sw; x < this.width - sw; x += sw) {
    this.blit(sheet, colors, { col: 1, row: 0 }, x, 0, -1, -1);
    this.blit(sheet, colors, { col: 1, row: 2 }, x, this.height, -1, 1);
  }
  // vertical edges
  var sh = this.sheet(sheet).spriteHeight;
  for (var y = sh; y < this.height - sh; y += sh) {
    this.blit(sheet, colors, { col: 0, row: 1 }, 0, y, -1, -1);
    this.blit(sheet, colors, { col: 2, row: 1 }, this.width, y, 1, -1);
  }
  // corners
  this.blit(sheet, colors, { col: 0, row: 0 }, 0, 0, -1, -1);
  this.blit(sheet, colors, { col: 2, row: 0 }, this.width, 0, 1, -1);
  this.blit(sheet, colors, { col: 0, row: 2 }, 0, this.height, -1, 1);
  this.blit(sheet, colors, { col: 2, row: 2 }, this.width, this.height, 1, 1);
  // return origin and offset to old values
  this.origin(oldOrigin.x, oldOrigin.y);
  this.offset(oldOffset.x, oldOffset.y);
};
//preloading module
(function () {
  var instances = [];
  var waitingOn = {};
  var numReqsFrom = {};
  var numGlobalReqs = 0;

  var imgBank = {};

  pxcan.assignId = function () {
    var lastId = -1;
    return function (inst) {
      instances.push(inst);
      numReqsFrom[lastId + 1] = 0;
      return ++lastId;
    };
  }();

  pxcan.isPreloading = function (pxc) {
    return !!numReqsFrom[pxc.id] || numGlobalReqs > 0;
  };

  pxcan.preload = function (src, pxc) {
    var globalCall = !pxc;
    //validate
    if (!src) throw new Error("missing source image");
    //ignore if already preloaded
    if (imgBank[src]) {
      console.log("note: " + src + " was already preloaded.");
      return;
    }
    //ignore if already preloading
    if (waitingOn[src]) {
      if (globalCall) {
        console.log("note: " + src + " was already requested to be preloaded");
        return;
      }
      if (waitingOn[src].indexOf(pxc) >= 0) {
        console.log("note: " + src + " was already requested to be preloaded by this pxcan");
        return;
      }

      // if requested by second canvas, track that
      console.log("note: " + src + " was already requested to be preloaded by a different pxcan");
      waitingOn[src].push(pxc);
      ++numReqsFrom[pxc.id];
      return;
    }

    //keep track of who's loading it
    if (globalCall) {
      ++numGlobalReqs;
    } else {
      waitingOn[src] = [pxc];
      ++numReqsFrom[pxc.id];
    }
    //load
    var img = new Image();
    img.onload = onLoadedFile;
    img.onerror = function () {
      throw new Error("Failed to load image " + src);
    };
    img.src = src;

    function onLoadedFile() {
      //populate imagebank
      imgBank[src] = {
        image: img,
        scaledImages: { 1: document.createElement("canvas") }
      };
      imgBank[src].scaledImages[1].width = img.width;
      imgBank[src].scaledImages[1].height = img.height;
      imgBank[src].scaledImages[1].getContext('2d').drawImage(img, 0, 0);

      //launch onReady for any ready pxcans
      if (globalCall) --numGlobalReqs;else waitingOn[src].forEach(function (p) {
        return --numReqsFrom[p.id];
      });

      if (numGlobalReqs > 0) return;
      if (waitingOn[src] && waitingOn[src].every(function (p) {
        return numReqsFrom[p.id];
      })) return;

      var affectedInstances = globalCall ? instances : waitingOn[src];

      affectedInstances.filter(function (p) {
        return !numReqsFrom[p.id];
      }).forEach(function (p) {
        if (p.onReady) p.onReady.call(p);
        p.onReady = null;
      });
      delete waitingOn[src];
    }
  };
  pxcan.hasImage = function (src) {
    return !!imgBank[src];
  };
  pxcan.image = function (src) {
    if (!pxcan.hasImage(src)) throw new Error("invalid image src: " + src);
    return imgBank[src].image;
  };
  //helper to retrieve and create recolored sheets
  pxcan.recolorImage = function (src, colors) {
    if (!imgBank[src]) throw new Error("invalid image src: " + src);
    //id
    var id = src + '@' + colors.join(',');
    //if cached, return its id
    if (imgBank[id]) return id;

    //otherwise let's make it.
    var c = document.createElement("canvas");
    var img = imgBank[src].scaledImages[1];
    c.width = img.width;
    c.height = img.height;
    var ctx = c.getContext('2d');

    //0x[alpha][blue][green][red]
    var imgRaw = new Uint32Array(img.getContext('2d').getImageData(0, 0, img.width, img.height).data.buffer);
    //indexed color
    var imgColors = [];
    var imgIdx = Array.prototype.map.call(imgRaw, function (x) {
      if ((x & 0xff000000) === 0) return 0;
      var idx = imgColors.indexOf(x);
      if (idx !== -1) return idx + 1;
      imgColors.push(x);
      return imgColors.length;
    });
    //sort indexes
    imgColors = imgColors.map(function (x, i) {
      return { oldIdx: i, brightness: (x & 0xff) + ((x & 0xff00) >> 8) + ((x & 0xff0000) >> 16) };
    }).sort(function (a, b) {
      return a.brightness - b.brightness;
    });
    imgColors.forEach(function (x, i) {
      return x.bIdx = i + 1;
    });
    imgColors.sort(function (a, b) {
      return a.oldIdx - b.oldIdx;
    });

    imgIdx = Array.prototype.map.call(imgIdx, function (x) {
      return x === 0 ? 0 : imgColors[x - 1].bIdx;
    });
    // imgColors = imgColors.map(x=>x.brightness).sort();

    //TODO reduce color map to fewer colors

    //create sprite
    var i = 0;
    for (var y = 0; y < img.height; ++y) {
      for (var x = 0; x < img.width; ++x) {
        if (imgIdx[i] !== 0) {
          ctx.fillStyle = colors[imgIdx[i] - 1];
          ctx.fillRect(x, y, 1, 1);
        }
        ++i;
      }
    }

    //cache and return the id
    imgBank[id] = { scaledImages: { 1: c } };
    return id;
  };
  //helper to retrieve and create resized images
  pxcan.scaledImage = function (src, scale) {
    if (!imgBank[src]) throw new Error("invalid image src: " + src);
    //if cached, return it
    if (imgBank[src].scaledImages[scale]) return imgBank[src].scaledImages[scale];

    //otherwise here's how we make it
    var c = document.createElement("canvas");
    var img = imgBank[src].scaledImages[1];
    c.width = img.width * scale;
    c.height = img.height * scale;
    var ctx = c.getContext('2d');

    var data = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    var i = 0;
    for (var y = 0; y < img.height; ++y) {
      for (var x = 0; x < img.width; ++x) {
        ctx.fillStyle = 'rgba(' + data[i] + ',' + data[i + 1] + ',' + data[i + 2] + ',' + data[i + 3] + ')';
        ctx.fillRect(x * scale, y * scale, scale, scale);
        i += 4;
      }
    }

    //cache and return
    imgBank[src].scaledImages[scale] = c;
    return c;
  };
})();

pxcan.Sheet = function (alias, src, spriteWidth, spriteHeight) {
  // properties
  Object.defineProperty(this, 'alias', { get: function get() {
      return alias;
    } });
  Object.defineProperty(this, 'img', { get: function get() {
      return pxcan.image(src);
    } });
  Object.defineProperty(this, 'src', { get: function get() {
      return src;
    } });
  Object.defineProperty(this, 'left', { get: function get() {
      return 0;
    } });
  Object.defineProperty(this, 'top', { get: function get() {
      return 0;
    } });
  Object.defineProperty(this, 'width', { get: function get() {
      return this.img.width;
    } });
  Object.defineProperty(this, 'height', { get: function get() {
      return this.img.height;
    } });
  Object.defineProperty(this, 'spriteWidth', { get: function get() {
      return spriteWidth || this.img.width;
    } });
  Object.defineProperty(this, 'spriteHeight', { get: function get() {
      return spriteHeight || this.img.height;
    } });
  Object.defineProperty(this, 'numCols', { get: function get() {
      return Math.floor(this.img.width / spriteWidth);
    } });
  Object.defineProperty(this, 'numRows', { get: function get() {
      return Math.floor(this.img.height / spriteHeight);
    } });
  Object.defineProperty(this, 'numSprites', { get: function get() {
      return this.numCols * this.numRows;
    } });
};

pxcan.Sheet.prototype.scaledImage = function (scale) {
  return pxcan.scaledImage(this.src, scale);
};

pxcan.Sheet.prototype.getSprite = function (frame) {
  return new pxcan.Sprite(this, frame);
};

pxcan.Sprite = function (sheet, frame) {
  // validate frame
  if (frame === undefined || frame === null) throw new Error('bad frame while constructing sprite');
  // if frame is given as a number, get the column and row
  if (typeof frame === "number" && frame % 1 === 0) {
    frame = { col: frame % sheet.numCols, row: Math.floor(frame / sheet.numCols) };
  }
  // calculate dimensions
  var fx = frame.x !== undefined ? frame.x : frame.col ? frame.col * sheet.spriteWidth : 0;
  var fy = frame.y !== undefined ? frame.y : frame.row ? frame.row * sheet.spriteHeight : 0;
  var fw = frame.width !== undefined ? frame.width : frame.col !== undefined ? sheet.spriteWidth : sheet.width - fx;
  var fh = frame.height !== undefined ? frame.height : frame.row !== undefined ? sheet.spriteHeight : sheet.height - fy;

  // properties
  Object.defineProperty(this, 'sheet', { get: function get() {
      return sheet;
    } });
  Object.defineProperty(this, 'img', { get: function get() {
      return sheet.img;
    } });
  Object.defineProperty(this, 'left', { get: function get() {
      return fx;
    } });
  Object.defineProperty(this, 'top', { get: function get() {
      return fy;
    } });
  Object.defineProperty(this, 'width', { get: function get() {
      return fw;
    } });
  Object.defineProperty(this, 'height', { get: function get() {
      return fh;
    } });
};

pxcan.Sprite.prototype.scaledImage = function (scale) {
  return pxcan.scaledImage(this.sheet.src, scale);
};
pxcan.globalSheets = {};
pxcan._registerGlobalSheet = function (content, filename) {
  pxcan.preload(content);

  var alias = filename.split('.')[0];
  var dimensions = filename.split('.')[1];
  pxcan.globalSheets[alias] = new pxcan.Sheet(alias, content, +dimensions.split('x')[0], +dimensions.split('x')[1]);
};

// non-standard Math functions useful for games
var pxMath = {
  // Median
  mid: function mid() {
    var arr = [];
    for (var i = 0; i < arguments.length; ++i) {
      arr.push(+arguments[i]);
    }arr.sort(function (a, b) {
      return a - b;
    });
    if (arr.length % 2 === 1) return arr[Math.floor(arr.length / 2)];else return (arr[Math.floor(arr.length / 2)] + arr[Math.floor(arr.length / 2) - 1]) / 2;
  },
  // Clamp
  //  returns val if it's between min and max.
  //  or, returns the min or max value.
  //  can be called with two arguments: then it's between val, -max, and max.
  clamp: function clamp(val, min, max) {
    if (arguments.length === 2) {
      max = arguments[1];
      min = -arguments[1];
    }
    return pxMath.mid(min, val, max);
  }
};
pxcan._registerGlobalSheet("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAABICAMAAACz1EcFAAADAFBMVEUAAAAiIDRFKDxmOTGPVjvfcSbZoGbuw5r78jaZ5VBqvjA3lG5LaS9SSyQyPDk/P3QwYIJbbuFjm/9fzeTL2/z///+brbeEfodpampZVlJ2QoqsMjLZV2PXe7qPl0qKbzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADQfngCAAABAHRSTlMA////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////Cpf0PAAAAZ1JREFUSImllgF2wzAIQ7kE97/q+mIDX9hu6rfsLbMbLCQQ6czuLvfP7+dn3t3Hn7F6nvZAf67nyDjncxGBemTgmGAtHArcZnJ5Xosk9mz8jPlVsafeQ0iwh7htsAYWvZClClzLsIGto71crcC3uiEGsqKE0ihnhXnLrPNI9ikghy+8ihDdlBoBKr0GWMGxpLPY7E71S0ijQj4MSURfILBqMk+IW45nl/1+saVz61pbk6GMDrMSSttwWkqW1YhA9cweMUmxucKxZPwuOl8IDmwz2bKRwrcCvZyQ8bFVtzgso4hNugZGGtkas962eu11G9xMzZuwlfytMwxUPZEaZjkGmsIasP1StDgs3z3BhuOCbpJebiSSLZaGamoXHNPoxlF8lNvKeevwZcUNXDDRYQq1L/h3U8gcxeFzIClQ2Dn1y/t4r5pfHweItVHBckcHiKlhGUX0q+neDJfpXPfAO9VfStE+q7FPA7y9AMqtSZOBQMy8qkfmOuuCL78ayn/KrtSiWOoKT+ct28V/ydrw4aHDyjBzIRpgA8cBu3L8A/JAROlh3CQ9AAAAAElFTkSuQmCC", "px6.5x6");
pxcan._registerGlobalSheet("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABgCAYAAACtxXToAAAFZUlEQVR4nO1c7Y7jMAh0V33/V8792fQIHWAGO2lO15GqftgGm9gwkOw+tm0b/zN+hL7b76tqi/pt7j2SU+ll5pC1H/ooBpiBX3xloGyRj+T3RzIW4ql0LvAIPu/fN/dusZl+mVx1HmW7ugMi4dby8lUwcrtX3777z0jP3x8ucoJISWTMaDfYHWTbN/c5k/0GdgdUDqbCI3j38qvFZ/ND4+qJkTugrUBAtchq7I7Iz0AgA2RXAf3+r+FgHH8EGG+sxnHbdjvWhXxAdoUrxxV9vwvejsaPa1QEWVjv7JUgJncbA60kQl0wvgUZvKPnbZw1gEJgshjtvXA7Rif6lgH5gI6TQ9SXxezimCMVhkVvgMzTM1ewassSmY/gKip8W+w+gHEy2Q6oxivyfTt77FrjnwMvDIWyCFHYQ8kKard96CwOzCHql14Mlgd0zz3TzviAzb18G6MH9kVhcMYhscekOiIojNq2rKjC6H/BE6FOMcMryIome79ogau4QnYhy4rQDMuiLS/KPg17GJzx4ozjYqlslYpH49tR7MsDft9XWPjOCOfP8AAmzvvxSLkSptj+zBhURH3N/w7p8I4u04yiC+r7hq4TLAWLWFVvlHkIS4VZWqxOysqPriDSqeYq4Vj1CETGyhSz5Moawctjq0UyZX8CxahzxznZseyYM6tFXx6A0KkH+HbGQWZ9Og44G4/khPp3JxgVOdF3JtwgnuD7RBOOjkw37U71P4OOXsCKkKf4gTPqhKETXKV8xlGq8pEONgwe+nkDbOZdjf1sPt7FbOXJ9nutx1eEGOEzBRM2HzhrB0EfEBEVZRJehicxdmdF8tmkSp0f0v8a++UBg8sFxuCdkG9H6Wj23YNJ17P2bG7SU2IVN2e4+0zWh44Ras907q9X36selLToOjgmRMvnmSFCq3CWd9+BkroSdgfYLaJAUThr5FVc4IUrj0CVvFjMGEoyAlsQ8ROy2znjAB5Z5eesI5jWO748YPTy+dl6AEOto/QY8Yh2e5QLqERjZjxLiE7BJ3jAGBcvMkPEA1bWA5ii6wwQQaLls+mwRVWyqnxCVv+fRebRoU7mCFS1QNTfTuTWYYblAd4I9jdmrJLLo+1cjbd9ojbY50oeUIXC1YUQCqge0ImzCNFE1QWwFLrlV35GvjgGD/fqICrLsahqBSF2J8icoZH08RO5Ms6zOxIielg6U8RORMXMLvCskkb0N0ORgkjJR2hsoFOaw24AxN1ZrFz8rC+Q4bPBLF+vwIYr1WCzBkl39bce8Ps+k6isPv8deW2y1C2JrSicrlqgemPkkD0+3Y8RZrK5VWk2S51RX/vbYZ3Kn82xPMBPIPuNla3ol3SjByQqwQxXUHeIUiOMkOUeofHYktgKB7cy3Kiywlyl6wSRguzKoWSlclL++4pI9Tb+ywMGH3e7mSAj/6yCaQnlWeGuE2JlR1sxjOGmHR2bSMahveMDmNIVc7U7laFt5EZA31Mewd4XULK0OxVLSjC3xlbiVosfY82tMWVn+HCmYrkBlX+kZD/7RajHIxs/a6RM51se89/zgE/dHUZYfeUp/Bildot4+Da/ZZXx6kLRcUH6W+2+KIrOqA1fUTjMMkY/HiUl2YRPBfvX44z3tbV5VEbPrn5Vdq/QricwRGhFqXqmosTI9kezVRNUS0wsOos9i4i9YeZvh9lJoh1U5QrqDmTqEbDPlwd8QGcVKtVxU9h5QEZFmTjLxvmZjHDm3qXnKi85d3lAYhbVRbPn/zBHdGNkphaQGbAyruJQfcEjK36gecgVoSoMMorR5FUZqI9Kog597vZ8wOWwydAYeb5uz1l0BSsn2DWyHdOlyjBP+QNcO0/NfGhMCAAAAABJRU5ErkJggg==", "px8.8x8");
pxcan._registerGlobalSheet("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAhElEQVRIie2WwQrAIAxDU/H/fzk7CdHVwdYWdjCXipQX04NqJIlCdVkbAG5q2EAh3NSQgUJCJxaeAaAm+DqONaEpp22a3mgCrrwmTVG5jIwEj8pM4HKa15WpY3AM/m3AagOrNrglyLouJp4aZF1400u4vmhZJmMa7IiPxvsojH1Y9bflAvhRIjH91XRBAAAAAElFTkSuQmCC", "pxborder.8x8");
// custom random number generator
//  it can just be called as a function, or it can be seeded
pxcan.random = function () {
  // Hashcode of strings.
  //  http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
  function hashString(str) {
    var hash = 0,
        i,
        chr,
        len;
    if (str.length == 0) return hash;
    for (i = 0, len = str.length; i < len; i++) {
      chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
  function getSeed(s) {
    if (typeof s === 'number') return s;else if (typeof s === 'string') return hashString(s);else throw new Error('not sure what to do with seed: ' + s);
  }
  function SinRand(s) {
    var seed = getSeed(s);
    var obj = function obj() {
      var x = Math.sin(seed++) * 10000;
      x -= Math.floor(x);
      if (arguments.length === 0) return x;
      if (arguments.length === 1 && arguments[0] instanceof Array) return arguments[0][Math.floor(x * arguments[0].length)];
      if (arguments.length === 1) return Math.floor(x * arguments[0]);
      if (arguments.length === 2) return Math.floor(x * (arguments[1] + 1 - arguments[0])) + arguments[0];else throw new Error('invalid arguments for random generator.');
    };
    obj.seed = function (s) {
      seed = getSeed(s);
    };
    obj.create = function (s) {
      return SinRand(s !== undefined ? s : obj());
    };
    return obj;
  };
  return SinRand(Math.random());
}();
// word wrap function by james padolsey
// modified from original
// http://james.padolsey.com/javascript/wordwrap-for-javascript/
pxcan.wrapString = function (str, width, maxLines) {
  if (!str) return str;
  var regex = '.{1,' + width + '}(\\s|$)|.{' + width + '}|.+$';
  var lines = str.match(RegExp(regex, 'g'));
  if (maxLines) lines = lines.slice(0, maxLines);
  for (var i = 0; i < lines.length; ++i) {
    lines[i] = lines[i].trim();
  }return lines.join('\n');
};