(function(global){

    var buttons = [];
    var buttonHandlers = [];
    var audioElems = [];
    var recordingTime = null;

    function $$(id){
        return document.getElementById(id);
    }

    function indexOf(elem){
        // returns the numeric part of an element id
        return parseInt(elem.id.match(/(\d)/)[0], 10);
    }

    for (var i = 0; i < 16; i++){
        buttons[i] = $$('button' + i);
        audioElems[i] = $$('audio' + i);
        buttonHandlers[i] = new Hammer(buttons[i], {});
        buttonHandlers[i].on('tap', handleTap);
        buttonHandlers[i].on('doubletap', handleDoubleTap);
        buttonHandlers[i].on('press', handlePress);
    }

    function handleAll(evt){
        if (evt.type === 'tap'){
            handleTap(evt);
        }else if (evt.type === 'doubletap'){
            handleDoubleTap(evt);
        }else if (evt.type === 'press'){
            // show menu of other actions
        }else{
            console.log('unrecognized event: %o', evt);
        }
    }

    function handleTap(evt){
        console.log('tap on %s', evt.target.id);
        var button = evt.target;
        var playing = button.classList.contains('playing');
        var recording = button.classList.contains('recording');
        if (recording){
            stopRecording(button);
        }else{
            if (playing){
                stopPlaying(button);
            }else{
                startPlaying(button);
            }
        }
    }

    function handleDoubleTap(evt){
        console.log('double tap on %s', evt.target.id);
        var button = evt.target;
        startRecording(button);
    }

    function handlePress(evt){
        console.log('press on %s', evt.target.id);
    }

    function startRecording(button){
        console.log('startRecording on %s', button.id);
        // FIXME: stop playing all buttons
        // FIXME: disable all other buttons while recording
        // FIXME: set timer for max recording time
        buttons.forEach(stopPlaying);
        button.classList.add('recording');
        // actually record and store audio file
        recorder_startRecording();
        recordingTimer = setTimeout(function(){stopRecording(button);}, 5000);
    }

    function stopRecording(button){
        if (recordingTimer){
            clearTimeout(recordingTimer);
            recordingTimer = null;
        }
        console.log('stopRecording on %s', button.id);
        var wav = recorder_stopRecording();
        button.classList.remove('recording');
        var audio = audioElems[indexOf(button)];
        audio.src = wav;
        startPlaying(button);
    }

    function startPlaying(button){
        console.log('startPlaying on %s', button.id);
        button.classList.add('playing');
        var audio = audioElems[indexOf(button)];
        audio.play();
    }

    function stopPlaying(button){
        console.log('stopPlaying on %s', button.id);
        button.classList.remove('playing');
        var audio = audioElems[indexOf(button)];
        audio.pause();
    }

    // Audio recording using recorder.js

    function __log(e, data) {
      console.log(e + " " + (data || ''));
    }
    var audio_context;
    var recorder;
    function recorder_startUserMedia(stream) {
      var input = audio_context.createMediaStreamSource(stream);
      __log('Media stream created.');
      // Uncomment if you want the audio to feedback directly
      //input.connect(audio_context.destination);
      //__log('Input connected to audio context destination.');

      recorder = new Recorder(input, {workerPath: 'js/recorderWorker.js'});
      __log('Recorder initialised.');
    }
    function recorder_startRecording() {
      recorder && recorder.record();
    //   button.disabled = true;
    //   button.nextElementSibling.disabled = false;
      __log('Recording...');
    }
    function recorder_stopRecording() {
      recorder && recorder.stop();
      __log('Stopped recording.');

      // create WAV download link using audio data blob
      var wav = recorder_createWav();
      recorder.clear();
      return wav;
    }
    function recorder_createWav() {
      recorder && recorder.exportWAV(function(blob) {
        var url = URL.createObjectURL(blob);
        // var li = document.createElement('li');
        // var au = document.createElement('audio');
        // var hf = document.createElement('a');

        // au.controls = true;
        // au.src = url;
        // hf.href = url;
        // hf.download = new Date().toISOString() + '.wav';
        // hf.innerHTML = hf.download;
        // document.body.appendChild(hf);
        // hf.click();
        // FIXME: put the audio where the play button can find it
        // li.appendChild(au);
        // li.appendChild(hf);
        // recordingslist.appendChild(li);
        return url;
      });
    }
    window.onload = function init() {
      try {
        // webkit shim
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        window.URL = window.URL || window.webkitURL;

        audio_context = new AudioContext;
        __log('Audio context set up.');
        __log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
      } catch (e) {
        alert('No web audio support in this browser!');
      }

      navigator.getUserMedia({audio: true}, recorder_startUserMedia, function(e) {
        __log('No live audio input: ' + e);
      });
    };

})(this);
