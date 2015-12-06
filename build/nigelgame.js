function nigelgame(element) {
  var resourceReqs = 0;
  var resourceCallback = null;
  
  // setup screen
  var screen = new nigelgame.Screen(element);
  this.setScreenMode = function() { screen.mode.apply(screen, arguments); };
  this.setScreenSize = function() { screen.setSize.apply(screen, arguments); };
  this.setScreenScale = function() { screen.setScale.apply(screen, arguments); };
  
  this.addJSON = function(src, alias) {
    if(!src) throw "missing json source filename";
    if(!alias) throw "missing alias";
    if(nigelgame.json[alias]) {
      var oldobj = nigelgame.json[alias];
      if(oldobj.src === src) return;
      else throw "Duplicate alias for " + oldobj.alias + "(" + oldobj.src + ", " + src + ")";
    }
    ++resourceReqs;
    var xht = new XMLHttpRequest();
    xht.open('GET', src);
    xht.overrideMimeType('application/json');
    xht.onloadend = onLoadedFile;
    xht.onerror = function() { throw "Error loading JSON file: " + src; };
    xht.ontimeout = function() { throw "Request timed out: " + src; };
    xht.send();
    
    function onLoadedFile() {
      nigelgame.json[alias] = JSON.parse(xht.response);
      --resourceReqs;
      if(resourceReqs === 0 && resourceCallback) {
        resourceCallback();
        resourceCallback = null;
      }
    }
  };
  
  var binds = null;
  this.bind = function(name /*, key1, key2, ... */ ) {
    if(!binds) binds = {};
    for(var i = 1; i < arguments.length; ++i) {
      binds[arguments[i]] = name;
    }
  };
  
  var useTouch = false;
  this.activateTouch = function() { useTouch = true; };
  
  var useKeyboard = false;
  this.activateKeyboard = function() { useKeyboard = true; };
  
  var frameskip = 0;
  this.setFrameSkip = function(x) { frameskip = x; };
  
  var started = false;
  this.start = function(view) {
    if(started) throw new Error('game is already started!');
    started = true;
    if(resourceReqs > 0) {
      resourceCallback = function() { reallyStart(view); };
    }
    else {
      reallyStart(view);
    }
  };
  
  function reallyStart(view) {
    //initialize some things
    var buttons = {};
    var mouseState = {
      startPoint: null,
      lastPoint: null,
      button: null
    };
    var touchState = {
      id: null,
      startPoint: null,
      lastPoint: null
    };
    var doingFrame = false;
    var totalClock = 0;
    var viewClock = 0;
    var skippedFrames = 0;
    
    // key listeners
    if(binds) {
      element.addEventListener("keydown", gotKeyDown, false);
      element.addEventListener("keyup", gotKeyUp, false);
    }
    if(useKeyboard) {
      element.addEventListener("keypress", gotKeyPress, false);
    }
    // mouse/touch listeners
    if(useTouch) {
      element.addEventListener("mousedown", gotMouseDown, false);
      element.addEventListener("mouseup", gotMouseUp, false);
      element.addEventListener("mousemove", gotMouseMove, false);
      element.addEventListener("touchstart", gotTouchStart, false);
      element.addEventListener("touchmove", gotTouchMove, false);
      element.addEventListener("touchend", gotTouchEnd, false);
      // disable context menu on right click
      element.addEventListener("contextmenu", function(evt) { evt.preventDefault(); return false; }, false);
    }
    // begin doing frame actions
    window.requestAnimationFrame(reqAnim);
    
    function reqAnim() {
      // don't accidentally call this method twice at once
      if(doingFrame) return;
      doingFrame = true;
      if(frameskip) {
        ++skippedFrames;
        if(skippedFrames > frameskip) {
          skippedFrames = 0;
          doFrame();
        }
      }
      else {
        doFrame();
      }
      // done. unlock method
      doingFrame = false;
      window.requestAnimationFrame(reqAnim);
    }
    
    function doFrame() {
      if(view.nextView) {
        var next = view.nextView;
        view.nextView = null;
        view = next;
        viewClock = 0;
      }
      screen.fitElement();
      if(view.update) view.update({
        viewClock: viewClock,
        gameClock: totalClock,
        screen: screen,
        buttons: buttons
      });
      ++viewClock;
      ++totalClock;
      for(var key in buttons) {
        if(buttons.hasOwnProperty(key)) {
          ++buttons[key].length;
        }
      }
    }
    
    // game button event handlers
    function gotKeyDown(evt) {
      if(!useKeyboard) evt.preventDefault();
      var key = binds[evt.keyCode];
      if(key === undefined) return true;
      
      if(!buttons[key]) {
        buttons[key] = { length: 0 };
        if(view.buttondown) return view.buttondown(key);
      }
    }
    function gotKeyUp(evt) {
      var key = binds[evt.keyCode];
      if(key === undefined) return true;
      
      if(buttons[key]) {
        buttons[key] = false;
        if(view.buttonup) return view.buttonup(key);
      }
    }
    
    //manual keyboard event handlers
    function gotKeyPress(evt) {
      if(view.keypress)
        if(view.keypress(evt))
          evt.preventDefault();
    }
    
    // utility mouse functions
    function touchPointFromEvt(evt) {
      return new TouchPoint(
        Math.floor((evt.clientX - (element.clientLeft || 0) - (element.offsetLeft || 0))/(element.clientWidth || element.innerWidth)*screen.width),
        Math.floor((evt.clientY - (element.clientTop || 0) - (element.offsetTop || 0))/(element.clientHeight || element.innerHeight)*screen.height),
        null
      );
    }
    function TouchPoint(x,y,rel) {
      this.x = x + (rel && rel.left || 0);
      this.y = y + (rel && rel.top || 0);
      this.equals = function(pt) {
        return this.x === pt.x && this.y === pt.y;
      };
      this.inBounds = function() {
        if(!rel) return
          this.x >= 0 && this.y >= 0
          && this.x < screen.width && this.y < screen.height;
        return
          this.x > screen.left && this.x <= screen.right
          && this.y > screen.top && this.y <= screen.bottom;
      };
      this.relativeTo = function(pan) {
        return new TouchPoint(
          this.x - (rel && rel.left || 0),
          this.y - (rel && rel.top || 0),
          pan
        );
      };
    }
    function mouseWhich(evt) {
      return (evt.button === 2)? "rightmouse": "mouse";
    }
    
    // mouse event handlers
    function gotMouseDown(mouseEvt) {
      var evt = {
        screen: screen,
        type: mouseWhich(mouseEvt),
        point: touchPointFromEvt(mouseEvt)
      };
      if(view.touch) view.touch(evt);
      mouseState.startPoint = evt.point;
      mouseState.lastPoint = evt.point;
      mouseState.button = evt.type;
    }
    function gotMouseMove(mouseEvt) {
      if(!mouseState.startPoint) return;
      var evt = {
        screen: screen,
        type: mouseState.button,
        point: touchPointFromEvt(mouseEvt),
        lastPoint: mouseState.lastPoint,
        startPoint: mouseState.startPoint,
      };
      if(evt.point.equals(evt.lastPoint)) return;
      if(view.drag) view.drag(evt);
      mouseState.lastPoint = evt.point;
    }
    function gotMouseUp(mouseEvt) {
      if(view.release && mouseState.startPoint && mouseState.button === mouseWhich(mouseEvt)) {
        view.release({
          screen: screen,
          type: mouseState.button,
          point: touchPointFromEvt(mouseEvt),
          startPoint: mouseState.startPoint,
        });
      }
      mouseState.startPoint = null;
      mouseState.lastPoint = null;
    }
    
    //touch events handlers
    function gotTouchStart(touchEvt) {
      touchEvt.preventDefault();
      // if this isn't the first touch, ignore it
      if(touchEvt.touches.length !== touchEvt.changedTouches.length) return;
      // issue event
      var evt = {
        screen: screen,
        type: 'touch',
        point: touchPointFromEvt(touchEvt.changedTouches[0])
      };
      if(view.touch) view.touch(evt);
      touchState.startPoint = evt.point;
      touchState.lastPoint = evt.point;
      touchState.id = touchEvt.changedTouches[0].identifier;
    }
    function gotTouchMove(touchEvt) {
      touchEvt.preventDefault();
      if(!touchState.startPoint) return;
      // look at all moved touches
      var i = 0;
      for(i = 0 ;; ++i) {
        if(i === touchEvt.changedTouches.length) return;
        if(touchEvt.changedTouches[i].identifier === touchState.id) break;
      }
      // if we got to this point, do this touch
      var evt = {
        screen: screen,
        type: 'touch',
        point: touchPointFromEvt(touchEvt.changedTouches[i]),
        lastPoint: touchState.lastPoint,
        startPoint: touchState.startPoint
      };
      if(evt.point.equals(evt.lastPoint)) return;
      if(view.drag) view.drag(evt);
      mouseState.lastPoint = evt.point;
    }
    function gotTouchEnd(touchEvt) {
      touchEvt.preventDefault();
      if(!touchState.startPoint) return;
      // look at all released touches
      var i = 0;
      for(i = 0 ;; ++i) {
        if(i === touchEvt.changedTouches.length) return;
        if(touchEvt.changedTouches[i].identifier === touchState.id) break;
      }
      // if this is the only touch, send release evt
      if(touchEvt.targetTouches.length===0) {
        if(view.release) view.release({
          screen: screen,
          type: 'touch',
          point: touchPointFromEvt(touchEvt.changedTouches[i]),
          startPoint: touchState.startPoint
        });
        touchState.id = null;
        touchState.startPoint = null;
        touchState.lastPoint = null;
      }
      // otherwise there are still other touches;
      // treat as 'drag' event to latest touch
      else {
        var nextTouch = touchEvt.targetTouches[touchEvt.targetTouches.length-1];
        var point = touchPointFromEvt(nextTouch);
        if(view.drag) view.drag({
          screen: screen,
          type: 'touch',
          point: point,
          lastPoint: touchState.lastPoint,
          startPoint: touchState.startPoint
        });
        touchState.id = nextTouch.identifier;
        touchState.lastPoint = point;
      }
    }
  }
}

nigelgame.sheets = {};
nigelgame.json = {};

// requestAnimationFrame
window.requestAnimationFrame =
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.oRequestAnimationFrame;

// Math.sign polyfill
Math.sign = function sign(x) {
  return !(x= parseFloat(x)) ? x : x > 0 ? 1 : -1;
};

// Math extensions
//  Median
Math.mid = function() {
  var arr = [];
  for(var i = 0; i < arguments.length; ++i) arr.push(+arguments[i]);
  arr.sort(function(a, b) { return a-b; });
  if(arr.length%2 === 1) return arr[Math.floor(arr.length/2)];
  else return (arr[Math.floor(arr.length/2)] + arr[Math.floor(arr.length/2)-1]) / 2;
};
//  Cap!
//  returns val if it's between -max and max.
//  otherwise, returns the cap of them.
Math.cap = function(val, max) {
  return Math.mid(-max, val, max);
};

// Hashcode of strings.
// http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
String.prototype.hashCode = function() {
  var hash = 0, i, chr, len;
  if (this.length == 0) return hash;
  for (i = 0, len = this.length; i < len; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

// random objects
// it can just be called as a function, or it can be seeded
nigelgame.random = (function() {
  function getSeed(s) {
    if(typeof(s) === 'number') return s;
    else if(typeof(s) === 'string') return s.hashCode();
    else throw new Error('not sure what to do with seed: ' + s);
  }
  function SinRand(s) {
    var seed = getSeed(s);
    var obj = function() {
      var x = Math.sin(seed++) * 10000;
      x -= Math.floor(x);
      if(arguments.length === 0) return x;
      if(arguments.length === 1 && (arguments[0] instanceof Array)) return arguments[0][Math.floor(x*arguments[0].length)];
      if(arguments.length === 1) return Math.floor(x*arguments[0]);
      if(arguments.length === 2) return Math.floor(x*(arguments[1]+1-arguments[0]))+arguments[0];
      else throw new Error('invalid arguments for random generator.');
    };
    obj.seed = function(s) { seed = getSeed(s); };
    obj.create = function(s) {
      return SinRand((s !== undefined)? s: obj());
    };
    return obj;
  };
  return SinRand(Math.random());
})();

// word wrap function by james padolsey
// modified from original
// http://james.padolsey.com/javascript/wordwrap-for-javascript/
nigelgame.wrapString = function(str, width, maxLines) {
  if (!str) return str;
  var regex = '.{1,' +width+ '}(\\s|$)|.{' +width+ '}|.+$';
  var lines = str.match(RegExp(regex, 'g'));
  if(maxLines) lines = lines.slice(0, maxLines);
  for(var i = 0; i < lines.length; ++i) lines[i] = lines[i].trim();
  return lines.join('\n');
};

var pxcan = function(element) {
  // vars
  element = element || window;
  if(typeof(element) === 'string') element = document.querySelector(element);
  var mode = { name: 'adapt' };
  var width = element.clientWidth || element.innerWidth;
  var height = element.clientHeight || element.innerWidth;
  var scale = 1;
  var needsRepaint = true;
  var prevDims = null;
  var font = "pxcan-ascii";
  var sheets = {};
  var _origin = { x: 0, y: 0 };
  var _offset = { x: 0, y: 0 };
  
  // create canvas element
  var canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.margin = 'auto';
  // drawing context
  var context = canvas.getContext('2d');
  // if we're adding it to the WINDOW then make sure it is fullscreeny
  if(element == window) {
    var body = document.querySelector('body');
    body.style.padding = 0;
    body.style.margin = 0;
    body.style.overflow = 'hidden';
  }
  // put canvas on page
  ((element !== window)? element: document.getElementsByTagName('body')[0]).appendChild(canvas);
  // make it selectable (if it's not just in the window)
  if(element !== window && element.tabIndex < 0) element.tabIndex = 0;
  
  // public properties
  Object.defineProperty(this, 'element', { get: function() { return element; } });
  Object.defineProperty(this, 'canvas', { get: function() { return canvas; } });
  Object.defineProperty(this, 'context', { get: function() { return context; } });
  Object.defineProperty(this, 'canvasOffX', { get: function() { return 0; } });
  Object.defineProperty(this, 'canvasOffY', { get: function() { return 0; } });
  Object.defineProperty(this, 'left', { get: function() {
    return Math.round(_offset.x - (width * (_origin.x + 1) / 2));
  } });
  Object.defineProperty(this, 'top', { get: function() {
    return Math.round(_offset.y - (height * (_origin.y + 1) / 2));
  } });
  Object.defineProperty(this, 'right', { get: function() { return this.left + width; } });
  Object.defineProperty(this, 'bottom', { get: function() { return this.top + height; } });
  Object.defineProperty(this, 'width', { get: function() { return width; } });
  Object.defineProperty(this, 'height', { get: function() { return height; } });
  Object.defineProperty(this, 'drawScale', { get: function() { return scale; } });
  Object.defineProperty(this, 'wasResized', { get: function() { return needsRepaint; } });
  Object.defineProperty(this, 'font', {
    set: function(x) {
      if(!this.hasSheet(x)) throw new Error('invalid font: ' + x);
      font = x;
    },
    get: function() {
      if(!font) throw new Error('font has not been set.');
      return font;
    }
  });
  Object.defineProperty(this, 'onReady', { writable: true });
  Object.defineProperty(this, 'onFrame', { writable: true });
  
  this.preload = function(src, alias, w, h) {
    if(!alias && alias !== 0) throw new Error("missing alias");
    if(sheets[alias]) throw new Error("sheet already exists with alias " + alias);
    if(pxcan.globalSheets[alias]) throw new Error("global sheet already exists with alias " + alias);
    if(!pxcan.hasImage(src)) {
      pxcan.preload(src, this);
    }
    sheets[alias] = new pxcan.Sheet(alias, src, w, h);
  };
  
  this.sheet = function(src) {
    if(sheets[src]) return sheets[src];
    if(pxcan.globalSheets[src]) return pxcan.globalSheets[src];
    throw new Error("invalid sheet: " + src);
  };
  
  this.hasSheet = function(src) {
    return !!(sheets[src] || pxcan.globalSheets[src]);
  };
  
  this.origin = function(x, y) {
    if(arguments.length === 0) return { x: _origin.x, y: _origin.y };
    if(arguments.length === 2) _origin = { x: x, y: y };
    else throw new Error('invalid arguments for origin');
  };
  this.offset = function(x, y) {
    if(arguments.length === 0) return { x: _offset.x, y: _offset.y };
    if(arguments.length === 2) _offset = { x: x, y: y };
    else throw new Error('invalid arguments for offset');
  };
  
  this.mode = function(newMode) {
    // if no arguments are given, treat as getter function
    if(arguments.length === 0) return mode.name;
    // otherwise set appropriately
    if(newMode === 'adapt') {
      mode = { name: 'adapt' };
      scale = arguments[1] || 1;
      canvas.style.width = '';
      canvas.style.height = '';
    }
    else if(newMode === 'fixed') {
      mode = { name: 'fixed' };
      if(arguments.length <= 2) {
        scale = arguments[1] || 1;
        width = Math.floor((element.clientWidth || element.innerWidth) / scale);
        height = Math.floor((element.clientHeight || element.innerHeight) / scale);
      }
      else {
        width = arguments[1];
        height = arguments[2];
        scale = arguments[3] || 1;
      }
      canvas.style.width = '';
      canvas.style.height = '';
    }
    else if(newMode === 'scale-overflow') {
      mode = {
        name: 'scale-overflow',
        minWidth: arguments[1] || element.clientWidth || element.innerWidth,
        minHeight: arguments[2] || element.clientHeight || element.innerHeight
      };
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
    else if(newMode === 'scale') {
      throw new Error('not yet supported.');
    }
    else {
      throw new Error('unknown mode type.');
    }
    // reset these
    needsRepaint = true;
    prevDims = null;
    this.fitElement();
  };
  
  this.setSize = function(w, h) {
    if(mode.name === 'fixed' || mode.name === 'scale') {
      width = w;
      height = h;
    }
    else if(mode.name === 'scale-overflow') {
      mode.minWidth = w;
      mode.minHeight = h;
    }
    else {
      throw new Error('screen mode does not support setSize: ' + mode.name);
    }
    this.fitElement();
  };
  
  this.setScale = function(s) {
    if(mode.name === 'adapt' || mode.name === 'fixed') {
      scale = s;
    }
    else {
      throw new Error('screen mode does not support setScale: ' + mode.name);
    }
    this.fitElement();
  };
  
  // screen fitting
  this.fitElement = function() {
    // get the current width/height of the elemnt
    var w = element.clientWidth || element.innerWidth;
    var h = element.clientHeight || element.innerHeight;
    // has it actually changed? if not, no need to fit it.
    needsRepaint = !prevDims || (prevDims.w !== w) || (prevDims.h !== h);
    if(!needsRepaint) return;
    // otherwise, do the correct resize function for the mode
    if(mode.name === 'adapt') fitAdapt(w, h);
    else if(mode.name === 'fixed') fitFixed(w, h);
    else if(mode.name === 'scale-overflow') fitScaleOverflow(w, h);
    // if the view is the whole window, then keep it at the right location
    if(element === window) {
      window.scrollTo(0, 0);
    }
    // record previous dimensions
    prevDims = { w: w, h: h };
  };
  
  function fitAdapt(w, h) {
    // resize canvas to fill window
    canvas.width = (width = Math.floor(w/scale)) * scale;
    canvas.height = (height = Math.floor(h/scale)) * scale;
  }
  
  function fitFixed(w, h) {
    // just resize to the expected dimensions if it's not already that
    if(canvas.width !== width * scale) canvas.width = width * scale;
    if(canvas.height !== height * scale) canvas.height = height * scale;
  }
  
  function fitScaleOverflow(w, h) {
    // if the desired aspect ratio is equal
    if(mode.minWidth * h === mode.minHeight * w) {
      width = mode.minWidth;
      height = mode.minHeight;
    }
    // if it needs to be WIDER
    else if(mode.minWidth * h < mode.minHeight * w) {
      width = Math.floor(w / h * mode.minHeight);
      height = mode.minHeight;
    }
    // if it needs to be TALLER
    else {
      width = mode.minWidth;
      height = Math.floor(h / w * mode.minWidth);
    }
    // draw at a lower scale...
    scale = Math.floor(Math.min(h/height, w/width));
    if(scale < 1) scale = 1; //unless it's smaller than minimum
    canvas.width = width * scale;
    canvas.height = height * scale;
  }
  
  this.fitElement();
};

pxcan.Panel = function(parent, x, y, w, h, xAnchor, yAnchor) {
  // verify arguments
  if([5,7].indexOf(arguments.length)===-1)
    throw new Error('invalid number of arguments.');
  // vars
  if(arguments.length === 5) {
    xAnchor = parent.origin().x;
    yAnchor = parent.origin().y;
  }
  var font = null;
  var _origin = parent.origin();
  var _offset = parent.offset();
  var screen = parent.screen || parent;
  
  // subcanvas size
  this.canvasOffX = Math.round(parent.canvasOffX + x + parent.width*(parent.origin().x+1)/2 - w*(xAnchor+1)/2);
  this.canvasOffY = Math.round(parent.canvasOffY + y + parent.height*(parent.origin().y+1)/2 - h*(yAnchor+1)/2);
  var width = Math.round(w);
  var height = Math.round(h);
  
  // public properties
  Object.defineProperty(this, 'screen', { get: function() { return screen; } });
  Object.defineProperty(this, 'element', { get: function() { return screen.element; } });
  Object.defineProperty(this, 'canvas', { get: function() { return screen.canvas; } });
  Object.defineProperty(this, 'context', { get: function() { return screen.context; } });
  Object.defineProperty(this, 'left', { get: function() {
    return Math.round(_offset.x - (width * (_origin.x + 1) / 2));
  } });
  Object.defineProperty(this, 'top', { get: function() {
    return Math.round(_offset.y - (height * (_origin.y + 1) / 2));
  } });
  Object.defineProperty(this, 'right', { get: function() { return this.left + width; } });
  Object.defineProperty(this, 'bottom', { get: function() { return this.top + height; } });
  Object.defineProperty(this, 'width', { get: function() { return width; } });
  Object.defineProperty(this, 'height', { get: function() { return height; } });
  Object.defineProperty(this, 'drawScale', { get: function() { return screen.drawScale; } });
  Object.defineProperty(this, 'sheet', { get: function() { return screen.sheet; } });
  Object.defineProperty(this, 'font', {
    set: function(x) {
      if(!this.hasSheet(x)) throw new Error('invalid font: ' + x);
      font = x;
    },
    get: function() { return font || parent.font; }
  });
  // methods
  this.origin = function(x, y) {
    if(arguments.length === 0) return { x: _origin.x, y: _origin.y };
    if(arguments.length === 2) _origin = { x: x, y: y };
    else throw new Error('invalid arguments for origin');
  };
  this.offset = function(x, y) {
    if(arguments.length === 0) return { x: _offset.x, y: _offset.y };
    if(arguments.length === 2) _offset = { x: x, y: y };
    else throw new Error('invalid arguments for offset');
  };
  
};

pxcan.prototype.panel =
pxcan.Panel.prototype.panel = function(x, y, w, h, xAnchor, yAnchor) {
  if(arguments.length === 4)
    return new pxcan.Panel(this, x, y, w, h);
  else if(arguments.length === 6)
    return new pxcan.Panel(this, x, y, w, h, xAnchor, yAnchor);
  else
    throw new Error('invalid number of arguments.');
};

pxcan.prototype.setBackground = function(bg) {
  this.element.style.background = bg;
};

pxcan.prototype.toCanvasCoords =
pxcan.Panel.prototype.toCanvasCoords = function(x, y, w, h, xAnc, yAnc) {
  // make sure we got the right number of args
  if(arguments.length !== 6)
    throw new Error('toCanvasCoords requires 6 arguments');
  // define xAnc and yAnc if not defined
  if(xAnc === undefined || xAnc === null) xAnc = this.origin().x;
  if(yAnc === undefined || yAnc === null) yAnc = this.origin().y;
  // translate x and y into LEFT and TOP
  var l = Math.round(this.canvasOffX + x + this.offset().x + this.width * (this.origin().x+1)/2 - (w || 0) * (xAnc+1)/2);
  var t = Math.round(this.canvasOffY + y + this.offset().y + this.height * (this.origin().y+1)/2 - (h || 0) * (yAnc+1)/2);
  // how much may need to be cut off the sides for sprites
  var lcut = Math.max(0, this.canvasOffX-l, -l);
  var tcut = Math.max(0, this.canvasOffY-t, -t);
  var rcut = Math.max(0, (l+w)-(this.canvasOffX+this.width), (l+w)-((this.screen||this).width));
  var bcut = Math.max(0, (t+h)-(this.canvasOffY+this.height), (t+h)-((this.screen||this).height));
  // return null if the object didn't make it on the screen
  if(lcut+rcut >= w || tcut+bcut >= h) return null;
  // otherwise return a nice object
  return {
    x: l+lcut, y: t+tcut, width: w-lcut-rcut, height: h-tcut-bcut,
    lcut: lcut, tcut: tcut, rcut: rcut, bcut: bcut
  };
};

pxcan.prototype.clear = 
pxcan.Panel.prototype.clear = function(x, y, w, h, xAnc, yAnc) {
  // verify valid arguments
  if([0, 4, 6].indexOf(arguments.length) === -1)
    throw new Error('bad arguments for clear');
  // if no arguments are provided, clear the whole area
  if(arguments.length === 0) {
    if(this instanceof pxcan) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    else {
      this.context.clearRect(
        this.canvasOffX * this.drawScale,
        this.canvasOffY * this.drawScale,
        this.width * this.drawScale,
        this.height * this.drawScale
      );
    }
    return;
  }
  // translate to coordinates on canvas element
  var coords = this.toCanvasCoords(x, y, w, h, xAnc, yAnc);
  if(!coords) return;
  // clear canvas
  this.context.clearRect(coords.x * this.drawScale, coords.y * this.drawScale, coords.width * this.drawScale, coords.height * this.drawScale);
};

pxcan.prototype.reset = function() {
  this.clear();
  this.origin(0, 0);
  this.offset(0, 0);
};

pxcan.prototype.fill =
pxcan.Panel.prototype.fill = function(color, x, y, w, h, xAnc, yAnc) {
  // verify valid arguments
  if([1, 5, 7].indexOf(arguments.length) === -1)
    throw new Error('bad arguments for fill');
  // set color
  var temp = this.context.fillStyle;
  this.context.fillStyle = color;
  // if only the color is provided, fill the whole area
  if(arguments.length === 1) {
    if(this instanceof pxcan) {
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    else {
      this.context.fillRect(
        this.canvasOffX * this.drawScale,
        this.canvasOffY * this.drawScale,
        this.width * this.drawScale,
        this.height * this.drawScale
      );
    }
    this.context.fillStyle = temp;
    return;
  }
  // translate to coordinates on canvas element
  var coords = this.toCanvasCoords(x, y, w, h, xAnc, yAnc);
  if(!coords) return;
  // do fill on canvas
  this.context.fillRect(coords.x * this.drawScale, coords.y * this.drawScale, coords.width * this.drawScale, coords.height * this.drawScale);
  // set color back
  this.context.fillStyle = temp;
};

pxcan.prototype.blit =
pxcan.Panel.prototype.blit = function(sheetName, frame /* [flip], x, y, [xAnc, yAnc] */) {
  // verify valid arguments
  if([4,5,6,7].indexOf(arguments.length) === -1)
    throw new Error('bad arguments for blit');
  // get variable arguments
  var flip = (arguments.length%2 === 1) && arguments[2] || '';
  var x = arguments[arguments.length%2===0? 2: 3];
  var y = arguments[arguments.length%2===0? 3: 4];
  var xAnc = arguments.length>=6? arguments[arguments.length-2]: null;
  var yAnc = arguments.length>=6? arguments[arguments.length-1]: null;
  // get the sheet
  var sheet = this.sheet(sheetName);
  if(!sheet) throw new Error('unknown sheet: ' + sheetName);
  // if a particular sprite is specified, get it
  var sprite = (frame !== undefined && frame !== null)?
    sheet.getSprite(frame): sheet;
  // coooordinates
  var coords = this.toCanvasCoords(x, y, sprite.width, sprite.height, xAnc, yAnc);
  if(!coords) return;
  // do canvas flipping
  var xflip = (flip.indexOf('h')!==-1)? 1:0;
  var yflip = (flip.indexOf('v')!==-1)? 1:0;
  if(flip) {
    this.context.translate(this.canvas.width*xflip, this.canvas.height*yflip);
    this.context.scale(xflip?-1:1, yflip?-1:1);
  }
  // draw it to the screen
  this.context.drawImage(
    // image
    sprite.scaledImage(this.drawScale),
    // location on the spritesheet
    (sprite.left + (xflip?coords.rcut:coords.lcut)) * this.drawScale,
    (sprite.top + (yflip?coords.bcut:coords.tcut)) * this.drawScale,
    coords.width * this.drawScale, coords.height * this.drawScale,
    // location on screen
    this.canvas.width*xflip + (coords.x*(xflip?-1:1) - coords.width*xflip) * this.drawScale,
    this.canvas.height*yflip + (coords.y*(yflip?-1:1) - coords.height*yflip) * this.drawScale,
    coords.width * this.drawScale, coords.height * this.drawScale
  );
  // undo flipping
  if(flip) {
    this.context.translate(this.canvas.width*xflip, this.canvas.height*yflip);
    this.context.scale(xflip?-1:1, yflip?-1:1);
  }
};

pxcan.prototype.write =
pxcan.Panel.prototype.write = function(text, x, y, options) {
  // verify font
  var font = this.sheet(this.font);
  // options
  options = options || {};
  if(options.cols || options.rows)
    text = nigelgame.wrapString(text, options.cols, options.rows);
  var anchor = (options && options.anchor) || {};
  if(anchor.x === undefined) anchor.x = this.origin().x || 0;
  if(anchor.y === undefined) anchor.y = this.origin().y || 0;
  // format text into lines & get max column width
  var lines = text.split('\n');
  var maxcol = 0;
  for(var i = 0; i < lines.length; ++i) maxcol = Math.max(lines[i].length, maxcol);
  // how to align the text?
  var align = 0;
  if(!options || !options.align || options.align === "left") align = 0;
  else if(options.align === "center") align = 0.5;
  else if(options.align === "right") align = 1;
  else throw "unknown text alignment: " + options.align;
  // where the top left char at
  var coords = this.toCanvasCoords(x, y, font.spriteWidth * maxcol, font.spriteHeight * lines.length, null, null);
  if(!coords) return;
  var ltrWidth = font.spriteWidth;
  var ltrHeight = font.spriteHeight;
  // iterate
  for(var r = 0; r < lines.length; ++r) {
    var indent = Math.round((maxcol-lines[r].length)*align*font.spriteWidth);
    for(var c = 0; c < lines[r].length; ++c) {
      var ch = lines[r].charCodeAt(c) - 32;
      var sprite = font.getSprite(ch);
      // draw it to the screen
      this.context.drawImage(
        // image
        sprite.scaledImage(this.drawScale),
        // location on the spritesheet
        sprite.left * this.drawScale, sprite.top * this.drawScale,
        sprite.width * this.drawScale, sprite.height * this.drawScale,
        // location on screen
        (coords.x + indent + (c * ltrWidth)) * this.drawScale,
        (coords.y + (r * ltrHeight)) * this.drawScale,
        ltrWidth * this.drawScale, ltrHeight * this.drawScale
      );
    }
  }
};

pxcan.prototype.border =
pxcan.Panel.prototype.border = function(sheet) {
  sheet = sheet || "pxcan-border";
  // temporarily store origin and offset, then set them
  var oldOrigin = this.origin();
  var oldOffset = this.offset();
  this.origin(-1,-1);
  this.offset(0,0);
  // horizontal edges
  var sw = this.sheet(sheet).spriteWidth;
  for(var x = sw; x < this.width - sw; x += sw) {
    this.blit(sheet, {col:1, row:0}, x, 0, -1, -1);
    this.blit(sheet, {col:1, row:2}, x, this.height, -1, 1);
  }
  // vertical edges
  var sh = this.sheet(sheet).spriteHeight;
  for(var y = sh; y < this.height - sh; y += sh) {
    this.blit(sheet, {col:0, row:1}, 0, y, -1, -1);
    this.blit(sheet, {col:2, row:1}, this.width, y, 1, -1);
  }
  // corners
  this.blit(sheet, {col:0, row:0}, 0,0, -1, -1);
  this.blit(sheet, {col:2, row:0}, this.width,0, 1, -1);
  this.blit(sheet, {col:0, row:2}, 0,this.height, -1, 1);
  this.blit(sheet, {col:2, row:2}, this.width,this.height, 1, 1);
  // return origin and offset to old values
  this.origin(oldOrigin.x, oldOrigin.y);
  this.offset(oldOffset.x, oldOffset.y);
};

//give pxcan a unique id
(function() {
  var nextId = 0;
  
  Object.defineProperty(pxcan.prototype, "__id", { writable: true })
  Object.defineProperty(pxcan.prototype, "id", { get: function() {
    if (this.__id == undefined) this.__id = nextId++;
    return this.__id;
  } });
})();

//preloading module
(function() {
  var waitingOn = {};
  var numReqs = {};
  var pxcans = {};
  
  var imgBank = {};
  
  pxcan.isPreloading = function(pxc) {
    return !!(numReqs[pxc.id]);
  }
  
  pxcan.preload = function(src, pxc) {
    //validate
    if(!src) throw new Error("missing source image");
    //only preload something once
    if(pxc) {
      numReqs[pxc.id] |= 0;
      pxcans[pxc.id] = pxc;
    }
    if(imgBank[src]) {
      console.log("note: "+src+" was already preloaded.");
      return;
    }
    if(waitingOn[src]) {
      if(!pxc) {
        console.log("note: "+src+" was already requested to be preloaded");
      }
      if(waitingOn[src].indexOf(pxc.id)>=0) {
        console.log("note: "+src+" was already requested to be preloaded by this pxcan");
      }
      else {
        console.log("note: "+src+" was already requested to be preloaded by a different pxcan");
        waitingOn[src].push(pxc.id);
        ++numReqs[pxc.id];
      }
      return;
    }
    else if(pxc) {
      waitingOn[src] = [pxc.id];
    }
    
    //load image
    if(pxc) ++numReqs[pxc.id];
    var img = new Image();
    img.onload = onLoadedFile;
    img.onerror = function() { throw new Error("Failed to load image " + src); };
    img.src = src;
    
    function onLoadedFile() {
      //populate imagebank
      imgBank[src] = {
        image: img,
        scaledImages: {
          1: document.createElement("canvas")
        }
      };
      imgBank[src].scaledImages[1] = document.createElement("canvas");
      imgBank[src].scaledImages[1].width = img.width;
      imgBank[src].scaledImages[1].height = img.height;
      imgBank[src].scaledImages[1].getContext('2d').drawImage(img, 0, 0);
      //alert pxcans
      if(waitingOn[src]) {
        for(var i = 0; i < waitingOn[src].length; ++i) {
          var pid = waitingOn[src][i];
          --numReqs[pid];
          if(numReqs[pid] === 0 && pxcans[pid].onReady) {
            var p = pxcans[pid];
            p.onReady.call(p);
            p.onReady = null;
            delete pxcans[pid];
          }
        }
        delete waitingOn[src];
      }
    }
  };
  pxcan.hasImage = function(src) {
    return !!(imgBank[src]);
  };
  pxcan.image = function(src) {
    if(!imgBank[src]) throw new Error("invalid image src: "+src);
    return imgBank[src].image;
  };
  //helper to retrieve and create resized images
  pxcan.scaledImage = function(src, scale) {
    if(!imgBank[src]) throw new Error("invalid image src: "+src);
    //if cached, return it
    if(imgBank[src].scaledImages[scale]) return imgBank[src].scaledImages[scale];
  
    //otherwise here's how we make it
    var c = document.createElement("canvas");
    var img = imgBank[src].scaledImages[1];
    c.width = img.width * scale;
    c.height = img.height * scale;
    var con = c.getContext('2d');
    
    var data = img.getContext('2d').getImageData(0,0,img.width,img.height).data;
    var i = 0;
    for(var y = 0; y < img.height; ++y) {
      for(var x = 0; x < img.width; ++x) {
        con.fillStyle = 'rgba('+data[i]+','+data[i+1]+','+data[i+2]+','+data[i+3]+')';
        con.fillRect(x*scale, y*scale, scale, scale);
        i+=4;
      }
    }
    
    //cache and return
    imgBank[src].scaledImages[scale] = c;
    return c;
  };
})();


pxcan.Sheet = function(alias, src, spriteWidth, spriteHeight) {
  // properties
  Object.defineProperty(this, 'alias', { get: function() { return alias; } });
  Object.defineProperty(this, 'img', { get: function() { return pxcan.image(src); } });
  Object.defineProperty(this, 'src', { get: function() { return src; } });
  Object.defineProperty(this, 'left', { get: function() { return 0; } });
  Object.defineProperty(this, 'top', { get: function() { return 0; } });
  Object.defineProperty(this, 'width', { get: function() { return this.img.width; } });
  Object.defineProperty(this, 'height', { get: function() { return this.img.height; } });
  Object.defineProperty(this, 'spriteWidth', { get: function() { return spriteWidth || this.img.width; } });
  Object.defineProperty(this, 'spriteHeight', { get: function() { return spriteHeight || this.img.height; } });
  Object.defineProperty(this, 'numCols', { get: function() { return Math.floor(this.img.width / spriteWidth); } });
  Object.defineProperty(this, 'numRows', { get: function() { return Math.floor(this.img.height / spriteHeight); } });
  Object.defineProperty(this, 'numSprites', { get: function() { return this.numCols * this.numRows; } });
};

pxcan.Sheet.prototype.scaledImage = function(scale) {
  return pxcan.scaledImage(this.src, scale);
};

pxcan.Sheet.prototype.getSprite = function(frame) {
  return new pxcan.Sprite(this, frame);
};

pxcan.Sprite = function(sheet, frame) {
  // validate frame
  if(frame === undefined || frame === null)
    throw new Error('bad frame while constructing sprite');
  // if frame is given as a number, get the column and row
  if((typeof frame === "number") && (frame%1)===0) {
    frame = { col: frame % sheet.numCols, row: Math.floor(frame / sheet.numCols) };
  }
  // calculate dimensions
  var fx = frame.x!==undefined? frame.x: frame.col? frame.col*sheet.spriteWidth: 0;
  var fy = frame.y!==undefined? frame.y: frame.row? frame.row*sheet.spriteHeight: 0;
  var fw = frame.width!==undefined? frame.width: (frame.col!==undefined? sheet.spriteWidth: sheet.width-fx);
  var fh = frame.height!==undefined? frame.height: (frame.row!==undefined? sheet.spriteHeight: sheet.height-fy);
  
  // properties
  Object.defineProperty(this, 'sheet', { get: function() { return sheet; } });
  Object.defineProperty(this, 'img', { get: function() { return sheet.img; } });
  Object.defineProperty(this, 'left', { get: function() { return fx; } });
  Object.defineProperty(this, 'top', { get: function() { return fy; } });
  Object.defineProperty(this, 'width', { get: function() { return fw; } });
  Object.defineProperty(this, 'height', { get: function() { return fh; } });
};

pxcan.Sprite.prototype.scaledImage = function(scale) {
  return pxcan.scaledImage(this.sheet.src, scale);
};

pxcan.globalSheets = {};

(function() {
  function registerGlobalSheet(src, alias, w, h) {
    pxcan.preload(src);
    pxcan.globalSheets[alias] = new pxcan.Sheet(alias, src, w, h);
  }
  
  registerGlobalSheet(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABgCAYAAACtxXToAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABp0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTFH80I3AAAGRElEQVR4XuWS0W7kRhAD8/8/7YDKlkBR7JHkWzsJtgBaQ1bvy+H++vr6+ujUcQhcOWg3/m0RbRPe3fsumlOcffeDq8CVg+Yd9+0md97sHtHeHmff/eAqMLn29gj/phO5Z8ST3QOH/VAuItpORHvnxjfjTH7awTe/mbZH/wB/kka7U6DtzQt/C/pl6lgCzd2N8G86p3l/i1XnfZk6lkBz74po+5049LypaSPc3f9vEXt3oUDuBJpTRNsVaO43I/buQhG5ZcS05dcDuf9mxGHzAr61wLSLaXf85rciDpsX8K0Fpl1Mu5Pef5NJ2s1VxGnPQeSWEdOWXw/c3d8dcdpzgNwJNKeItiswubbfCTRHRNtP/wAK3N3/NKLtdwPNEdH2+g/wUeGRHI5egZWDpz5vpt3xm7ybdmfzfpA/yg6+47KLu57tyq0CzWVg6z4IP+Ltm8g9A80p4H1yvjnN+zYF9i3H/Hogdw+snJh2x288kN3x+3a37y7ycD96BXIn0JwHnjoCU2fzziYO+ySEdzaRO67tisgufFs5kV1Mnc07mzjsKeFwpCFYOVjduPPAtMNT7zeH/VA+MTySw5GGIP1/PcnuXO7j1vqbLqaegeYyTvMtzsrX3g7Y2psupp6B5jywcrC6ac4DW88R2Ccv8uZPAs09Cayc2HcX+7i1Y/dAcy3QnAdWDlY3zSlw2CchvPsurraMaHvGab7FaX4ZHsnhSIMxudyJaPtvBw77oXxieCSHo1ecaQf3VzeJ/655uOunm80h/bhtwt9i6mzphd+k977yGWhOcU6eA74OR4K3302dbeU9kNvKe6A5BZo7/QP4l4jsIruzus9AbumTybOnr53BBeQPkvR0tpX3QG4r74HmFMhtex/KEJFdTJ0tvfCb9N5XPgPNKY5v27sdwen4FUjv4PwmmZz/rnlI77/JJLvzo4+M/oAL4Z3Nuevhbs9Abnc93dmdy33c2rH7LppTYNpg8i2O98mzpacf/OVBBJpTYNr4Tr4FePvXPUyefvB+kPgPCDSnQNuE7+mbU4C3f5uH5n3b3pcHEcjtyjvu3OdOILfJw9TZtvflQQRyu/LijvftV/zlwSuNyfvu7qon0z3bXU93dudHHxn9aeRhsnLCfbtZOXDf7t/iT8Mrwt/ip7xvou3ZxVv8aXhF+Fu807dA27OLt3gfnPEHr4j0jt+2m/R+0/bsIrf2nrrY+mkoAe9PfAae7NlFbnfc6eY0DHEml1t704VvV3t2kdsdd7o5DRdxcsu77I67drNyIr3fTI6v2N3++IUk6bx7knbz7egPMIJ33pNv+G/8Lndc2z3QnCLavgwPwVfsB1s7d+GbB+7uRLSdwMqJ5sd4Ad/c8RXpCTx1img7gdUOeTPGi/DuSVY3zSnQHBFtV6Dtq76MF/DNA08dgeaIaLsCzX07PARfsR9Y4O6egeY8YtpFc9+O/gAj7EevwLQnV3fpicjuuLuTic3n8ceFh3M4uBFo7juB5qYk7aaGh3M4eCVpzrdMo90p0DZoLrfscPDtyLcWmHrGaT4DU2dbeQ/UzugyN5JMu2i/8y3TWDkxeXb32cXWXUyBu51t5T0iu5h6Bpojjc3lYYvILqbOll74jfvsYupsK78KbD1ly4T7dodvTkyODT/dpPMtk+zOjz4y+gMnGYHmFLi7e5zmfyz6Ayf5pkBzHph2QU/f7vLG2Z3LfSxxmlectk/9yZ7f9L7d8n7g+DGB5hSYdkhPYLXnN71vt/zlgQVyJzDtIp0HVnt+0/t2y18eWKDtV16sblYOcnuLvzx4pTE5/537qfvmXN3f9XRnd370kanjvxRo7seiP4IvHI40GHR37cbTmG7anl28xZ+Gf54bT7u4c9+SpMsu3uJPwyuiveli6i3J6qbt2cWTnl+xeR+cTVoa6fx+FXiyZxe53XGnm9NwIzD1jMgufMudb77pIrc77nRzGm7E8Z53nuTqZuVgddNcvfGjj0wdfzhwdyfQ3LejP8AI3nlPvuG/ydunjkBzU6C99/8BIg/SeRe+eeCdjsDVLvINh53SDppzVndP3ZOA98m5d/Y9D4VvLXC1tcBTR6C5KYKvOOxXRy0w9VXgqSPQ3BTBVxz2SQi6b7By4DceuLsTaG4VKO+vr78B2SR9y/KArIAAAAAASUVORK5CYII=",
    "pxcan-ascii", 8, 8
  );
  registerGlobalSheet(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAhElEQVRIie2WwQrAIAxDU/H/fzk7CdHVwdYWdjCXipQX04NqJIlCdVkbAG5q2EAh3NSQgUJCJxaeAaAm+DqONaEpp22a3mgCrrwmTVG5jIwEj8pM4HKa15WpY3AM/m3AagOrNrglyLouJp4aZF1400u4vmhZJmMa7IiPxvsojH1Y9bflAvhRIjH91XRBAAAAAElFTkSuQmCC",
    "pxcan-border", 8, 8
  );

})();