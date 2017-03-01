"use strict";

(function () {
    // Game parameters
    var params = {
        numberOfSprites: 20,    // Initial sprite count
        nodeEpsilon: 1.8,       // Radius in which a sprite has reached a node
        spriteSpeed: 0.01       // Speed of sprites
    }

    // 'Global' variables
    var canvas;
    var context;
    var roadMap;
    var adjMap;
    var sprites;
    var startTime;

    function initialise() {
        canvas = document.getElementById('myCanvas');
        context = canvas.getContext('2d');
        roadMap = new Image();
        sprites = new Array();

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

        // Start on mouse-down
        canvas.onmousedown = function() {
            window.requestAnimationFrame(gameLoop);
        };
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

        // Draw sprites
        var radius = 5;
        context.fillStyle = "#f00";
        sprites.forEach(function (sprite) {
            context.beginPath();
            context.arc(sprite.pos.x, sprite.pos.y, radius, 0, Math.PI * 2, false);
            context.fill();
        });
    }

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

    initialise();
})();
