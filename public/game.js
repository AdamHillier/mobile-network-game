"use strict";

(function () {
    // Game parameters
    var params = {
        numberOfSprites: 50,                // Initial sprite count
        nodeEpsilon: 1,                     // Radius in which a sprite has reached a node
        spriteSpeed: 0.005,                 // Speed of sprites
        spriteRadius: 3,
        callProbabilityPerUpdate: 1/3000,
        callDuration: 5000,                 // In milliseconds
        successCallCredit: 5,
        failureCallCredit: -2,
        monthLength: 10000                  // In milliseconds
    };

    function fillElemsOfClass(className, content) {
        var els = document.getElementsByClassName(className);
        for (var i = 0; i < els.length; i++) {
            els[i].innerHTML = content;
        }
    }

    // Monthly stats
    var succCalls;
    setSuccCalls(0);
    function setSuccCalls(v) {
        succCalls = v;
        fillElemsOfClass("succ-display", v);
        fillElemsOfClass("calls-display", v + failedCalls);
    }

    var failedCalls;
    setFailedCalls(0);
    function setFailedCalls(v) {
        failedCalls = v;
        fillElemsOfClass("fail-display", v);
        fillElemsOfClass("calls-display", succCalls + v);
    }

    // Game stats
    var totalSuccCalls;
    setTotalSuccCalls(0);
    function setTotalSuccCalls(v) {
        totalSuccCalls = v;
        fillElemsOfClass("total-succ-display", v);
    }
    var totalFailedCalls;
    setTotalFailedCalls(0);
    function setTotalFailedCalls(v) {
        totalFailedCalls = v;
        fillElemsOfClass("total-fail-display", v);
    }

    // 'Global' variables
    var svg;
    var peopleGroup;
    var towerGroup;
    var rangeGroup;
    var towerLoadGroup;

    var DEF_WIDTH = 800; // Default width (in px) of the map background image (not the same as the SVG element's width)
    var DEF_HEIGHT = 450;

    var adjMap;

    var sprites;
    var startTime;
    var lastMonthStart = 0;

    var towers;
    var TOWER_WIDTH = 12;
    var TOWER_HEIGHT = 12;

    /*  the following two parameters are a list corresponding to different types of tower
        e.g. TOWER_RANGE[1] corresponds to range of type 1 tower.
        the 0-indexed element is null as the type of towers start from 1.
        modify here if more types are introduced.
    */
    var TOWER_RANGE = [null, 100, 60];
    var MAX_LOAD = [null, 3, 5]; // Maximum number of calls each tower can handle simultaneously

    var TOWER_LOAD_VISUAL_RADIUS = 12;
    var TOWER_LOAD_VISUAL_CIRCUMFERENCE = 2 * Math.PI * TOWER_LOAD_VISUAL_RADIUS;

    var pendingActions = {
        none: 0,
        placeTower1: 1, //place tower of type 1
        placeTower2: 2  //place tower of type 2
        //more actions here if more types are introduced
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
            sprite.setAttribute("fill", spriteCallStatus.none);
            sprite.setAttribute("data-sprite-id", i); // Might be redundant, but should be useful for debugging
            peopleGroup.appendChild(sprite);

            var id = { month: getMonth(), number: i };

            sprites.push(new Sprite(id, startNode, neighbours[randIndx], getNodePosition(startNode), sprite));
        }
    }

    var gameTime; // Total amount of time the game has been playing (unpaused) for
    setGameTime(0);
    function setGameTime(v) {
        gameTime = v;
        fillElemsOfClass("time-display", v);
    }
    var timer; //the "time elapsed" chronometer
    //    var GAME_PAUSED = false;
    var GAME_UNPAUSED = false;
    var lastPaused; //the latest time when the game was paused by the game loop

    function showStart() {
        svg.style.filter = "blur(5px)";
        document.getElementById("start-screen").style.visibility = "visible";
    }
    
    function hideScreen() {
        svg.style.filter = "blur(0px)";
        var screens = document.getElementsByClassName("screen");
        for (var i = 0; i < screens.length; i++) {
            screens[i].style.visibility = "hidden";
        }
        startTimer();
    }

    function endGame() {
        stopTimer();
        svg.style.filter = "blur(5px)";
        var formFeedback = document.getElementById("form-feedback");
        formFeedback.style.display = 'none';
        var form = document.getElementById('submitForm');
        form.style.display = 'block';
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var httpRequest = new XMLHttpRequest();
            httpRequest.onload = handleResponse;
            httpRequest.open('POST', '/submit-score', true);
            httpRequest.setRequestHeader("Content-Type", "application/json");
            httpRequest.send(JSON.stringify({ email: document.getElementById('email-input').value, score: gameTime }));
            function handleResponse() {
                if (httpRequest.readyState === XMLHttpRequest.DONE) {
                    if (httpRequest.status === 200) {
                        form.style.display = 'none';
                        formFeedback.style.display = 'block';
                    } else {
                        alert('There was a problem with the request. Please make sure you enter a valid email address.');
                    }
                }
            }
        }, false);
        document.getElementById("end-screen").style.visibility = "visible";
    }

    function unpause() {
        GAME_UNPAUSED = true;
        window.requestAnimationFrame(gameLoop);
    }

    function showMonthly() {
        stopTimer();
        var cost = maintainTowers();
        svg.style.filter = "blur(5px)";

        document.getElementById("continue-btn").onclick = function() {
            hideScreen();
            unpause();
            setSuccCalls(0);
            setFailedCalls(0);
        };

        document.getElementById("monthly-screen").style.visibility = "visible";
    }
//

/////////////////////////////////////////////////////////////////////
    function initialise() {
        svg = document.getElementById('map');
        var svgWidth = svg.width.baseVal.value; // Width (in px) of SVG element (we would like to be able to set the width here, but there seem to be some difficulties doing that)
        var svgHeight = svg.height.baseVal.value;

        peopleGroup = document.getElementById('people-group');
        towerGroup = document.getElementById('tower-group');
        rangeGroup = document.getElementById('range-group');
        towerLoadGroup = document.getElementById('tower-load-group');

        sprites = new Array();
        towers = new Array();

        // Previously with JQuery, now inline in adj_graph.js
        adjMap = ADJ_GRAPH;
        initialiseSprites(params.numberOfSprites);

        // Get coordinates of the event
        // Used both in svg.onmousemove and svg.onclick
        function getcxcy(event) {
            var container = document.getElementById('container').getBoundingClientRect();
            var containerAspect = container.width/container.height;
            var mapAspect = DEF_WIDTH/DEF_HEIGHT;
            var leftOffset = containerAspect > mapAspect ? (container.width - container.height * mapAspect)/2 : 0;
            var topOffset = mapAspect > containerAspect ? (container.height - container.width / mapAspect)/2 : 0;
            var boundary = svg.getBoundingClientRect();
            var viewBox = svg.viewBox.baseVal; // An object with the 4 values specifying the viewBox attribute (named x, y, width, height)
            var cx = viewBox.x + Math.max(0, Math.min(DEF_WIDTH, viewBox.width*(event.clientX - leftOffset - boundary.left)/(boundary.width - 2 * leftOffset)));
            var cy = viewBox.y + Math.max(0, Math.min(DEF_HEIGHT, viewBox.height*(event.clientY - topOffset - boundary.top)/(boundary.height - 2 * topOffset)));
            return [cx, cy];
        }

        //helper function: detects if currentPendingAction is a placeTower action
        //modify here if more types are introduced
        function currentPendingActionIsPlaceTower() {
            return currentPendingAction === pendingActions.placeTower1 ||
                   currentPendingAction === pendingActions.placeTower2;
        }

        //helper function: if currentPendingAction is a placeTower action,
        //return the type of tower to place.
        //modify here if more types are introduced
        function getTowerTypeToPlace() {
            return currentPendingActionIsPlaceTower() ? currentPendingAction : -1;
        }

        //show indication of range before atually putting down the tower
        //range moves with mouse
        svg.onmousemove = function(event) {
            //check if player is going to place a tower
            if (currentPendingActionIsPlaceTower()) {

                //get selected type of tower
                var typeOfTower = getTowerTypeToPlace();
                console.assert(typeOfTower > 0);

                //get cursor location
                var cxcy = getcxcy(event);
                var cx = cxcy[0];
                var cy = cxcy[1];

                //create temporary range indication if it's not already created
                //note that this will be deleted when: (i) the tower is placed, OR (ii) the place-tower-action is cancelled
                if (document.getElementById("tempRange") == null) {
                    //temporary range not found, create one
                    var range = document.createElementNS("http://www.w3.org/2000/svg", "circle"); // A circle indicating the geographical range covered by the tower
                    range.setAttribute("r", TOWER_RANGE[typeOfTower]);
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
            if (currentPendingActionIsPlaceTower()) {

                //get selected type of tower
                var typeOfTower = getTowerTypeToPlace();
                console.assert(typeOfTower > 0);

                //placingTower action is successful, end this action.
                //Note: this must be done AFTER we get the type of tower to place, because that inspects the currentPendingAction, and cancelPlacingTower() sets it to none.
                cancelPlacingTower();

                if (getBalance() >= getTowerPrice()) {
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
                    new Tower(towerId, new Position(cx, cy), typeOfTower); // Store the new tower

                    //add range indication
                    var range = document.createElementNS("http://www.w3.org/2000/svg", "circle"); // A circle indicating the geographical range covered by the tower
                    range.setAttribute("r", TOWER_RANGE[typeOfTower]);
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
                } else {
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

        var buttons = document.getElementsByClassName("placeTower");
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].style.display = "inline";
        }

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

        if (!startTime) {
            startTime = timestamp;
            lastMonthStart = timestamp
        }
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

        if (getBalance() < 0) {
            endGame();
        } else if (hasMonthPassed(timestamp)) {
            newMonth();
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
    var black_hole = {x:0, y:0};
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

        this.pos.x += dx;
        this.pos.y += dy;

        if (this.pos.distanceTo(dest) < params.nodeEpsilon) {
            // Place the this at the node it just reached
            this.pos = dest;
            this.previousNode = this.targetNode;

            // Set this this to face a random neighbour
            // actually, no. Set this to face the neighbour with angle closest to the black hole with some reasonably high probability

/*
            var target_angle = Math.atan2(black_hole.y-this.pos.y, black_hole.x-this.pos.x);
            var neighbours = adjMap["osm_adjacency"][this.previousNode];
            var x = this.pos.x
            var y = this.pos.y
            var angle_offsets = neighbours.map(function(n) {
                                                 var neighbour = getNodePosition(n);
                                                 var angle = Math.atan2(neighbour.y-y, neighbour.x-x);
                                                 return Math.abs(angle-target_angle);
                                               });
            var lowest = 0;
            for (var i = 1; i < angle_offsets.length; i++) {
              if (angle_offsets[i] < angle_offsets[lowest]) lowest = i;
            }

            //   ...and avoid going backwards
            if (this.previousNode == neighbours[lowest]) {
                randIndx = (randIndx + 1) % neighbours.length;
            }
            this.targetNode = neighbours[lowest];
*/

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
                    if ((sprite.pos.distanceTo(tower.pos) < tower.range) && (tower.load < tower.capacity)) {
                        // // If the sprite is in range of this tower
                        // Increment tower.load here (once we implement a way of decrementing when the call finishes--presumably the sprite will have to make a note of which tower it's using)
                        tower.incrementLoad();

                        //update the tower load visual indication
                        tower.updateLoadIndication();

                        sprite.lastTower = tower;
                        incrementBalance(params.successCallCredit);
                        playSound(CALL_SUCCESS);
                        setTotalSuccCalls(totalSuccCalls + 1);
                        setSuccCalls(succCalls + 1);
                        return true;
                    }
                }
                incrementBalance(params.failureCallCredit);
                playSound(CALL_FAIL);
                setTotalFailedCalls(totalFailedCalls + 1);
                setFailedCalls(failedCalls + 1);
                return false;
            }
        }
    };

    //Towers

    function Tower(id, pos, type) {
        this.id = id;
        this.pos = pos;
        this.load = 0; // Towers are initially handling 0 simultaneous calls

        //towers have different types
        this.range = TOWER_RANGE[type];
        this.capacity = MAX_LOAD[type];
        towers.push(this);
        fillElemsOfClass("towers-display", towers.length);
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
        var offset = TOWER_LOAD_VISUAL_CIRCUMFERENCE * (1 - this.load / this.capacity);
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
    var balance;
    setBalance(200);
    function getBalance() {
        return balance;
    }
    function setBalance(newBalance) {
        balance = newBalance;
        fillElemsOfClass("balance-display", newBalance);
    }
    function incrementBalance(by) {
        setBalance(getBalance()+by);
    }
    var towerPrice;
    setTowerPrice(50);
    function getTowerPrice() {
        return towerPrice;
    }
    function setTowerPrice(newPrice) {
        towerPrice = newPrice;
        fillElemsOfClass("tower-price-display", newPrice);
    }
    function incrementTowerPrice(by) {
        setTowerPrice(getTowerPrice()+by);
    }
    function maintainTowers() {
        var cost = towers.length * 5;
        setBalance(getBalance() - cost);
        fillElemsOfClass("maintenance-display", cost);
        return cost;
    }

    // Timekeeping
    function startTimer() {
        timer = setInterval(function(){
            setGameTime(gameTime + 1);
        }, 1000);
    }
    function stopTimer() {
        clearInterval(timer);
    }
    function hasMonthPassed(timestamp) {
        return (timestamp - lastMonthStart > params.monthLength);
    }
    var currentMonth;
    setMonth(0);
    function getMonth() {
        return currentMonth;
    }
    function setMonth(newMonth) {
        currentMonth = newMonth;
        fillElemsOfClass("month-display", newMonth);
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
    document.addEventListener("DOMContentLoaded", function () {
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
        document.getElementById("start-btn").onclick = function () {
            var buttons = document.getElementsByClassName("placeTower");
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].style.display = "inline";
            }
            //starting and stopping the "time elapsed" chronometer is done by methods showing/hiding start'monthly feedback/endgame screens
            hideScreen();
            window.requestAnimationFrame(gameLoop);
        };

        cancelPlacingTowerButton = document.getElementById("cancelPlacingTower");
        cancelPlacingTowerButton.onclick = cancelPlacingTower;

        document.getElementById("placeTower1").onclick = function() {
            placeTower(1);
        };
        document.getElementById("placeTower2").onclick = function() {
            placeTower(2);
        };

        function placeTower(type) { //place a specific type of tower
            var explanationParagraph = '';
            switch (type) {
                case 1: //tower of type 1
                    currentPendingAction = pendingActions.placeTower1;
                    placeTowerButton = document.getElementById("placeTower1");
                    explanationParagraph = "Click on map to place a tower with large radius."
                    break;
                case 2:
                    currentPendingAction = pendingActions.placeTower2;
                    placeTowerButton = document.getElementById("placeTower2");
                    explanationParagraph = "Click on map to place a tower with high capacity."
            };

            var buttons = document.getElementsByClassName("placeTower");
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].style.display = "none";
            }
            cancelPlacingTowerButton.style.display = "inline";

            var explanation = document.getElementById("explanation");
            explanation.children[0].innerHTML = explanationParagraph;
            explanation.style.display = "inline";
        }

        //initialise game
        initialise();
    });

})();
