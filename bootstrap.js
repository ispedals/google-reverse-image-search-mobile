const Cc = Components.classes;
const Ci = Components.interfaces;

function isPrivateTab(aTab) {
	return aTab.browser.docShell.QueryInterface(Ci.nsILoadContext).usePrivateBrowsing;
}

var searcherId = null;

function loadIntoWindow(window) {
	if (!window)
		return;

	searcherId = window.NativeWindow.contextmenus.add('Search Image on Google', window.NativeWindow.contextmenus.imageLocationCopyableContext, function (aTarget) {
		var imgUrl = aTarget.src;
		window.BrowserApp.addTab('https://encrypted.google.com/searchbyimage?image_url=' + encodeURIComponent(imgUrl), {
			isPrivate: isPrivateTab(window.BrowserApp.selectedTab)
		});
	});
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
		domWindow.addEventListener("load", function () {
			domWindow.removeEventListener("load", arguments.callee, false);
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