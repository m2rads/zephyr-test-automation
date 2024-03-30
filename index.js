if (typeof browser === "undefined") {
    var browser = chrome;
  }
let urlVal;
(async () => {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  urlVal = tab.url;
  console.log("hello")
})();


const testButton = document.getElementById("createTestCase");
testButton.addEventListener("click", getIssueDescription);

async function getIssueDescription() {
    let n = urlVal.lastIndexOf('/');
    let issueId = urlVal.substring(n + 1);
    chrome.runtime.sendMessage({ action: "log", message: "hi" });

    document.getElementById("hh").innerText = issueId

    await fetch(`https://code.bestbuy.com/jira/rest/api/2/issue/${issueId}`)
    .then((response) => response.json())
    .then((data) => {
        console.log("Issue data:", data);
        // Do something with the fetched issue data
        console.log("data: ", data)
        chrome.runtime.sendMessage({ action: "log", message: data });
        document.getElementById("hh").innerText = data
    })
    .catch((error) => {
        console.error("Error fetching issue details:", error);
    });
}

let issueKeys = [];

async function createTestCases() {
  let n = urlVal.lastIndexOf('/');
  let idInUrl = urlVal.substring(n + 1);

  const subtaskDescsAll = document.getElementById('subtaskDescs').value;
  const LINE_SPLIT_REGEX = /\r\n?|\n/g;
  let subtaskDescs = subtaskDescsAll.split(LINE_SPLIT_REGEX);

  var issueUpdatesArr = [];
  for (const subtaskDesc of subtaskDescs) {
    var subtask = {
      "fields": {
        "project": {
          "key": "UB"
        },
        "summary": subtaskDesc,
        "description": "",
        "issuetype": {
          "id": "11332"
        }
      }
    };
    issueUpdatesArr.push(subtask)
  }

  var reqBody = {"issueUpdates": issueUpdatesArr};
  var headers = {"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "dummyValue"};
  var reqOptions = {"method": "POST", "headers": headers, "body": JSON.stringify(reqBody)};

  document.getElementById("subtaskDescs").value = "Creating Test Cases..."

  const response = await fetch('https://code.bestbuy.com/jira/rest/api/2/issue/bulk', reqOptions);
  const data = await response.json();
  issueKeys = data.issues.map(issue => issue.key);
  document.getElementById("subtaskDescs").value = issueKeys;

    linkTests(issueKeys,idInUrl)
}

function linkTests(issueKeys,idInUrl) {

    var linkType = { "name": "Relates" };
    var outwardIssue = { "key": idInUrl };

      for (const key of issueKeys) {
        const inwardIssue = { "key": key };
        const payload = { "type": linkType, "inwardIssue": inwardIssue, "outwardIssue": outwardIssue };
        const headers = { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "dummyValue" };
        const options = { "method": "POST", "headers": headers, "body": JSON.stringify(payload) };

        fetch('https://code.bestbuy.com/jira/rest/api/2/issueLink', options)
          .then(response => response.json())
          .then(data => console.log(data))
          .catch(error => console.error(error));
        }
}