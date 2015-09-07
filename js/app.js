(function(global){

    // these are all caches for convient access
    var buttons = [];
    var buttonHandlers = [];
    var audioElems = [];
    var audioBlobs = [];
    var audioTitles = [];

    // for debugging
    global.buttons = buttons;
    global.audioElems = audioElems;
    global.audioBlobs = audioBlobs;
    global.audioTitles = audioTitles;

    // handle for timer to limit recording time
    var recordingTime = null;

    function $$(id){
        return document.getElementById(id);
    }

    function indexOf(elem){
        // returns the numeric part of an element id
        return parseInt(elem.id.match(/(\d+)/)[0], 10);
    }

    function restoreSavedAudio(i){
        localforage.getItem('audio'+i, function(err, value){
            if (value){
                audioBlobs[i] = value;
                audioElems[i].src = URL.createObjectURL(value);
            }
        });
        localforage.getItem('title'+i, function(err, value){
            // console.log('getting title %s', i);
            var title = value || 'audio'+i;
            buttons[i].firstChild.textContent = title;
            audioTitles[i] = title;
        });
    }

    for (var i = 0; i < 16; i++){
        buttons[i] = $$('button' + i);
        audioElems[i] = $$('audio' + i);
        buttonHandlers[i] = new Hammer(buttons[i], {});
        buttonHandlers[i].on('tap', handleTap);
        buttonHandlers[i].on('doubletap', handleDoubleTap);
        buttonHandlers[i].on('press', handlePress);
        restoreSavedAudio(i);
    }

    function handleAll(evt){
        throw new Exception('handleAll should be deprecated');
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
        // console.log('tap on %s', evt.target.id);
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
        // console.log('double tap on %s', evt.target.id);
        var button = evt.target;
        startRecording(button);
    }

    function handlePress(evt){
        // console.log('press on %s', evt.target.id);
        showMenu(evt.target);
    }

    var currentButton = null;
    function showMenu(button){
        console.log('showMenu for button %s', button.id)
        currentButton = button;
        $$('curtain').classList.add('show');
        $$('menu').classList.add('show');
    }

    function hideMenu(){
        currentButton = null;
        $$('menu').classList.remove('show');
        $$('curtain').classList.remove('show');
    }

    function showPrompt(){
        $$('rename-input').classList.add('show');
        $$('new-name').value = currentButton.firstChild.textContent;
    }

    function hidePrompt(){
        $$('rename-input').classList.remove('show');
    }

    function renameCurrentButton(){
        console.log('rename button %s', currentButton);
        var idx = indexOf(currentButton);
        updateTitle(idx, $$('new-name').value);
        hidePrompt();
        hideMenu();
    }

    function shareFromCurrentButton(){
        console.log('upload from button %s', currentButton.id);
        // FIXME: Disable everything while this is in progress?
        var idx = indexOf(currentButton);
        _getUploadUrl(_shareFromIndex(idx));
    }

    function _getUploadUrl(cb){
        var req = new XMLHttpRequest();
        req.addEventListener("load", cb);
        req.open("GET", "/getuploadurl", true);
        req.send();
    }

    function _shareFromIndex(idx){
        var blob = audioBlobs[idx];
        if (!blob){
            // FIXME: We probably should not allow re-sharing audio that was downloaded?
            console.log('you can only share if there is audio recorded');
        }
        var title = audioTitles[idx] + '.wav';
        return function(evt){
            var formData = new FormData();
            formData.append('file', blob, title);
            var uploadUrl = this.responseText;
            var request = new XMLHttpRequest();
            request.addEventListener('load', _uploadComplete);
            request.open('POST', uploadUrl, true);
            request.send(formData);
        };
    }

    function _uploadComplete(response){
        console.log('upload complete: %o', response);
        // re-enable anything disabled
        hideMenu();
    }

    function _receiveDownloadedFile(evt){
        var header = this.getResponseHeader('Content-Disposition');
        var re = /formdata; filename="(.+)\.wav"/;
        var title = header.match(re)[1];
        var blob = this.response;
        var idx = indexOf(currentButton);
        console.log('received file [%s]: %s', idx, title);
        updateAudio(idx, blob);
        updateTitle(idx, title);
        startPlaying(currentButton);
        hideMenu();
    }

    function downloadToCurrentButton(){
        console.log('download to button %s', currentButton.id);
        var req = new XMLHttpRequest();
        req.addEventListener("load", _receiveDownloadedFile);
        req.open("GET", "/randomwav", true);
        req.responseType = 'blob';
        req.send();
    }

    function disable(button){
        button.setAttribute('disabled', 'disabled');
    }

    function enable(button){
        button.removeAttribute('disabled');
    }

    function startRecording(button){
        // console.log('startRecording on %s', button.id);
        var myIdx = indexOf(button);
        buttons.forEach(function(btn, idx){
            stopPlaying(btn);
            if (idx !== myIdx){
                disable(btn);
            }
        });
        button.classList.add('recording');
        // actually record and store audio file
        recorder_startRecording();
        recordingTimer = setTimeout(function(){stopRecording(button);}, 5000);
    }

    function updateAudio(idx, blob){
        // save audio blob and update caches
        audioBlobs[idx] = blob;
        audioElems[idx].src = URL.createObjectURL(blob);
        localforage.setItem('audio'+idx, blob, function(){
            console.log('saved audio'+idx);
        });
    }

    function updateTitle(idx, title){
        buttons[idx].firstChild.textContent = title;
        audioTitles[idx] = title;
        localforage.setItem('title'+idx, title, function(){
            console.log('saved title%s: %s', idx, title);
        });
    }

    function stopRecording(button){
        if (recordingTimer){
            clearTimeout(recordingTimer);
            recordingTimer = null;
        }
        // console.log('stopRecording on %s', button.id);
        recorder_stopRecording(function(blob){
            button.classList.remove('recording');
            var idx = indexOf(button);
            updateAudio(idx, blob);
            buttons.forEach(enable);
            startPlaying(button);
        });
    }

    function startPlaying(button){
        // console.log('startPlaying on %s', button.id);
        var audio = audioElems[indexOf(button)];
        if (audio.src){
            button.classList.add('playing');
            audio.play();
        }else{
            console.log('no audio for this button, download or record one');
        }
    }

    function stopPlaying(button){
        // console.log('stopPlaying on %s', button.id);
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
    var input
    function recorder_startUserMedia(stream) {
      input = audio_context.createMediaStreamSource(stream);
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
    function recorder_stopRecording(cb) {
      recorder && recorder.stop();
      __log('Stopped recording.');

      // create WAV download link using audio data blob
      recorder_createWav(cb);
      recorder.clear();
      recorder = new Recorder(input, {workerPath: 'js/recorderWorker.js'});
    }

    function recorder_createWav(cb) {
        recorder.exportWAV(function(blob) {
            cb(blob);
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

    $$('do_rename').addEventListener('click', showPrompt, false);
    $$('do_share').addEventListener('click', shareFromCurrentButton, false);
    $$('do_download').addEventListener('click', downloadToCurrentButton, false);
    $$('do_cancel').addEventListener('click', hideMenu, false);
    $$('do_update_name').addEventListener('click', renameCurrentButton, false);
    $$('do_cancel2').addEventListener('click', hidePrompt, false);

})(this);
