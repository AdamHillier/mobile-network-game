var audioContext;
var sfxGainNode;
var musicGainNode;
var bufferLoader;
var bufferList;

var soundFileList = ['bad-action.mp3', 'call-fail.mp3', 'call-success.mp3'];
var BAD_ACTION = 0;
var CALL_FAIL = 1;
var CALL_SUCCESS = 2;

document.addEventListener("DOMContentLoaded", function() {
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		audioContext = new AudioContext();
	} catch(e) {
		alert('Web Audio API not supported');
		audioContext = null;
		document.getElementById("volume").style.display = "none";
	}

	if (audioContext != null) {
		bufferLoader = new BufferLoader(audioContext,
			soundFileList,
			function(buffers) {
				bufferList = buffers;
			}
		);
		bufferLoader.load();

		sfxGainNode = audioContext.createGain();
		musicGainNode = audioContext.createGain();
		sfxGainNode.gain.value = document.getElementById("sfx-gain").value / 100.0;
		musicGainNode.gain.value = document.getElementById("music-gain").value / 100.0;
		sfxGainNode.connect(audioContext.destination);
		musicGainNode.connect(audioContext.destination);
	}
});

function playSound(sound) {
	if (audioContext != null) {
		var source = audioContext.createBufferSource();
		source.buffer = bufferList[sound];
		source.connect(sfxGainNode);
		source.start(0);
	}
}

function setSfxGain(gain) { // 0 <= gain <= 100
	sfxGainNode.gain.value = gain / 100.0;
}

function setMusicGain(gain) {
	musicGainNode.gain.value = gain / 100.0;
}