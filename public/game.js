"use strict";

(function () {
    // Game parameters
    var params = {
        numberOfSprites: 20,    // Initial sprite count
        nodeEpsilon: 1,       // Radius in which a sprite has reached a node
        spriteSpeed: 0.005,      // Speed of sprites
				spriteRadius: 5,
				callProbabilityPerUpdate: 1/3000,
				callDuration: 5000, // in milliseconds
				successCallCredit: 5,
				failureCallCredit: -2
    };

    // 'Global' variables
    var svg;
    var peopleGroup;
    var towerGroup;
    var rangeGroup;

    var DEF_WIDTH = 450; // Default width (in px) of the map background image (not the same as the SVG element's width)
    var DEF_HEIGHT = 450;
    var mapScaling = 1.0; // Map magnification--might we want to allow this to vary and enable zooming?

    var canvas;
    var context;
    var roadMap;
    var adjMap;

    var sprites;
    var startTime;
		var lastMonthStart = 0;

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
    
		function initialiseSprites (n) {
			var numberOfNodes = adjMap["osm_nodes"].length;
			for (var i = 0; i < n; i++) {
					var startNode = randomIntBound(numberOfNodes);
					var neighbours = adjMap["osm_adjacency"][startNode];
					var randIndx = randomIntBound(neighbours.length);

					var sprite = document.createElementNS("http://www.w3.org/2000/svg", "circle");
					sprite.setAttribute("r", ""+params.spriteRadius);
					sprite.setAttribute("cx", getNodePosition(startNode).x);
					sprite.setAttribute("cy", getNodePosition(startNode).y);
					sprite.setAttribute("class", "person");
					sprite.setAttribute("fill", "#f0f");
					sprite.setAttribute("data-sprite-id", i); // Might be redundant, but should be useful for debugging
					peopleGroup.appendChild(sprite);

					var id = { month: getMonth(), number: i };

					sprites.push(new Sprite(id, startNode, neighbours[randIndx], getNodePosition(startNode), sprite));
			}
		}

    function initialise() {
        canvas = document.getElementById('myCanvas');

        svg = document.getElementById('map');
        var svgWidth = svg.width.baseVal.value; // Width (in px) of SVG element (we would like to be able to set the width here, but there seem to be some difficulties doing that)
        var svgHeight = svg.height.baseVal.value;
        svg.setAttribute("viewBox", "0 0 " + (svgWidth / mapScaling) + " " + (svgHeight / mapScaling)); // Zoom in on the top left corner
        svg.style.backgroundSize = (mapScaling * DEF_WIDTH) + "px " + (mapScaling * DEF_HEIGHT) + "px"; // background-size:auto auto (the default) is DEF_WIDTH DEF_HEIGHT

        peopleGroup = document.getElementById('people-group');
        towerGroup = document.getElementById('tower-group');
        rangeGroup = document.getElementById('range-group');

        context = canvas.getContext('2d');
        roadMap = new Image();
        sprites = new Array();
        towers = new Array();

        // Previously with JQuery, now inline in adj_graph.js
				adjMap = ADJ_GRAPH;
				initialiseSprites(params.numberOfSprites);

        // Initialise roadmap
        roadMap.src = "static_map.svg";
        roadMap.onload = function() {
            context.drawImage(roadMap, 0,0);
        };

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
            
        };

        //get coordinates of the event
        //used both in svg.onmousemove and svg.onclick
        function getcxcy(event) {
            var boundary = svg.getBoundingClientRect();
            var viewBox = svg.viewBox.baseVal; // An object with the 4 values specifying the viewBox attribute (named x, y, width, height)
            // Calculate the centre of the tower
            var cx = viewBox.x + ((event.clientX - boundary.left) / mapScaling); // Convert screen units to user units
            var cy = viewBox.y + ((event.clientY - boundary.top) / mapScaling);

            return [cx, cy];
        }

        //show indication of range before atually putting down the tower
        //range moves with mouse
        svg.onmousemove = function(event) {
            //check if player is going to place a tower
            if (currentPendingAction === pendingActions.placeTower) {
                //get cursor location
                var cxcy = getcxcy(event);
                var cx = cxcy[0];
                var cy = cxcy[1];

                //create temporary range indication if it's not already created
                //note that this will be deleted when: (i) the tower is placed, OR (ii) the place-tower-action is cancelled
                if (document.getElementById("tempRange") == null) {
                    //temporary range not found, create one
                    var range = document.createElementNS("http://www.w3.org/2000/svg", "circle"); // A circle indicating the geographical range covered by the tower
                    range.setAttribute("r", TOWER_RANGE);
                    range.setAttribute("class", "range-indicator");
                    range.setAttribute("cx", cx);
                    range.setAttribute("cy", cy);
                    rangeGroup.appendChild(range);
                    range.setAttribute("id", "tempRange");
                }
                else {
                    var range = document.getElementById("tempRange");
                    //update position 
                    range.setAttribute("cx", cx);
                    range.setAttribute("cy", cy);
                }                
            }

        };


        svg.onclick = function(event) {
    		if (currentPendingAction === pendingActions.placeTower) {
                //remove temporary range indication and change currentPendingAction regardless of balance
                removeTempRange();
                currentPendingAction = pendingActions.none;

                if (getBalance() >= 50) { 
                    var towerWidth = 15;
                    var towerHeight = 15;

                    //get cursor location
                    //extracted out the function getcxcy because it's also used in svg.onmousemove
                    var cxcy = getcxcy(event);
                    var cx = cxcy[0];
                    var cy = cxcy[1];

                    var tower = document.createElementNS("http://www.w3.org/2000/svg", "image");
                    tower.setAttribute("href", "tower.svg");
                    tower.setAttribute("x", cx - (towerWidth / 2.0)); // Top left corner of the tower (towerWidth is in user units)
                    tower.setAttribute("y", cy - (towerHeight / 2.0));
                    tower.setAttribute("width", towerWidth);
                    tower.setAttribute("height", towerHeight);
                    var towerId = towers.length;
                    tower.setAttribute("data-tower-id", towerId);
                    towerGroup.appendChild(tower); // Add the tower to the map
                    towers.push(new Tower(towerId, new Position(cx, cy))); // Store the new tower
                    
                    //after placing the tower, hide explanation
                    document.getElementById("explanation").style.display = "none";

                    var range = document.createElementNS("http://www.w3.org/2000/svg", "circle"); // A circle indicating the geographical range covered by the tower
                    range.setAttribute("r", TOWER_RANGE);
                    range.setAttribute("cx", cx);
                    range.setAttribute("cy", cy);
                    range.setAttribute("class", "range-indicator");
                    rangeGroup.appendChild(range);
                                    
                                    incrementBalance(-getTowerPrice());

                }

            };
        };
    }

    //remove temporary range
    //used both inside the function initialise(), and by the #cancelPlacingTower button
    function removeTempRange(){
        var parent = document.getElementById('range-group');
        var child = document.getElementById('tempRange');
        if (parent != null && child != null) {
            parent.removeChild(child);
        }
    };

    function gameLoop(timestamp) {
				if (!startTime) startTime = timestamp;
				var elapsed = timestamp - startTime;
				startTime = timestamp;
				
				if (elapsed > 100) { elapsed = 16; }; // hack!! elapsed is very long when tab comes from background in Chrome
				
				if (timestamp-lastMonthStart > 10000) {
					console.log("new month");
					lastMonthStart = timestamp;
					//newMonth();
				};
				
				// Call update on each sprite
				sprites.forEach(function (sprite) { sprite.update(elapsed); } );

				render(); // Only needed for the canvas
        window.requestAnimationFrame(gameLoop);
    }
		
		function newMonth () {
			incrementMonth(1);
			initialiseSprites(getMonth());
			incrementTowerPrice(5);
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
				this.lastTower = null;
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
					if (randomIntBound(1/params.callProbabilityPerUpdate) < 1) {
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
						}, params.callDuration/3);
						setTimeout(function () {
							// If callStatus is success then here we will want to decrement the load of the appropriate tower
							if (sprite.lastTower !== null) {
								sprite.lastTower.decrementLoad();
								sprite.lastTower = null;
							}
							sprite.callStatus = spriteCallStatus.none;
						}, params.callDuration);
					}

					function handleCall(sprite) {
						for(let tower of towers) {
							if ((sprite.pos.distanceTo(tower.pos) < TOWER_RANGE) && (tower.load < MAX_LOAD)) {
								// // If the sprite is in range of this tower
								// Increment tower.load here (once we implement a way of decrementing when the call finishes--presumably the sprite will have to make a note of which tower it's using)
								tower.incrementLoad();
								sprite.lastTower = tower;
								console.log(tower);
								incrementBalance(params.successCallCredit);
								return true;
							}
						}
						incrementBalance(params.failureCallCredit);
						return false;
					}
				}
				
    };

    // Only needed for the canvas
    function drawSprites(){
        var radius = params.spriteRadius;
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
		
		Tower.prototype.incrementLoad = function() {
			this.load++;
		};
		Tower.prototype.decrementLoad = function() {
			this.load--;
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
    };

		// Budgetry
		function getBalance() {
			return parseInt(document.getElementById("balance").innerHTML);
		}
		function setBalance(newBalance) {
			document.getElementById("balance").innerHTML = ""+newBalance;
		}
		function incrementBalance(by) {
			setBalance(getBalance()+by);
			if (getBalance() < 0) { document.getElementById("gameOver").style.display = "inline"; }
		}
		function getTowerPrice() {
			return parseInt(document.getElementById("towerPrice").innerHTML);
		}
		function setTowerPrice(newPrice) {
			document.getElementById("towerPrice").innerHTML = ""+newPrice;
		}
		function incrementTowerPrice(by) {
			setTowerPrice(getTowerPrice()+by);
		}
		
		// Timekeeping
		function getMonth() {
			return parseInt(document.getElementById("month").innerHTML);
		}
		function setMonth(newMonth) {
			document.getElementById("month").innerHTML = ""+newMonth;
		}
		function incrementMonth(by) {
			setMonth(getMonth()+by);
		}

    // Helper methods
    function getNodePosition(n) {
        return new Position(adjMap["osm_nodes"][n][0], adjMap["osm_nodes"][n][1]);
    }
    function randomIntBound(n) {
        return Math.floor(Math.random()*n);
    }


    //make sure all DOMs are loaded before operating on them
    document.addEventListener("DOMContentLoaded", function(){		
				// window visibility
				var oldParams = JSON.parse(JSON.stringify(params)); // object clone
				window.onfocus = function() {
					console.log("focus");
					params = JSON.parse(JSON.stringify(oldParams));
				};
				window.onblur = function() {
					console.log("blur");
					params.spriteSpeed = 0;
					params.callProbabilityPerUpdate = 0;
				};
			
        //bind button actions
        var startGameButton = document.getElementById("startGame");
        startGameButton.onclick = function() {
            document.getElementById("placeTower").style.display = "inline"; //show button for placing tower
						setInterval(function(){
							var timeSpan = document.getElementById("time");
							timeSpan.innerHTML = parseInt(timeSpan.innerHTML)+1;
						}, 1000);
            window.requestAnimationFrame(gameLoop);
        };

        var placeTowerButton = document.getElementById("placeTower");
        placeTowerButton.onclick = function() {
            currentPendingAction = pendingActions.placeTower;
            document.getElementById("explanation").style.display = "inline"; //show explanation
        };

        var cancelPlacingTowerButton = document.getElementById("cancelPlacingTower");
        cancelPlacingTowerButton.onclick = function(){
            removeTempRange();
            currentPendingAction = pendingActions.none;
            //hide #explanation paragraph.
            document.getElementById("explanation").style.display = "none";
        }
				
				
				
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
