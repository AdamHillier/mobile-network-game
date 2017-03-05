"use strict";

(function () {
    // Game parameters
    var params = {
        numberOfSprites: 20,    // Initial sprite count
        nodeEpsilon: 1,       // Radius in which a sprite has reached a node
        spriteSpeed: 0.005       // Speed of sprites
    }

    // 'Global' variables
    var canvas;
    var context;
    var roadMap;
    var adjMap;
    var sprites;
    var startTime;
    var towers;

    var pendingActions = {
        none: 0,
        placeTower: 1
    }
    var currentPendingAction = pendingActions.none;
    

    function initialise() {
        canvas = document.getElementById('myCanvas');
        context = canvas.getContext('2d');
        roadMap = new Image();
        sprites = new Array();
        towers = new Array();

        // This is currently the only thing we're using JQuery for.
        // In the future we could in-line the JSON, allowing us to remove
        // JQuery as a (heavy) dependency.
        $.getJSON("adj_graph.json", function (data) {
            adjMap = data;
            initialiseSprites();
        });

        // Initialise roadmap
        roadMap.src = "static_map.svg";
        roadMap.onload = function() {
            context.drawImage(roadMap, 0,0);
        };

        function initialiseSprites () {
            var numberOfNodes = adjMap["osm_nodes"].length;
            for (var i = 0; i < params.numberOfSprites; i++) {
                var startNode = randomIntBound(numberOfNodes);
                var neighbours = adjMap["osm_adjacency"][startNode];
                var randIndx = randomIntBound(neighbours.length);
                sprites.push(new Sprite(startNode, neighbours[randIndx], getNodePosition(startNode)))
            }
        }

        // click canvas currently only does one thing: place a tower
        // but this can be extended to add other actions
        canvas.onclick = function(event) {
            if (currentPendingAction == pendingActions.placeTower){
                var boundary = canvas.getBoundingClientRect();
                var x = event.clientX - boundary.left;
                var y = event.clientY - boundary.top;
                towers.push(new Tower(new Position(x, y)));
                currentPendingAction = pendingActions.none;
                //after placing the tower, hide explanation
                document.getElementById("explanation").style.display = "none"; 
            };
            
        }
    }

    function gameLoop(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = timestamp - startTime;
        startTime = timestamp;

        // Call update on each sprite
        sprites.forEach(function (sprite) { sprite.update(elapsed) });

        render();
        window.requestAnimationFrame(gameLoop);
    }

    function render() {
        context.clearRect(0,0,500,500);  // clear canvas
        context.drawImage(roadMap, 0,0); // redraw background

        drawSprites();
        drawTowers();
    }

    //Sprites

    function Sprite(prevNode, targetNode, pos) {
        this.previousNode = prevNode;
        this.targetNode = targetNode;
        this.pos = pos;
    }
    Sprite.prototype.update = function (tFrame) {
        // move increment
        var ds = params.spriteSpeed * tFrame; // how far to move
        var source = getNodePosition(this.previousNode);
        var dest = getNodePosition(this.targetNode);
        var angle = Math.atan2(dest.y-source.y, dest.x-source.x);
        var dy = Math.sin(angle) * ds;
        var dx = Math.cos(angle) * ds;

        if (this.pos.distanceTo(dest) < ds) {
          console.log("overstep");
        }

        this.pos.x += dx;
        this.pos.y += dy;

        if (this.pos.distanceTo(dest) < params.nodeEpsilon) {
            // Place the this at the node it just reached
            this.pos = dest;
            this.previousNode = this.targetNode;

            // Set this this to face a random neighbour
            var neighbours = adjMap["osm_adjacency"][this.previousNode];
            var randIndx = randomIntBound(neighbours.length);
            //   ...and avoid going backwards
            if (this.previousNode == neighbours[randIndx]) {
                randIndx = (randIndx + 1) % neighbours.length;
            }
            this.targetNode = neighbours[randIndx];
        }
    }
    function drawSprites(){
        var radius = 5;
        context.fillStyle = "#f00";
        sprites.forEach(function (sprite) {
            context.beginPath();
            context.arc(sprite.pos.x, sprite.pos.y, radius, 0, Math.PI * 2, false);
            context.fill();
        });
    }

    //Towers

    function Tower(pos) {
        this.pos = pos;
    };
    function drawTowers(){
        context.fillStyle = "blue";
        towers.forEach(function(tower){
            drawSingleTower(tower);
        });
    }
    function drawSingleTower(tower) {
        var size = 10;
        var x = Math.max(tower.pos.x - size/2.0, 0)
        var y = Math.max(tower.pos.y - size/2.0, 0)
        context.fillRect(x, y, size, size);
    };


    function Position(x, y) {
        this.x = x;
        this.y = y;
    }
    Position.prototype.distanceTo = function (that) {
        // Assume that.instanceof(Position)
        var dx = this.x - that.x;
        var dy = this.y - that.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    // Helper methods
    function getNodePosition(n) {
        return new Position(adjMap["osm_nodes"][n][0], adjMap["osm_nodes"][n][1]);
    }
    function randomIntBound(n) {
        return Math.floor(Math.random()*n);
    }


    //another place to use jquery
    //make sure all DOMs are loaded before operating on them
    $(document).ready(function(){

        //bind button actions

        var startGameButton = document.getElementById("startGame");
        startGameButton.onclick = function() {
            document.getElementById("placeTower").style.display = "inline"; //show button for placing tower
            window.requestAnimationFrame(gameLoop);
        };

        var placeTowerButton = document.getElementById("placeTower");
        placeTowerButton.onclick = function() {
            currentPendingAction = pendingActions.placeTower;
            document.getElementById("explanation").style.display = "inline"; //show explanation
        };

        //initialise game
        initialise();

    })
    
})();
