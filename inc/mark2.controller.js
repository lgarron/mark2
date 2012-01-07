/*
 * Mark 2 Javascript Code
 *
 * Lucas Garron, November/December 2011
 *
 */


mark2.controller = (function() {
		
	/*
	 * Configuration Section
	 */

	var version = "January 03, 2012";

	web_worker_file = "inc/mark2.workers.js";

	var events;
	var workerGroups;

	// alg.garron.us puzzle ID mapping.
	eventIDToAlgPuzzleID = {
		"333": "3x3x3",
		"444": "4x4x4",
		"555": "5x5x5",
		"222": "2x2x2",
		"333bf": "3x3x3",
		"333oh": "3x3x3",
		"333fm": "3x3x3",
		"333ft": "3x3x3",
		"333mbf": "3x3x3",
		"666": "6x6x6",
		"777": "7x7x7",
		"444bf": "4x4x4",
		"555bf": "5x5x5"
	}



	/*
	 * Mark 2 Initialization
	 */

	var initialize = function(eventsIn, workerGroupsIn) {

		events = eventsIn;
		workerGroups = workerGroupsIn;

		initializeRandomSource();
		initializeWorkers();
	};



	/*
	 * Scramble Sets
	 */

	var doneCreatingRounds = false;
	var totalNumScrambles;
	var scramblesStillAwaiting = [];

    var getScrambleSetsJSON = function() {

    	var rounds = mark2.ui.getRoundsJSON();
    	scrambleSets = [];

		for (var i = 0; i < rounds.length; i++) {

			var eventID = rounds[i][0];
			var roundName = rounds[i][1];
			var numGroups = rounds[i][2];
			var numSolves = rounds[i][3];

			for (var j = 1; j <= numGroups; j++) {
				var groupString = ((numGroups === 1) ? ("") : ("<br>Group " + intToLetters(j)));
				scrambleSets.push([eventID, roundName + groupString, numSolves]); // TODO Find a better way to handle multi-line round names.
			}
		}

		return scrambleSets;
    }

	var markScrambleStarting = function(scrambleID, eventID, num) {
					
		var scrambleTD = document.getElementById(scrambleID + "_scramble");
		scrambleTD.innerHTML = "Generating scramble #" + num + "...";
		mark2.dom.removeClass(scrambleTD, "loading_scrambler");
		mark2.dom.addClass(scrambleTD, "loading_scramble");
	}

	var markScramblerInitializing = function(scrambleID, eventID, num) {
					
		var scrambleTD = document.getElementById(scrambleID + "_scramble");
		scrambleTD.innerHTML = "Initializing scrambler...";
		mark2.dom.addClass(scrambleTD, "loading_scrambler");
	}

	var algGarronUSLink = function(eventID, scramble) {

		var puzzleID = eventIDToAlgPuzzleID[eventID];

		if (typeof puzzleID === "undefined") {
			return scramble;
		}

		return "<a href=\"http://alg.garron.us/?ini=" + encodeURIComponent(scramble) + "&cube=" + puzzleID + "&name=" + encodeURIComponent(events[eventID].name + " Scramble") + "&notation=WCA\" target=\"_blank\" class=\"scramble_link\">" + scramble + "</a>";
	}

	var scrambleLink = function(eventID, scramble) {
		// Specific to alg.garron.us right now.
		return algGarronUSLink(eventID, scramble);
	}

	var insertScramble = function(scrambleID, eventID, num, scramble, state) {

		if (webWorkersRunning) {

			var index = scramblesStillAwaiting.indexOf(scrambleID);
			scramblesStillAwaiting.splice(index, 1)

			var stillRemainingString = " " + scramblesStillAwaiting.length + " scramble" + (scramblesStillAwaiting.length === 1 ? "" : "s") + " still remaining overall."
			if (!doneCreatingRounds) {
				stillRemainingString = " At least" + stillRemainingString;
			}

			addUpdateSpecific("Generated " + eventID + " scramble #" + num + " for some round." + stillRemainingString);

			if (scramblesStillAwaiting.length === 0 && doneCreatingRounds) {
				addUpdateGeneral("\n\nDone generating all scrambles for all rounds.\n");
			}
		}
					
		var scrambleTD = document.getElementById(scrambleID + "_scramble");
		mark2.dom.removeClass(scrambleTD, "loading_scramble");
		var scrambleHTML = scrambleLink(eventID, scramble);
		scrambleTD.innerHTML = scrambleHTML;

		var drawingTD = document.getElementById(scrambleID + "_drawing");
		drawingTD.innerHTML = "";
		drawingTD.width = events[eventID].drawing_dimensions.w; // Sadly, this is more robust than setProperty(...).
		var drawingWidth = events[eventID].drawing_dimensions.w;
		var drawingHeight = events[eventID].drawing_dimensions.h;
		scramblers[eventID].drawScramble(drawingTD, state, drawingWidth, drawingHeight);
	}

	var generateScrambleSet = function(continuation, competitionName, tBody, eventID, scrambler, num, numTotal, options) {
		
		var scrambleTR = mark2.dom.createNewElement(tBody, "tr");

		var scramblesInThisRow = Math.min(events[eventID].scrambles_per_row, numTotal - num + 1);

		for (var i = 0; i < scramblesInThisRow; i++) {

			var scrambleID = mark2.dom.nextAutoID();
		
			mark2.dom.createNewElement(scrambleTR, "td", "number number_" + eventID, scrambleID + "_number", "" + (num + i) + ".");
			mark2.dom.createNewElement(scrambleTR, "td", "scramble scramble_" + eventID, scrambleID + "_scramble",  "[Space for Scramble #" + (num + i) + "]");
			var drawingTD = mark2.dom.createNewElement(scrambleTR, "td", "drawing drawing_" + eventID, scrambleID + "_drawing", "[Space for Drawing]");
			drawingTD.width = events[eventID].drawing_dimensions.w;
			drawingTD.height = events[eventID].drawing_dimensions.h;

			if (webWorkersRunning) {

				scramblesStillAwaiting.push(scrambleID);

				events[eventID].worker.postMessage({
					action: "get_random_scramble",
					event_id: eventID,
					return_data: {
						scramble_id: scrambleID,
						num: (num + i)
					}
				});
			}
			else {
				var scramble = scrambler.getRandomScramble();
				insertScramble(scrambleID, eventID, num, scramble.scramble_string, scramble.state);
			}
		}

		var call;
		if (num < numTotal) {
			call = generateScrambleSet.bind(null, continuation, competitionName, tBody, eventID, scrambler, num + scramblesInThisRow, numTotal, options);
		}
		else {
			hideUpdatesSpecific();
			call = continuation;
		}
		setTimeout(call, 0);
	}

	var addScrambleSet = function(continuation, competitionName, eventID, roundName, numScrambles) {

		var scrambleSets = document.getElementById("scramble_sets");

		if (!events[eventID]) {
			mark2.dom.createNewElement(scrambleSets, "div", "unupported", null, "Sorry, but \"" + eventID + "\" scrambles are not currently supported.");
			return;
		}

		var scrambler = scramblers[eventID];

		// Create a new scramble set.

		var newScramblesTBodyID = mark2.dom.nextAutoID();

		// This used to be a set of dynamic createNewElement(...) calls
		var newScrambleSetString = '\
			<table class="info_table">\
				<thead><tr>\
					<td class="puzzle_name">' + events[eventID].name + '</td>\
					<td class="competition_name">' + competitionName + '</td>\
					<td class="round_name">' + roundName + '</td>\
				</tr></thead>\
			</table>\
			<table class="scramble_table">\
				<tbody id="' + newScramblesTBodyID + '">\
				</tbody>\
			</table>\
			<table class="footer_table">\
				<thead><tr>\
					<td>' + '<u>Scrambles generated at:</u><br>' + (new Date().toString()) + '</td>\
					<td>' + '<div style="text-align: right;"><u>' + events[eventID].name + ' Scrambler Version</u><br>' + scrambler.version + '</div>' + '</td>\
					<td>' + '<img src="inc/wca_logo.svg" class="wca_logo">' + '</td>\
				</tr></thead>\
			</table>\
			';

		
		var newScrambleSet = mark2.dom.createNewElement(scrambleSets, "div", "scramble_set", null, newScrambleSetString);
		mark2.dom.hideElement(newScrambleSet);

		var newScramblesTBody = document.getElementById(newScramblesTBodyID);
		
		// Generate those scrambles!
		
		addUpdateGeneral("Generating " + numScrambles + " scramble" + ((numScrambles === 1) ? "" : "s") + " for " + events[eventID].name + ": " + roundName + "");
		resetUpdatesSpecific("Details for " + events[eventID].name + ": " + roundName);
		
		var delayedDOMUpdateContinuation = function() {
			mark2.dom.showElement(newScrambleSet);
			continuation();	
		};

		var nextContinuation = generateScrambleSet.bind(null, delayedDOMUpdateContinuation, competitionName, newScramblesTBody, eventID, scrambler, 1, numScrambles, {});
		var call;
		if (!webWorkersRunning && !events[eventID].initialized) {
		    addUpdateSpecific("Initializing " + events[eventID].name + " scrambler (only needs to be done once).");

		    var statusCallback = function(str) {
		    	addUpdateSpecific(str);

		    }

			call = scrambler.initialize.bind(null, nextContinuation, randomSource, statusCallback);
			events[eventID].initialized = true;
		}
		else {

			if (webWorkersRunning) {
			}
			else if (events[eventID].initialized) {
		    	addUpdateSpecific("" + events[eventID].name + " scrambler already initialized.");
			}
			call = nextContinuation;
		}
		setTimeout(call, 0);
	};

	var generateScrambleSets = function(callback, competitionName, rounds) {

		var nextContinuation;
		if (rounds.length > 1) {
			nextContinuation = generateScrambleSets.bind(null, callback, competitionName, rounds.slice(1));
		}
		else {
			nextContinuation = function(){

				if (webWorkersRunning) {
					addUpdateGeneral("Done creating all rounds. " + scramblesStillAwaiting.length + " scrambles still need to be filled in.");
					doneCreatingRounds = true;
				}
				else {
					addUpdateGeneral("Done creating all rounds.");
				}

				setTimeout(callback, 0);
			};
		}

		addScrambleSet(nextContinuation, competitionName, rounds[0][0], rounds[0][1], rounds[0][2]);
	}

    // Converts 1, 2, ... to A, B, ..., Z, AA, AB, ..., ZZ, AAA, AAB, ...
    // A bit complicated right now, but should work fine.
	function intToLetters(int) {

      var numDigits;
      var maxForDigits = 1;
      var numWithThisManyDigits = 1;
    
      for (numDigits = 0; maxForDigits <= int; numDigits++) {
        numWithThisManyDigits *= 26;
        maxForDigits += numWithThisManyDigits;
      }
    
      var adjustedInt = int - (maxForDigits - numWithThisManyDigits);
    
      var out = "";
      for (var i = 0; i < numDigits; i++) {
        out = String.fromCharCode(65 + (adjustedInt % 26)) + out;
        adjustedInt = Math.floor(adjustedInt / 26);
      }
      return out;
    };

    var getCompetitionNameAndSetPageTitle = function() {
    	var competitionName = document.getElementById('competitionName').value;

		if (competitionName === "") {
			document.title = "Scrambles from Mark 2";
			competitionName = "Mark 2";
		}
		else {
			document.title = "Scrambles for " + competitionName;
		}

		return competitionName;
    }

	var go = function() {

		resetUpdatesGeneral();
		hideInterface();

		var competitionName = getCompetitionNameAndSetPageTitle();

		var scrambleSets = getScrambleSetsJSON();

		if (scrambleSets.length === 0) {
			addUpdateGeneral("Nothing to do, because there are no rounds to scramble.");
			return;
		}

		addUpdateGeneral("Generating " + scrambleSets.length + " round" + ((scrambleSets.length === 1) ? "" : "s") + " of scrambles.");

		generateScrambleSets(hideUpdates, competitionName, scrambleSets);
	};



	/*
	 * Random Number Generation
	 */

	var randomSource = undefined;

	var initializeRandomSource = function() {
		
		var numEntropyValuesPerSource = 32;
		var entropy = [];

		// Get some pseudo-random numbers for entropy.
		for (var i = 0; i < numEntropyValuesPerSource; i++) {
			entropy.push(Math.floor(Math.random()*0xffffffff));
		}

		// Get some even better pseudo-random numbers for entropy if we can.
		try {
			var cryptoEntropy = new Uint8Array(numEntropyValuesPerSource);

			window.crypto.getRandomValues(cryptoEntropy);
			
			// Uint8Array doesn't haave a .map(...) method.
			for (var i = 0; i < numEntropyValuesPerSource; i++) {
				entropy.push(cryptoEntropy[i]);
			}

			console.log("Successfully used crypto for additional randomness.");	
		}
		catch (e) {
			console.log("Unable to use crpyto for additional randomness (that's okay, though).", e);
		}

		// We use the date to get the main entropy.
		var seed = new Date().getTime();
		

		// Make sure we don't accidentally use deterministic initialization.
		if (isFinite(seed)) {
			randomSource = new MersenneTwisterObject(seed, entropy);
			console.log("Seeded Mersenne Twister.");
			Math.random = undefined; // So we won't use it by accident.

		}
		else {
			randomSource = Math;
  			console.log("WARNING: Seeding Mersenne Twister did not work. Falling back to Math.random().");
  		}
	}

	// For seeding the workers.
	var getRandomSeed = function() {
		return (new Date().getTime() + Math.floor(randomSource.random()*0xffffffff));
	}



	/*
	 * Displaying Progress Updates
	 */

	var showUpdates = function() {
		mark2.dom.showElement(document.getElementById("updates"));
	}

	var hideUpdates = function() {
		mark2.dom.hideElement(document.getElementById("updates"));
	}

	var showUpdatesSpecific = function() {
		mark2.dom.showElement(document.getElementById("updates_specific"));
	}

	var hideUpdatesSpecific = function() {
		mark2.dom.hideElement(document.getElementById("updates_specific"));
	}

	var showInterface = function() {
		var interfaceElements = document.getElementsByClassName("interface");
		for (var i=0; i < interfaceElements.length; i++) {
			mark2.dom.hideElement(interfaceElements[i]);
		}
	}

	var hideInterface = function() {
		var interfaceElements = document.getElementsByClassName("interface");
		for (var i=0; i < interfaceElements.length; i++) {
			mark2.dom.hideElement(interfaceElements[i]);
		}
	}

	var currentTime = function() {
		return (new Date()).getTime();
	}

	var updatesGeneralStartTime;
	var updatesGeneralLastTime;
	var resetUpdatesGeneral = function() {

		var updatesGeneralDiv = document.getElementById("updates_general");
		updatesGeneralDiv.innerHTML = "";
		mark2.dom.createNewElement(updatesGeneralDiv, "h2", null, null, "Updates");

		showUpdates();

		updatesGeneralLastTime = updatesGeneralStartTime = currentTime();
	}

	var updatesSpecificStartTime;
	var updatesSpecificLastTime;
	var resetUpdatesSpecific = function(str) {

		var updatesSpecificDiv = document.getElementById("updates_specific");
		updatesSpecificDiv.innerHTML = "";
		mark2.dom.createNewElement(updatesSpecificDiv, "h2", null, null, str);

		showUpdatesSpecific();

		updatesSpecificLastTime = updatesSpecificStartTime = currentTime();
	}

	var addUpdateGeneral = function(str) {

		console.log(str);
		var updatesGeneralDiv = document.getElementById("updates_general");

		mark2.dom.createNewElement(updatesGeneralDiv, "li", null, null, str);

	}

	var addUpdateSpecific = function(str) {

		console.log(str);
		var updatesSpecificDiv = document.getElementById("updates_specific");

		mark2.dom.createNewElement(updatesSpecificDiv, "li", null, null, str);

	}



	/*
	 * Web Workers
	 */

	var webWorkersRunning = false;
	var workers = {};

	var initializeWorkers = function() {
		
		// From http://www.html5rocks.com/en/tutorials/workers/basics/#toc-inlineworkers

		if (typeof Worker === "undefined") {
			console.log("No web worker support. :-(");
			return;
		}

		try {

			for (i in workerGroups) {

				var worker = new Worker(web_worker_file);
				var scramblerFiles = {};

				for (j in workerGroups[i].events) {
					events[workerGroups[i].events[j]].worker = worker;
					scramblerFiles[workerGroups[i].events[j]] = "scramblers/" + events[workerGroups[i].events[j]].scrambler_file;
				}
				worker.onmessage = handleWorkerMessage;

				workers[i] = worker;

				worker.postMessage({action: "initialize", worker_id: i, event_ids: workerGroups[i].events, auto_ini: workerGroups[i].auto_ini, scrambler_files: scramblerFiles, random_seed: getRandomSeed()});
			}

			webWorkersRunning = true;

		}
		catch (e) {
			console.log("Starting the web workers failed; Mark 2 will fall back to continuations. (This happens with Chrome when run from file://)", e);
		}

	}

	var terminateWebWorkers = function() {
		for (var i in workers) {
			workers[i].terminate();
		}
		workers = {};
		console.log("Terminated all web workers.")
	}

	var restartWebWorkers = function() {
		terminateWebWorkers();
		initializeWorkers();
	}

	var handleWorkerMessage = function(e) {
		switch(e.data.action) {
			case "initialized":
				console.log("Web worker initialized successfully: " + e.data.info);
			break;

			case "get_random_scramble_starting":
				markScrambleStarting(
					e.data.return_data.scramble_id,
					e.data.event_id,
					e.data.return_data.num
				);
			break;

			case "console_log":
				console.log("[Web worker log]", e.data.data);
			break;

			case "console_error":
				console.log("[Web worker error]", e.data.data);
			break;

			case "message_exception":
				console.error("[Web worker exception]", e.data.data);
			break;

			case "get_random_scramble_initializing_scrambler":
				markScramblerInitializing(
					e.data.return_data.scramble_id,
					e.data.event_id,
					e.data.return_data.num
				);
			break;

			case "get_random_scramble_response":
				//console.log("Received a " + events[e.data.event_id].name +	 " scramble: " + e.data.scramble.scramble_string);
				insertScramble(
					e.data.return_data.scramble_id,
					e.data.event_id,
					e.data.return_data.num,
					e.data.scramble.scramble_string,
					e.data.scramble.state
				);
			break;

			case "echo_response":
				console.log("Echo response:");
				console.log(e.data);
			break;

			default:
				console.error("Unknown message. Action was: " + e.data.action);
			break;
		}
	}



	/*
	 * Keybindings for Debugging
	 */

	var printKeyCodes = false;

	document.onkeydown = function(e) {

		if (printKeyCodes) {
			console.log("Key pressed: " + e.keyCode);
		}

		if (e.ctrlKey) {
		 	switch (e.keyCode) {

				case 85: // "U" for ">U<pdates".
					mark2.dom.showElement(document.getElementById("updates"));
					return true;
					break;

				case 66: // "B" for ">B<enchmark". (And "A>b<out?)
					mark2.dom.showElement(document.getElementById("about"));
					return true;
					break;

				case 75: // "K" for "Show >K<eycodes"
					printKeyCodes = true;
					break;

				case 82: // "R" for ">R<efresh and >R<eset"
					// Currently buggy because of loose coupling with events table.
					resetRounds();
					addRounds(defaultRounds);
					updateHash();
					break;
			}
		}
	};



	/*
	 * Public Interface
	 */

	return {
		version: version,
		initialize: initialize,
		go: go,
		terminateWebWorkers: terminateWebWorkers,
	};
})();