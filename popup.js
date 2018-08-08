// Copyright (c) 2012,2013 Peter Coles - http://mrcoles.com/ - All rights reserved.
// Use of this source code is governed by the MIT License found in LICENSE


//
// State fields
//

var currentTab, // result of chrome.tabs.query of current active tab
    resultWindowId; // window id for putting resulting images

var sslInfo, webContent, credentialFile;

function $(id) { return document.getElementById(id); }
function show(id) { $(id).style.display = 'block'; }
function hide(id) { $(id).style.display = 'none'; }


function getFilename(contentURL) {
    var name = contentURL.split('?')[0].split('#')[0];
    if (name) {
        name = name
            .replace(/^https?:\/\//, '')
            .replace(/[^A-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[_\-]+/, '')
            .replace(/[_\-]+$/, '');
        name = '-' + name;
    } else {
      name = '';
    }
    return 'screencapture' + name + '-' + Date.now() + '.png';
}


//
// Capture Handlers
//


function displayCaptures(filenames) {
  if (!filenames || !filenames.length) {
    errorHandler('File cannot capture');
    return;
  }

  _displayCapture(filenames);
}


function _displayCapture(filenames, index) {
  index = index || 0;
  var filename = filenames[index];
  var last = index === filenames.length - 1;

  const file = filename.replace('filesystem:','');
  show('avtar-block');
  hide('loading');
  $("avtar").src = file;
  toDataURL(filename, function(dataUrl) {
    credentialFile = dataURLtoFile(dataUrl, filename);
    var image = $("avtar");
    image.src = credentialFile.name;

    canSave();
  })

  if (!last) {
    _displayCapture(filenames, index + 1);
  }
}

function dataURLtoFile(dataurl, filename) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}


function toDataURL(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var reader = new FileReader();
    reader.onloadend = function() {
      callback(reader.result);
    }
    reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}


function errorHandler(reason) {
  hide('loading');
  hide('web-content-block');
  show('uh-oh'); // TODO - extra uh-oh info?
  $('response-error').innerHTML = reason;
}


function progress(complete) {
  if (complete === 0) {
    // Page capture has just been initiated.
    show('loading');
  }
  else {
    $('bar').style.width = parseInt(complete * 100, 10) + '%';
  }
}

function splitnotifier() {
    show('split-image');
}


//
// start doing stuff immediately! - including error cases
//

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  $('open-wrap').onclick = function(element) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      var tab = tabs[0];
      currentTab = tab; // used in later calls to get tab info
      var filename = getFilename(tab.url);
      show('loading');
      hide('open-wrap');
      show('web-content-block');
      exposeSSL();
      CaptureAPI.captureToFiles(tab, filename, displayCaptures,
                                errorHandler, progress, splitnotifier);
      setTimeout(function(){ getWebContent(tabs[0].id); }, 500);

    });
  };
});

function exposeSSL() {
  var background = chrome.extension.getBackgroundPage();
  var currentTabId = background.currentTabId;
  var popupData = background.popupData[currentTabId];
  if (typeof popupData === 'undefined') return;

  show('ssl-info');
  document.getElementById('ssl-validation-result').style['background'] = popupData['result_color_hex'];
  document.getElementById('ssl-validation-result').innerHTML = popupData['validation_result'];
  document.getElementById('ssl-message').innerHTML = popupData['message'];

  // Identity
  if (popupData["subject_organization"].length > 0) {
    document.getElementById('ssl-issue-to').style['display'] = 'block';
    document.getElementById('ssl-subject-organization').innerHTML = '<span>Organization</span><span>' + popupData['subject_organization'] +'</span>';
    document.getElementById('ssl-subject-organization').style['display'] = 'block';
  } else {
    document.getElementById('ssl-issue-to').style['display'] = 'none';
  }

  // Issuer
  if (popupData["issuer_common_name"].length > 0) {
    document.getElementById('ssl-issuer').style['display'] = 'block';
    document.getElementById('ssl-issuer-organization').innerHTML = '<span>Organisation</span><span>' + popupData['issuer_organization'] + '</span>';
    document.getElementById('ssl-issuer-commonName').innerHTML = '<span>Common Name</span><span>' + popupData['issuer_common_name'] + '</span>';
  } else {
    document.getElementById('ssl-issuer').style['display'] = 'none';
  }
  sslInfo = JSON.stringify(popupData);

  canSave();
};

function getWebContent(tabId) {
  chrome.tabs.sendMessage(tabId, {msg: "webContent"}, function(response) {
    webContent = response;
    $('webContent').value = webContent;
    canSave();
  })
}

function canSave() {
  if(!sslInfo || !webContent || !credentialFile) {
    return;
  }
  show('submit-block');
  document.getElementById("submit_form").addEventListener("click", function (e) {
    e.stopPropagation();

    this.disabled = true;
    this.innerHTML = 'Saving ...'
    saveCredential();
  });


}

function saveCredential() {
  var formData = new FormData();
  var request = new XMLHttpRequest();
  formData.append("avtar", credentialFile);

  formData.append("ssl_info", sslInfo);
  formData.append("web_content", webContent);

  request.onreadystatechange = function() {
    // Only handle event when request is finished
    if (request.readyState !== 4) {
      return;
    }
    hide('wrap');
    switch(request.status) {
      case 0:
        show('failure-msg');
        $('failure-msg').innerHTML = 'Server is not start';
        break;
      case 200:
        show('success-msg');
        break;
      default:
        show('failure-msg');
    }
  };
  request.open("POST", "http://localhost:3000/v1/verify_credential");
  request.send(formData);
}

