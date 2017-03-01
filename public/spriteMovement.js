// Acquire resources
// -----------------
// Grab the canvas
var canvas = document.getElementById('myCanvas');
var context = canvas.getContext('2d');

var adj_map; // json object from the ajax call
             // will be assigned to, but required for outer scope
var sprite;  // likewise

// ajax: get node data as an adjacency graph
var map_src = "adj_graph.json";
$.getJSON( map_src, function( data ) {
  adj_map = data;
  sprite = initialiseSprites();
});

// Background road map from the svg OSM paths
// Load and draw it
var roadMap = new Image();
roadMap.onload = function() {
  context.drawImage(roadMap, 0,0);
};
roadMap.src = "static_map.svg";

var nSprites = 20;
function initialiseSprites() {
  var nNodes = adj_map["osm_nodes"].length;
  var sprites = [];

  for (var i=0; i<nSprites; i++) {
    var startNode = randomIntBound(nNodes);
    var neighbours = adj_map["osm_adjacency"][startNode];
    var randIndx = randomIntBound(neighbours.length);
    sprites.push({
      previousNode: startNode,
      targetNode: neighbours[randIndx],
      pos: getCoordsOfNode(startNode)
    });
  }
  return sprites;
}


// For now, this constitutes the "game loop"
// Every mouse click advance a frame
$( "#myCanvas" ).mousedown(function() {
  window.requestAnimationFrame(gameLoop);
});

var startTime = null;
function gameLoop(timestamp) {
  if (!startTime) startTime = timestamp;
  var elapsed = timestamp - startTime;
  startTime = timestamp;
  update(elapsed);
  render();
  /*if (elapsed < 2000) {*/
    window.requestAnimationFrame(gameLoop);
  /*}*/
}


function getCoordsOfNode(n) {
  return {
    x: adj_map["osm_nodes"][n][0],
    y: adj_map["osm_nodes"][n][1]
  };
}

function update(tFrame) {
  for (i=0; i<nSprites; i++) {
    updateSprite(sprite[i], tFrame);
  }
}

function render() {
  context.clearRect(0,0,500,500);  // clear canvas
  context.drawImage(roadMap, 0,0); // redraw background
  for (i=0; i<nSprites; i++) {
    drawSprite(sprite[i]);
  }
}

var epsilon = 1.8; // threshold to consider a sprite has reached a node
var speed = 0.01;
function updateSprite(sprite, tFrame) {
  // move increment
  var ds = speed * tFrame; // how far to move
  var source = getCoordsOfNode(sprite.previousNode);
  var dest = getCoordsOfNode(sprite.targetNode);
  var angle = Math.atan2(dest.y-source.y, dest.x-source.x);
  var dy = Math.sin(angle) * ds;
  var dx = Math.cos(angle) * ds;

  sprite.pos.x += dx;
  sprite.pos.y += dy;

  if (distanceBetween(sprite.pos, dest) < epsilon) {
    // Place the sprite at the node it just reached
    sprite.pos = dest;
    sprite.previousNode = sprite.targetNode;

    // Set this sprite to face a random neighbour
    var neighbours = adj_map["osm_adjacency"][sprite.previousNode];
    var randIndx = randomIntBound(neighbours.length);
    //   ...and avoid going backwards
    if (sprite.previousNode == neighbours[randIndx]) {
      randIndx = (randIndx + 1) % neighbours.length;
    }
    sprite.targetNode = neighbours[randIndx];
  }
}

function distanceBetween(p1, p2) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;
  return Math.sqrt(dx*dx + dy*dy);
}

function randomIntBound(n) {
  return Math.ceil(Math.random()*n)-1;
}

function drawSprite(sprite) {
  var radius = 5;
  var x = sprite.pos.x;
  var y = sprite.pos.y;
  context.fillStyle = "#f00";
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2, false);
  context.fill();
}

console.log( "Loaded" );

