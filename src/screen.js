nigelgame.Screen = function(element, mw, mh) {
  //vars
  this.element = element;
  this.minWidth = mw || element.clientWidth || element.innerWidth;
  this.minHeight = mh || element.clientHeight || element.innerWidth;
  this.width = undefined;
  this.height = undefined;
  this.drawScale = undefined;
  
  //create canvas element
  this.canvas = document.createElement("canvas");
  this.canvas.style.display = "block";
  this.canvas.style.width = "100%";
  this.canvas.style.height = "100%";
  this.canvas.style.backgroundColor = "#000";
  //drawing context
  this.context = this.canvas.getContext("2d");
  //put canvas on page
  var parent = (element !== window)? element: document.getElementsByTagName("body")[0];
  parent.appendChild(this.canvas);
  //make it selectable (if it's not just in the window)
  if(this.element !== window && this.element.tabIndex < 0) this.element.tabIndex = 0;
  //fit to div
  this.fitElement();
};

nigelgame.Screen.prototype.fitElement = function() {
  var w = this.element.clientWidth || this.element.innerWidth;
  var h = this.element.clientHeight || this.element.innerHeight;
  //if it hasn't changed, skip this step.
  if(this.prevDims && this.prevDims.width === w && this.prevDims.height === h) {
    return;
  }
  //if the desired aspect ratio is equal
  if(this.minWidth * h === this.minHeight * w) {
    this.width = this.minWidth;
    this.height = this.minHeight;
  }
  //if it needs to be WIDER
  else if(this.minWidth * h < this.minHeight * w) {
    this.width = Math.floor(w / h * this.minHeight);
    this.height = this.minHeight;
  }
  //if it needs to be TALLER
  else {
    this.width = this.minWidth;
    this.height = Math.floor(h / w * this.minWidth);
  }
  //draw at a lower scale...
  this.drawScale = Math.floor(Math.min(h/this.height, w/this.width));
  if(this.drawScale < 1) this.drawScale = 1; //unless it's smaller than minimum
  this.canvas.width = this.width * this.drawScale;
  this.canvas.height =  this.height * this.drawScale;
  //crispy
  this.context.webkitImageSmoothingEnabled =
    this.context.imageSmoothingEnabled =
    this.context.mozImageSmoothingEnabled =
    this.context.oImageSmoothingEnabled = false;
  //remember this so it doesn't have to do it again
  this.prevDims = { height: h, width: w };
  //if the view is the whole window, then keep it at the right location
  if(this.element === window) {
    window.scrollTo(0, 0);
  }
};

nigelgame.Screen.prototype.clear = function() {
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
};

nigelgame.Screen.prototype.fill = function(rect, color) {
  //robust arguments
  if(!(rect instanceof nigelgame.Rect)) rect = new nigelgame.Rect(rect);
  //set color
  var temp = this.context.fillStyle;
  this.context.fillStyle = color;
  //draw the rectangle
  this.context.fillRect(
    rect.leftFor(this) * this.drawScale,
    rect.topFor(this) * this.drawScale,
    rect.width * this.drawScale,
    rect.height * this.drawScale
  );
  //set color back
  this.context.fillStyle = temp;
};

nigelgame.Screen.prototype.drawSprite = function(sprite, point, options) {
  //robust arguments
  if(sprite instanceof nigelgame.Sheet) sprite = sprite.getSprite();
  else if(!sprite.sheet || !sprite.rect) throw "invalid sprite.";
  if(!(point instanceof nigelgame.Point)) point = new nigelgame.Point(point);
  anchor = (options && options.anchor) || {}
  anchor.x = anchor.x || 0;
  anchor.y = anchor.y || 0;
  //onscreen location
  var sx = point.xFor(this) + this.width / 2 - (anchor.x + 1) / 2 * sprite.rect.width;
  var sy = point.yFor(this) + this.height / 2 - (anchor.y + 1) / 2 * sprite.rect.height;
  //draw it to the screen
  this.context.drawImage(sprite.sheet.img,
    //location on the spritesheet
    sprite.rect.left, sprite.rect.top, sprite.rect.width, sprite.rect.height,
    //location on screen
    sx * this.drawScale, sy * this.drawScale,
    sprite.rect.width * this.drawScale, sprite.rect.height * this.drawScale
  );
};

nigelgame.Screen.prototype.drawString = function(text, font, point, options) {
  //robust arguments
  if(typeof(text) !== "string") text = text + "";
  if(!(font instanceof nigelgame.Sheet)) throw "invalid font in drawString.";
  if(!(point instanceof nigelgame.Point)) point = new nigelgame.Point(point);
  point = point || new nigelgame.Point({ x: 0, y: 0 });
  options = options || {};
  options.anchor = options.anchor || {};
  options.anchor.x = options.anchor.x || 0;
  options.anchor.y = options.anchor.y || 0;
  //separate into lines
  var lines;
  //if no column limit, just split by newline
  if(!options.cols) {
    lines = text.split('\n');
  }
  //otherwise, split by newline OR line too long
  else {
    lines = [];
    var s = text;
    for(var r = 0; s.length > 0 && !(r >= options.rows); ++r) {
      lines.push(s.substr(0, Math.min(s.indexOf('\n'), options.cols)));
      s = s.substr(Math.min(s.indexOf('\n')+1, options.cols));
    }
  }
  //max line length, needed to format text
  var maxcol = 0;
  lines.forEach(function(x){if(x.length>maxcol)maxcol=x.length;});
  //how to align the text?
  var align = 0;
  if(options.align === "left" || options.align === undefined) align = 0;
  else if(options.align === "center") align = 0.5;
  else if(options.align === "right") align = 1;
  else throw "unknown text alignment: " + options.align;
  //top left text point
  var tl = point.translate({
    x: -maxcol * font.spriteWidth * (options.anchor.x+1) / 2,
    y: -lines.length * font.spriteHeight * (options.anchor.y+1) / 2
  });
  //print all characters
  for(var r = 0; r < lines.length; ++r) {
    var indent = Math.floor((maxcol-lines[r].length)*align);
    var pt = tl.translate({ x: indent*font.spriteWidth, y: r*font.spriteHeight });
    for(var c = 0; c < lines[r].length; ++c) {
      //get character and draw it
      var ch = lines[r].charCodeAt(c) - 32;
      this.drawSprite(font.getSprite(ch), pt, { anchor: { x: -1, y: -1 } });
      pt = pt.translate({ x: font.spriteWidth });
    }
  }
};

nigelgame.Screen.prototype.drawBox = function(box, rect, options) {
  //robust arguments
  if(!(rect instanceof nigelgame.Rect)) rect = new nigelgame.Rect(rect);
  options = options || {};
  options.anchor = options.anchor || {};
  options.anchor.x = options.anchor.x || 0;
  options.anchor.y = options.anchor.y || 0;
  //position on screen
  var pt = rect.point.translate({
    x: -rect.width * (options.anchor.x+1)/2,
    y: -rect.height * (options.anchor.y+1)/2
  });
  //draw the sprites
  var anc = { anchor: { x: -1, y: -1 } };
  //horizontal 
  for(var di = box.spriteWidth, i = di; i <= rect.width-di; i += di) {
    //top
    this.drawSprite(box.getSprite({row:0, col:1}), pt.translate({ x: i, y: 0 }), anc);
    //bottom
    this.drawSprite(box.getSprite({row:2, col:1}), pt.translate({ x: i, y: rect.height - box.spriteHeight }), anc);
  }
  //vertical
  for(var di = box.spriteHeight, i = di; i <= rect.height-di; i += di) {
    //left
    this.drawSprite(box.getSprite({row:1, col:0}), pt.translate({ x: 0, y: i }), anc);
    //right
    this.drawSprite(box.getSprite({row:1, col:2}), pt.translate({ x: rect.width-box.spriteWidth, y: i }), anc);
  }
  //corners
  this.drawSprite(box.getSprite({row: 0, col: 0}), pt, anc);
  this.drawSprite(box.getSprite({row: 0, col: 2}), pt.translate({ x: rect.width-box.spriteWidth }), anc);
  this.drawSprite(box.getSprite({row: 2, col: 0}), pt.translate({ y: rect.height-box.spriteHeight }), anc);
  this.drawSprite(box.getSprite({row: 2, col: 2}), pt.translate({ x: rect.width-box.spriteWidth, y: rect.height-box.spriteHeight }), anc);
  //positioning of interior content
  var inner = rect.resize({top:-8, bottom:-8, left:-8, right:-8});
  //fill inside of box
  if(options && options.color) this.fill(inner, options.color);
};