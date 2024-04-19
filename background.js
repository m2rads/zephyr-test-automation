chrome.sidePanel
.setPanelBehavior({ openPanelOnActionClick: true })
.catch((error) => console.error(error));

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "log") {
      console.log(request.message);
    }
  });
  
