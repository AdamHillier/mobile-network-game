var audioContext;
var sfxGainNode;
var musicGainNode;
var bufferLoader;
var bufferList;

var soundFileList = ['bad-action.mp3', 'call-fail.mp3', 'call-success.mp3'];
var BAD_ACTION = 0;
var CALL_FAIL = 1;
var CALL_SUCCESS = 2;

window.addEventListener('load', function() {
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		audioContext = new AudioContext();
	} catch(e) {
		alert('Web Audio API not supported');
		audioContext = null;
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
		sfxGainNode.connect(audioContext.destination);
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