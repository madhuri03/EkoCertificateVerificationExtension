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
        show('uh-oh');
        return;
    }

    _displayCapture(filenames);
}


function _displayCapture(filenames, index) {
    index = index || 0;

    var filename = filenames[index];
    var last = index === filenames.length - 1;

    if (currentTab.incognito && index === 0) {
        // cannot access file system in incognito, so open in non-incognito
        // window and add any additional tabs to that window.
        //
        // we have to be careful with focused too, because that will close
        // the popup.
        chrome.windows.create({
            url: filename,
            incognito: false,
            focused: last
        }, function(win) {
            resultWindowId = win.id;
        });
    } else {
        const file = filename.replace('filesystem:','');
        $("avtar").src = file;
        toDataURL(filename, function(dataUrl) {
          credentialFile = dataURLtoFile(dataUrl, filename);
          var image = $("avtar");
          image.src = credentialFile.name;

          cansave();
        })


        // chrome.tabs.create({
        //     url: filename,
        // });
    }

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
    show('uh-oh'); // TODO - extra uh-oh info?
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

      exposeSSL();
      CaptureAPI.captureToFiles(tab, filename, displayCaptures,
                                errorHandler, progress, splitnotifier);
      setTimeout(function(){ getWebContent(tabs[0].id); }, 3000);

    });
  };
});

function exposeSSL() {
  var background = chrome.extension.getBackgroundPage();
  var currentTabId = background.currentTabId;
  var popupData = background.popupData[currentTabId];
  if (typeof popupData === 'undefined') return;

  document.getElementById('lblValidationResult').style['background'] = popupData['result_color_hex'];
  document.getElementById('lblValidationResult').innerHTML = popupData['validation_result'];
  document.getElementById('lblMessage').innerHTML = popupData['message'];

  // Identity
  if (popupData["subject_organization"].length > 0) {
    document.getElementById('lblSubjectOrganization').innerHTML = 'Organization:<br><b>' + popupData['subject_organization'] + '</b>';
    document.getElementById('lblSubjectOrganization').style['display'] = 'block';
  } else {
    document.getElementById('lblSubjectOrganization').innerHTML = '';
    document.getElementById('lblSubjectOrganization').style['display'] = 'none';
  }

  // Issuer
  if (popupData["issuer_common_name"].length > 0) {
    document.getElementById('pIssuer').style['display'] = 'block';
    document.getElementById('lblIssuerOrganization').innerHTML = '<b>' + popupData['issuer_organization'] + '</b>';
    document.getElementById('lblIssuerCommonName').innerHTML = popupData['issuer_common_name'];
  } else {
    document.getElementById('pIssuer').style['display'] = 'none';
  }
  sslInfo = JSON.stringify(popupData);

  cansave();
};

function getWebContent(tabId) {
  chrome.tabs.sendMessage(tabId, {msg: "webContent"}, function(response) {
    webContent = response;
    $('webContent').value = webContent;
    cansave();
  })
}

function cansave() {
  if(!sslInfo || !webContent || !credentialFile) {
    return;
  }

  document.getElementById("submit_form").addEventListener("click", function (e) {
    e.stopPropagation();
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
    // if (request.readyState !== 4) {
    //   return;
    // }
  };
  request.open("POST", "http://localhost:3000/v1/verify_credential");
  request.send(formData);
}

