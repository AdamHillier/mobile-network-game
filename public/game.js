"use strict";

(function () {
    // Game parameters
    var params = {
        numberOfSprites: 20,    // Initial sprite count
        nodeEpsilon: 1,       // Radius in which a sprite has reached a node
        spriteSpeed: 0.005       // Speed of sprites
    };

    // 'Global' variables
    var svg;
    var peopleGroup;
    var towerGroup;
    var rangeGroup;

    var canvas;
    var context;
    var roadMap;
    var adjMap;

    var sprites;
    var startTime;

    var towers;
    var TOWER_RANGE = 50;
    var MAX_LOAD = 1; // Maximum number of calls each tower can handle simultaneously

    var pendingActions = {
        none: 0,
        placeTower: 1
    };
    var currentPendingAction = pendingActions.none;
		
		var spriteCallStatus = {
			none: "#f0f",
			dialing: "#0ff",
			dialingPulse: "#00f",
			success: "#0f0",
			failure: "#f00"
		};
    

    function initialise() {
        canvas = document.getElementById('myCanvas');

        svg = document.getElementById('map');
        peopleGroup = document.getElementById('people-group');
        towerGroup = document.getElementById('tower-group');
        rangeGroup = document.getElementById('range-group');

        context = canvas.getContext('2d');
        roadMap = new Image();
        sprites = new Array();
        towers = new Array();

        // Previously with JQuery, now inline in adj_graph.js
				adjMap = ADJ_GRAPH;
				initialiseSprites();

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

                var sprite = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                sprite.setAttribute("r", "5");
                sprite.setAttribute("cx", getNodePosition(startNode).x);
                sprite.setAttribute("cy", getNodePosition(startNode).y);
                sprite.setAttribute("class", "person");
                sprite.setAttribute("fill", "#f0f");
                sprite.setAttribute("data-sprite-id", i); // Might be redundant, but should be useful for debugging
                peopleGroup.appendChild(sprite);

                sprites.push(new Sprite(i, startNode, neighbours[randIndx], getNodePosition(startNode), sprite));
            }
        }

        // click canvas currently only does one thing: place a tower
        // but this can be extended to add other actions
        canvas.onclick = function(event) {
            if (currentPendingAction === pendingActions.placeTower){
                var boundary = canvas.getBoundingClientRect();
                var x = event.clientX - boundary.left;
                var y = event.clientY - boundary.top;
                towers.push(new Tower(towers.length, new Position(x, y)));
                currentPendingAction = pendingActions.none;
                //after placing the tower, hide explanation
                document.getElementById("explanation").style.display = "none"; 
            };
            
        }

        svg.onclick = function(event) {
        		if (currentPendingAction === pendingActions.placeTower){
        				var towerWidth = 15;
        				var towerHeight = 15;
                var boundary = svg.getBoundingClientRect();
                // Calculate the centre of the tower
                var cx = event.clientX - boundary.left;
                var cy = event.clientY - boundary.top;
                var tower = document.createElementNS("http://www.w3.org/2000/svg", "image");
                tower.setAttribute("href", "tower.png");
                tower.setAttribute("x", cx - (towerWidth / 2.0)); // Top left corner of the tower
                tower.setAttribute("y", cy - (towerHeight / 2.0));
                tower.setAttribute("width", "15");
                tower.setAttribute("height", "15");
                var towerId = towers.length;
                tower.setAttribute("data-tower-id", towerId);
                towerGroup.appendChild(tower); // Add the tower to the map
                towers.push(new Tower(towerId, new Position(cx, cy))); // Store the new tower
                currentPendingAction = pendingActions.none;
                //after placing the tower, hide explanation
                document.getElementById("explanation").style.display = "none";

                var range = document.createElementNS("http://www.w3.org/2000/svg", "circle"); // A circle indicating the geographical range covered by the tower
                range.setAttribute("r", TOWER_RANGE);
                range.setAttribute("cx", cx);
                range.setAttribute("cy", cy);
                range.setAttribute("class", "range-indicator");
                rangeGroup.appendChild(range);
            };
        }
    }

    function gameLoop(timestamp) {
        if (!startTime) startTime = timestamp;
        var elapsed = timestamp - startTime;
        startTime = timestamp;

        // Call update on each sprite
        sprites.forEach(function (sprite) { sprite.update(elapsed); });

        render(); // Only needed for the canvas
        window.requestAnimationFrame(gameLoop);
    }

    function render() {
        context.clearRect(0,0,500,500);  // clear canvas
        context.drawImage(roadMap, 0,0); // redraw background

        drawSprites();
        drawTowers();
    }

    //Sprites

    function Sprite(id, prevNode, targetNode, pos, elem) {
    		this.id = id; // Might end up being redundant, but should be useful for debugging at least
        this.previousNode = prevNode;
        this.targetNode = targetNode;
        this.pos = pos;
				this.callStatus = spriteCallStatus.none;
				this.elem = elem; // The SVG element representing the sprite
    }
    Sprite.prototype.update = function (tFrame) {
			  // if sprite is idle, maybe place a call
				if (this.callStatus === spriteCallStatus.none) { placeCallMaybe(this); }
				// in call => stationary
				if (this.callStatus !== spriteCallStatus.none) { tFrame = 0; }
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

        // Update sprite position and colour
        this.elem.setAttribute("cx", this.pos.x);
        this.elem.setAttribute("cy", this.pos.y);
        this.elem.setAttribute("fill", this.callStatus);
				
				function placeCallMaybe(sprite) {
					var callProbabilityPerUpdate = 1/3000;
					if (randomIntBound(1/callProbabilityPerUpdate) < 1) {
						var callDuration = 5000;
						var ringRing = setInterval(function () {
							if (sprite.callStatus === spriteCallStatus.dialing) {
								sprite.callStatus = spriteCallStatus.dialingPulse;
							} else {
								sprite.callStatus = spriteCallStatus.dialing;
							}
						}, 50);
						setTimeout(function () {
							clearInterval(ringRing);
							if (handleCall(sprite)) {
								sprite.callStatus = spriteCallStatus.success;
							} else {
								sprite.callStatus = spriteCallStatus.failure;
							}
						}, callDuration/3);
						setTimeout(function () {
							// If callStatus is success then here we will want to decrement the load of the appropriate tower
							sprite.callStatus = spriteCallStatus.none;
						}, callDuration);
					}

					function handleCall(sprite) {
						for(let tower of towers) {
							if ((sprite.pos.distanceTo(tower.pos) < TOWER_RANGE) && (tower.load < MAX_LOAD)) { // If the sprite is in range of this tower
								// Increment tower.load here (once we implement a way of decrementing when the call finishes--presumably the sprite will have to make a note of which tower it's using)
								return true;
							}
						}
						return false;
					}
				}
				
    };

    // Only needed for the canvas
    function drawSprites(){
        var radius = 5;
        sprites.forEach(function (sprite) {
            context.beginPath();
            context.arc(sprite.pos.x, sprite.pos.y, radius, 0, Math.PI * 2, false);
						context.fillStyle = sprite.callStatus;
            context.fill();
        });
    }


    //Towers

    function Tower(id, pos) {
    		this.id = id; // May be useful for debugging
        this.pos = pos;
        this.load = 0; // Towers are initially handling 0 simultaneous calls
    };

    // These two functions are only needed for the canvas
    function drawTowers(){
        context.fillStyle = "cyan";
        towers.forEach(function(tower){
            drawSingleTower(tower);
        });
    }
    function drawSingleTower(tower) {
        var size = 15;
        var x = Math.max(tower.pos.x - size/2.0, 0);
        var y = Math.max(tower.pos.y - size/2.0, 0);
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
    document.addEventListener("DOMContentLoaded", function(){
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
				
				// Blinking effect on "Sprite dialing..." key
				setInterval(function () {
					var style = document.getElementById("dialing").style;
					if (style.color === "rgb(0, 255, 255)") {
						style.color = spriteCallStatus.dialingPulse;
					} else {
						style.color = spriteCallStatus.dialing;
					}
				}, 500);

        //initialise game
        initialise();

    });
    
})();
