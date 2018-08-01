// Copyright (c) 2012,2013 Peter Coles - http://mrcoles.com/ - All rights reserved.
// Use of this source code is governed by the MIT License found in LICENSE


//
// State fields
//

var currentTab, // result of chrome.tabs.query of current active tab
    resultWindowId; // window id for putting resulting images


//
// Utility methods
//

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
        return filename;
        // const file = filename.replace('filesystem:','');
        // console.log('url  ss', file);
        // $("avtar").src = file;
        // show('avtar-form');

        // chrome.tabs.create({
        //     url: filename,
        //     active: last,
        //     windowId: resultWindowId,
        //     openerTabId: currentTab.id,
        //     index: (currentTab.incognito ? 0 : currentTab.index) + 1 + index
        // });
    }

    if (!last) {
        _displayCapture(filenames, index + 1);
    }
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
      let sslInfo = exposeSSL();
      let file = CaptureAPI.captureToFiles(tab, filename, displayCaptures,
                                errorHandler, progress, splitnotifier);
saveCredential(sslInfo);
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

  return popupData;
};

function saveCredential(sslInfo) {
  var request = new XMLHttpRequest();

    var formData = new FormData();

    formData.append("ssl_info", sslInfo);


  request.onreadystatechange = function() {
    // Only handle event when request is finished
    if (request.readyState !== 4) {
      return;
    }

    console.log('aaaaaaaaaaa');
  };
    request.open("POST", "http://localhost:3000/v1/verify_credential");
    request.send(formData);

}
