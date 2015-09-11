const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

let {UserAgentOverrides} = Cu.import("resource://gre/modules/UserAgentOverrides.jsm", {});

function isPrivateTab(tab) {
  return tab.browser.docShell.QueryInterface(Ci.nsILoadContext).usePrivateBrowsing;
}

/* 
  Google redirects to the homepage if we attempt a reverse image search using the default UA
  so spoof the chrome user agent (see bugzil.la/1200652)
*/
const CHROME_USER_AGENT = 'Mozilla/5.0 (Linux; Android) AppleWebKit (KHTML, like Gecko) Mobile';
let searcherId = null;

function loadIntoWindow(window) {
  if (!window)
    return;

  searcherId = window.NativeWindow.contextmenus.add(
    'Search Image on Google',
    {
      matches: function(element) {
        // imageLocationCopyableContext also matches data urls, which google image search does not support
        return window.NativeWindow.contextmenus.imageLocationCopyableContext.matches(element) && element.currentURI.scheme.startsWith('http');
      }
    },
    function (target) {
      let imgUrl = target.src;
      window.BrowserApp.addTab('https://www.google.com/searchbyimage?image_url=' + encodeURIComponent(imgUrl), {
        isPrivate: isPrivateTab(window.BrowserApp.selectedTab),
        parentId: window.BrowserApp.selectedTab.id
      });
    }
  );
}

function unloadFromWindow(window) {
  if (!window)
    return;
  window.NativeWindow.contextmenus.remove(searcherId);
}

var windowListener = {
  onOpenWindow: function (aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("UIReady", function () {
      domWindow.removeEventListener("UIReady", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  onCloseWindow: function (aWindow) {},
  onWindowTitleChange: function (aWindow, aTitle) {}
};

function startup(aData, aReason) {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  // Load into any existing windows
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }
  // Load into any new windows
  wm.addListener(windowListener);
  /*
    Reverse Image Search first hits the url of the form:
      google.<COUNTRY SPECIFIC TLD>/searchbyimage?image_url=<IMAGE URL>
    which then redircts to the url of the form:
      google.<COUNTRY SPECIFIC TLD>/search?tbs=sbi:<...>
    
    We need to provide the Chrome User Agent for these urls
  */
  UserAgentOverrides.addComplexOverride(function googleImageSearchUserAgentOverride(channel, DEFAULT_UA){
    if (channel.URI.host.indexOf("google.") !== -1 && (channel.URI.path.startsWith("/searchbyimage?") || channel.URI.path.startsWith("/search?tbs=sbi:"))){
      return CHROME_USER_AGENT;
    }
  });
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN)
    return;
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  // Stop listening for new windows
  wm.removeListener(windowListener);
  // Unload from any existing windows
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
}

function install(aData, aReason) {}

function uninstall(aData, aReason) {}
