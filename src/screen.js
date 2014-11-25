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
};

nigelgame.Screen.prototype.fitElement = function() {
  var w = this.element.clientWidth || this.element.innerWidth;
  var h = this.element.clientHeight || this.element.innerHeight;
  //if it hasn't changed, skip this step.
  this.wasResized = !this.prevDims || this.prevDims.width !== w || this.prevDims.height !== h;
  if(!this.wasResized) return;
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

nigelgame.Screen.prototype.getRect = function() {
  return new nigelgame.Rect({
    left: -this.width/2,
    top: -this.height/2,
    width: this.width,
    height: this.height
  });
};

nigelgame.Screen.prototype.clear = function() {
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
};

nigelgame.Screen.prototype.fill = function(color, rect) {
  //robust arguments
  if(!(rect instanceof nigelgame.Rect)) rect = new nigelgame.Rect(rect);
  //set color
  var temp = this.context.fillStyle;
  this.context.fillStyle = color;
  //draw the rectangle
  this.context.fillRect(
    Math.round(rect.leftFor(this) + this.width / 2) * this.drawScale,
    Math.round(rect.topFor(this) + this.height / 2) * this.drawScale,
    Math.round(rect.widthFor(this)) * this.drawScale,
    Math.round(rect.heightFor(this)) * this.drawScale
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
    sprite.rect.leftFor(sprite.sheet), sprite.rect.topFor(sprite.sheet),
    sprite.rect.widthFor(sprite.sheet), sprite.rect.heightFor(sprite.sheet),
    //location on screen
    Math.round(sx) * this.drawScale, Math.round(sy) * this.drawScale,
    sprite.rect.widthFor(sprite.sheet) * this.drawScale,
    sprite.rect.heightFor(sprite.sheet) * this.drawScale
  );
};

nigelgame.Screen.prototype.drawString = function(text, font, point, options) {
  //robust arguments
  var ns;
  if(text instanceof nigelgame.Nstring) ns = text;
  else {
    if(typeof(text) !== "string") text = text + "";
    ns = new nigelgame.Nstring(text, options.cols, options.rows);
  }
  if(!(font instanceof nigelgame.Sheet)) throw "invalid font in drawString.";
  if(!(point instanceof nigelgame.Point)) point = new nigelgame.Point(point);
  point = point || new nigelgame.Point({ x: 0, y: 0 });
  options = options || {};
  var anchor = options.anchor ?
    { x: options.anchor.x || 0, y: options.anchor.y || 0 } :
    { x: 0, y: 0 };
  //how to align the text?
  var align = 0;
  if(options.align === "left" || options.align === undefined) align = 0;
  else if(options.align === "center") align = 0.5;
  else if(options.align === "right") align = 1;
  else throw "unknown text alignment: " + options.align;
  //top left text point
  var tl = point.translate({
    x: -ns.maxcol * font.spriteWidth * (anchor.x+1) / 2,
    y: -ns.lines.length * font.spriteHeight * (anchor.y+1) / 2
  });
  //print all characters
  for(var r = 0; r < ns.lines.length; ++r) {
    var indent = Math.floor((ns.maxcol-ns.lines[r].length)*align);
    var pt = tl.translate({ x: indent*font.spriteWidth, y: r*font.spriteHeight });
    for(var c = 0; c < ns.lines[r].length; ++c) {
      //get character and draw it
      var ch = ns.lines[r].charCodeAt(c) - 32;
      this.drawSprite(font.getSprite(ch), pt, { anchor: { x: -1, y: -1 } });
      pt = pt.translate({ x: font.spriteWidth });
    }
  }
};

nigelgame.Screen.prototype.drawBox = function(box, rect, color) {
  //robust arguments
  if(!(rect instanceof nigelgame.Rect)) rect = new nigelgame.Rect(rect);
  //fill background first, maybe.
  if(color) {
    this.fill(color, rect);
  }
  //draw the sprites
  //position on screen
  var pt = rect.pointIn({ xAnchor: -1, yAnchor: -1 });
  //horizontal 
  for(var di = box.spriteWidth, i = di; i < rect.widthFor(this)-di; i += di) {
    //top
    this.drawSprite(box.getSprite(1), pt.translate({ x: i }), {anchor: {x:-1, y:-1}});
    //bottom
    this.drawSprite(box.getSprite(7), pt.translate({ x: i, y: rect.heightFor(this) }), {anchor:{x:-1, y:1}});
  }
  //vertical
  for(var di = box.spriteHeight, i = di; i < rect.heightFor(this)-di; i += di) {
    //left
    this.drawSprite(box.getSprite(3), pt.translate({ y: i }), {anchor:{x:-1,y:-1}});
    //right
    this.drawSprite(box.getSprite(5), pt.translate({ x: rect.widthFor(this), y: i }), {anchor:{x:1,y:-1}});
  }
  //corners
  this.drawSprite(box.getSprite(0), rect.pointIn({ xAnchor: -1, yAnchor: -1 }), { anchor: {x: -1, y: -1}});
  this.drawSprite(box.getSprite(2), rect.pointIn({ xAnchor: 1, yAnchor: -1 }), { anchor: {x: 1, y: -1}});
  this.drawSprite(box.getSprite(6), rect.pointIn({ xAnchor: -1, yAnchor: 1 }), { anchor: {x: -1, y: 1}});
  this.drawSprite(box.getSprite(8), rect.pointIn({ xAnchor: 1, yAnchor: 1 }), { anchor: {x: 1, y: 1}});
};

nigelgame.Screen.prototype.drawStringBox = function(text, font, box, point, options) {
  //robust args
  if(!(point instanceof nigelgame.Point)) point = new nigelgame.Point(point);
  options = options || {};
  var anchor = options.anchor ?
    { x: options.anchor.x || 0, y: options.anchor.y || 0 } :
    { x: 0, y: 0 };
  //format string
  var nstr = new nigelgame.Nstring(text, options.cols, options.rows);
  //figure out size of box
  var w = (options.cols || nstr.maxcol) * font.spriteWidth + 2 * box.spriteWidth;
  var h = (options.rows || nstr.rows) * font.spriteHeight + 2 * box.spriteHeight;
  var rect = {
    left: point.x - w * (anchor.x+1)/2,
    width: w,
    top: point.y - h * (anchor.y+1)/2,
    height: h,
    leftAnchor: point.xAnchor,
    topAnchor: point.yAnchor
  };
  //draw rect
  this.drawBox(box, rect, options.color);
  //draw the string
  this.drawString(text, font, point.translate({ x: -box.spriteWidth * anchor.x, y: -box.spriteHeight * anchor.y }),
    { cols: options.cols, rows: options.rows, anchor: anchor, align: options.align }
  );
};