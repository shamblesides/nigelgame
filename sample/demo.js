var game;
if(document.getElementById('game')) game = new pxcan('#game');
else game = new pxcan(window);

game.setBackground('black');
game.preload('img/chara.png', 'chara', 20,20);
game.preload("img/bg.png", "bg");

game.bind('right', 68, 39);
game.bind('left', 65, 37);
game.bind('up', 87, 38);
game.bind('down', 83, 40);

var chara = {x:0, y:0, xDir:0, yDir:0, speed:1, frame:0};

game.onFrame = function() {
  var panels = [
    this.panel(-1,-1,this.width/2-3,this.height/2-3, 1, 1),
    this.panel(1,-1,this.width/2-3,this.height/2-3, -1, 1),
    this.panel(-1,1,this.width/2-3,this.height/2-3, 1, -1),
    this.panel(1,1,this.width/2-3,this.height/2-3, -1, -1),
    this.panel(0,0, this.width/2, this.height/2)
  ];

  // update movement based on keys
  chara.xDir = ({ 'left': -1, 'right': 1 })[this.pad('left','right')] || 0;
  chara.yDir = ({ 'up': -1, 'down': 1 })[this.pad('up','down')] || 0;
  
  // or touch!
  if (this.touch.isDown) {
    chara.xDir = Math.sign((this.touch.rel(panels[0]).x - chara.x)/chara.speed | 0);
    chara.yDir = Math.sign((this.touch.rel(panels[0]).y - chara.y)/chara.speed | 0);
  }

  // move
  chara.x += chara.xDir * chara.speed;
  chara.y += chara.yDir * chara.speed;
  // movement frame
  if (chara.xDir || chara.yDir) chara.frame = (chara.frame+1)%3;
  // draw
  this.reset();
  var flip = (this.clock % 50 >= 25)? 'hv': '';
  panels.forEach(function(p) {
    p.clear();
    p.blit('bg', null, 0, 0);
    p.blit('chara', chara.frame, flip, chara.x, chara.y, 0, 1);
  });

};