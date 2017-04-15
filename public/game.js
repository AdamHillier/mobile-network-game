"use strict";

(function () {
    // Game parameters
    var params = {
        numberOfSprites: 50,    // Initial sprite count
        nodeEpsilon: 1,       // Radius in which a sprite has reached a node
        spriteSpeed: 0.005,      // Speed of sprites
				spriteRadius: 3,
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
    var towerLoadGroup;

    var DEF_WIDTH = 450; // Default width (in px) of the map background image (not the same as the SVG element's width)
    var DEF_HEIGHT = 450;
    var mapScaling = 1.0; // Map magnification--might we want to allow this to vary and enable zooming?

    var adjMap;

    var sprites;
    var startTime;
    var lastMonthStart = 0;

    var towers;
    var TOWER_WIDTH = 12;
    var TOWER_HEIGHT = 12;
    var TOWER_RANGE = 80; //originally 50, changed to 250 to test and illustrate tower load indication
    var MAX_LOAD = 3; // Maximum number of calls each tower can handle simultaneously

    var TOWER_LOAD_VISUAL_RADIUS = 12;
    var TOWER_LOAD_VISUAL_CIRCUMFERENCE = 2 * Math.PI * TOWER_LOAD_VISUAL_RADIUS;

    var pendingActions = {
        none: 0,
        placeTower: 1
    };
    var currentPendingAction = pendingActions.none;
		
    var spriteCallStatus = {
        none: "#0167c4",
        dialing: "#ff7795",
        dialingPulse: "#783b77",
        success: "#0f0",
        failure: "#f00"
    };

    var placeTowerButton;
    var cancelPlacingTowerButton;
    
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
//
    var toghrulsVariable;
    var timer;
    var GAME_PAUSED = false;
    var GAME_UNPAUSED = false;
    var lastPaused; //the latest time when the game was paused by the game loop 
    function showStart() {
        toghrulsVariable = document.getElementById("map");
        toghrulsVariable.style.filter = "blur(5px)";
        var startScreenSquare = document.getElementById("commScreen");
        startScreenSquare.style.visibility = "visible";
        document.getElementById("message").innerHTML = "Welcome to &quot;Mobile Network Game&quot;. The objective of the game is to have positive balance for\
as long as possible. Press the button to start the game.";
    }
    function hideScreen() {
        toghrulsVariable = document.getElementById("map");
        toghrulsVariable.style.filter = "blur(0px)";
        var startScreenSquare = document.getElementById("commScreen");
        startScreenSquare.style.visibility = "hidden";
    }
        
    function endGame() {
        toghrulsVariable = document.getElementById("map");
        toghrulsVariable.style.filter = "blur(5px)";
        var timeSpan = document.getElementById("time");
        var score = parseInt(timeSpan.innerHTML);
        clearInterval(timer);
        var endScreenSquare = document.getElementById("commScreen");
        endScreenSquare.style.visibility = "visible";
        document.getElementById("message").innerHTML = "Game over. Your network was functional for " + score.toString() + " seconds.";
        document.getElementById("commButton").style.visibility = "hidden";
    }

    function pause() {
        GAME_PAUSED = true;
    }

    function unpause() {
        GAME_PAUSED = false;
        GAME_UNPAUSED = true;
        window.requestAnimationFrame(gameLoop);
    }

    function showMonthly() {
        toghrulsVariable = document.getElementById("map");
        toghrulsVariable.style.filter = "blur(5px)";
        var startScreenSquare = document.getElementById("commScreen");
        startScreenSquare.style.visibility = "visible"; 
        document.getElementById("message").innerHTML = "A month has passed";
        var startGameButton = document.getElementById("commButton");
        startGameButton.textContent = "continue game";
        startGameButton.onclick = function() {
            hideScreen();
            unpause();
        };
    }      
  

//

/////////////////////////////////////////////////////////////////////
    function initialise() {
        svg = document.getElementById('map');
        var svgWidth = svg.width.baseVal.value; // Width (in px) of SVG element (we would like to be able to set the width here, but there seem to be some difficulties doing that)
        var svgHeight = svg.height.baseVal.value;
        mapScaling = Math.min(svgWidth / DEF_WIDTH, svgHeight / DEF_HEIGHT); // Magnify the map as much as possible without cropping it
        svg.setAttribute("viewBox", "0 0 " + (svgWidth / mapScaling) + " " + (svgHeight / mapScaling)); // Zoom in on the top left corner
        svg.style.backgroundSize = (mapScaling * DEF_WIDTH) + "px " + (mapScaling * DEF_HEIGHT) + "px"; // background-size:auto auto (the default) is DEF_WIDTH DEF_HEIGHT

        peopleGroup = document.getElementById('people-group');
        towerGroup = document.getElementById('tower-group');
        rangeGroup = document.getElementById('range-group');
        towerLoadGroup = document.getElementById('tower-load-group');

        sprites = new Array();
        towers = new Array();

        // Previously with JQuery, now inline in adj_graph.js
				adjMap = ADJ_GRAPH;
				initialiseSprites(params.numberOfSprites);

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
                cancelPlacingTower();

                if (getBalance() >= 50) { 
                    //get cursor location
                    //extracted out the function getcxcy because it's also used in svg.onmousemove
                    var cxcy = getcxcy(event);
                    var cx = cxcy[0];
                    var cy = cxcy[1];

                    //add tower
                    var tower = document.createElementNS("http://www.w3.org/2000/svg", "image");
                    tower.setAttribute("href", "tower.svg");
                    tower.setAttribute("x", cx - (TOWER_WIDTH / 2.0)); // Top left corner of the tower (TOWER_WIDTH is in user units)
                    tower.setAttribute("y", cy - (TOWER_HEIGHT / 2.0));
                    tower.setAttribute("width", TOWER_WIDTH);
                    tower.setAttribute("height", TOWER_HEIGHT);
                    var towerId = towers.length;
                    tower.setAttribute("data-tower-id", towerId);
                    towerGroup.appendChild(tower); // Add the tower to the map
                    towers.push(new Tower(towerId, new Position(cx, cy))); // Store the new tower
                    
                    //add range indication
                    var range = document.createElementNS("http://www.w3.org/2000/svg", "circle"); // A circle indicating the geographical range covered by the tower
                    range.setAttribute("r", TOWER_RANGE);
                    range.setAttribute("cx", cx);
                    range.setAttribute("cy", cy);
                    range.setAttribute("class", "range-indicator");
                    rangeGroup.appendChild(range);

                    //add tower-load indication
                    //the ring of visualisation has 2 layers: a "backgroud" which is a full ring, and a "cover" which partially covers the background ring with another color.
                    var loadRingBackground = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    loadRingBackground.setAttribute("r", TOWER_LOAD_VISUAL_RADIUS);
                    loadRingBackground.setAttribute("cx", cx);
                    loadRingBackground.setAttribute("cy", cy);
                    loadRingBackground.setAttribute("class", "load-ring-background");
                    towerLoadGroup.appendChild(loadRingBackground);

                    var loadRingCover = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    loadRingCover.setAttribute("r", TOWER_LOAD_VISUAL_RADIUS);
                    loadRingCover.setAttribute("cx", cx);
                    loadRingCover.setAttribute("cy", cy);
                    loadRingCover.setAttribute("class", "load-ring-cover");
                    loadRingCover.setAttribute("id", "load-ring-cover" + towerId);
                    //the "cover" ring is not a full ring, and is initialised to have zero length
                    //after setting stroke-dasharray to be the circumference, we have the nice property that length_of_arc_shown = circle_circumference - stroke-dashoffset
                    loadRingCover.setAttribute("stroke-dasharray", TOWER_LOAD_VISUAL_CIRCUMFERENCE); 
                    loadRingCover.setAttribute("stroke-dashoffset", TOWER_LOAD_VISUAL_CIRCUMFERENCE);
                    loadRingCover.setAttribute("transform", "rotate(270 " + cx + " " + cy + ")");
                    towerLoadGroup.appendChild(loadRingCover);
                    
                                    
                                    incrementBalance(-getTowerPrice());

                }
                else {
                    playSound(BAD_ACTION);
                    //show message that there's not enough balance
                    var balanceNotEnoughDiv = document.getElementById("balanceNotEnough");
                    balanceNotEnoughDiv.style.display = "inline";

                    //hide balanceNotEnough message after 2 seconds
                    setTimeout(function(){ 
                        balanceNotEnoughDiv.style.display = "none";
                    }, 2000)

                }

            };
        };

        showStart();
    }

    function cancelPlacingTower() {
        removeTempRange();
        currentPendingAction = pendingActions.none;
        cancelPlacingTowerButton.style.display = "none";
        placeTowerButton.style.display = "inline";
        //hide #explanation paragraph.
        document.getElementById("explanation").style.display = "none";
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
        var elapsed;

        if (!GAME_UNPAUSED) {
        elapsed = timestamp - startTime;
        } else {
            elapsed = 0;
            GAME_UNPAUSED = false;
            lastMonthStart = timestamp;
        }
        startTime = timestamp;

        if (elapsed > 100) {
            elapsed = 16;
        }; // hack!! elapsed is very long when tab comes from background in Chrome

        sprites.forEach(function(sprite) {
            sprite.update(elapsed);
        });

/*        if (timestamp - lastMonthStart > 10000) { //careful with the pause - a long pause might take several months
            console.log("new month");
            lastMonthStart = timestamp;
            //newMonth();
        }; */
        if (getBalance() < 0) {
            endGame();
        } else if (hasMonthPassed(timestamp)) {
            showMonthly(); 
        } else {
            window.requestAnimationFrame(gameLoop);
        }
    };
		
		function newMonth () {
			incrementMonth(1);
			initialiseSprites(getMonth());
			incrementTowerPrice(5);
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

                                //update the tower load visual indication
                                sprite.lastTower.updateLoadIndication();

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

                                //update the tower load visual indication
                                tower.updateLoadIndication();

								sprite.lastTower = tower;
								incrementBalance(params.successCallCredit);
                playSound(CALL_SUCCESS);
								return true;
							}
						}
						incrementBalance(params.failureCallCredit);
            playSound(CALL_FAIL);
						return false;
					}
				}
				
    };


    //Towers

    function Tower(id, pos) {
		this.id = id; 
        this.pos = pos;
        this.load = 0; // Towers are initially handling 0 simultaneous calls
    };
		
		Tower.prototype.incrementLoad = function() {
			this.load++;
		};
		Tower.prototype.decrementLoad = function() {
			this.load--;
		};

    //Tower load indication
    Tower.prototype.updateLoadIndication = function() {
        var loadVisualCover = document.getElementById("load-ring-cover" + this.id);
        var offset = TOWER_LOAD_VISUAL_CIRCUMFERENCE * (1 - this.load / MAX_LOAD);
        loadVisualCover.setAttribute("stroke-dashoffset", offset)
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
		function hasMonthPassed(timestamp) {
			return (timestamp - lastMonthStart > 20000);
		}
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
        var startGameButton = document.getElementById("commButton");
        startGameButton.onclick = function() {
            document.getElementById("placeTower").style.display = "inline"; //show button for placing tower
						timer = setInterval(function(){
							var timeSpan = document.getElementById("time");
							timeSpan.innerHTML = parseInt(timeSpan.innerHTML)+1;
						}, 1000);
            hideScreen();
            window.requestAnimationFrame(gameLoop);
        };


        placeTowerButton = document.getElementById("placeTower");
        cancelPlacingTowerButton = document.getElementById("cancelPlacingTower");

        placeTowerButton.onclick = function() {
            currentPendingAction = pendingActions.placeTower;
            placeTowerButton.style.display = "none";
            cancelPlacingTowerButton.style.display = "inline";
            document.getElementById("explanation").style.display = "inline"; //show explanation
        };

        cancelPlacingTowerButton.onclick = cancelPlacingTower;
				
        // Blinking effect on "Sprite dialing..." key
        setInterval(function() {
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
