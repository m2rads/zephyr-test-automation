if (typeof browser === "undefined") {
    var browser = chrome;
  }
let urlVal;
(async () => {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  urlVal = tab.url;
})();

const gptResultArea = document.getElementById("gptResult")
const statusLabel = document.getElementById("status")

const generateButton = document.getElementById("createTestCase");
const updateJiraButton = document.getElementById("updateJira")
const tryAgainButton = document.getElementById("tryAgain");

generateButton.addEventListener("click", getIssueDescription);
updateJiraButton.addEventListener("click", updateJira);
tryAgainButton.addEventListener("click", getIssueDescription);


async function getIssueDescription() {
    let n = urlVal.lastIndexOf('/');
    let issueId = urlVal.substring(n + 1);

    generateButton.disabled = true;
    tryAgainButton.disabled = true;
    // updateJiraButton.disabled = true;
    statusLabel.classList.remove("hidden");

    await fetch(`https://code.bestbuy.com/jira/rest/api/2/issue/${issueId}`)
    .then((response) => response.json())
    .then((data) => {
        // chrome.runtime.sendMessage({ action: "log", message: data.fields.description });
        const jiraDescription = data.fields.description
        const urlRegex = /(?:https?|ftp):\/\/[\n\S]+/g;

        // Find all URLs in the description
        const jiraDescriptionWithoutUrls = jiraDescription.replace(urlRegex, '');
        generatePrompt(jiraDescriptionWithoutUrls)
    })
    .catch((error) => {
        console.error("Error fetching issue details:", error);
    });

  }


function updateJira() {
  chrome.runtime.sendMessage({ action: "log", message: gptResultArea.value });
  
  try {
    let jsonResult = JSON.parse(gptResultArea.value);
    chrome.runtime.sendMessage({ action: "log", message: jsonResult });

    jsonResult.forEach((item, index) => {
      console.log(index)
      chrome.runtime.sendMessage({ action: "log", message: item.summary });
      createJiraTestCase(item.summary)
      // create test step
      // then link the tests
    })

  } catch (e) {
    chrome.runtime.sendMessage({ action: "log", message: e.message });

  }

}

async function createJiraTestCase(summaryTitle) {
  var issueData = {
      fields: {
          project: { key: "UB" },
          summary: summaryTitle,
          issuetype: { name: "Test" },
          description: "Testing jira issue creation",
          labels: ["test", "automation"],
          priority: { name: "Lowest" }
      }
  };

  var reqBody = issueData;
  var headers = {"Content-Type": "application/json", "Accept": "application/json"};
  var reqOptions = {"method": "POST", "headers": headers, "body": JSON.stringify(reqBody)};

  try {
    const response = await fetch('https://code.bestbuy.com/jira/rest/api/2/issue', reqOptions);
    const data = await response.json();
    chrome.runtime.sendMessage({ action: "log", message: data });
    return data.key;
  } catch (e) {
    chrome.runtime.sendMessage({ action: "log", message: e.message });
  }
}

async function createJiraTestSteps(issueKey) {
  

}

function generatePrompt(text) {
  const prompt = `
      You will be provided with a Jira Story description marked with ''' which includes a Given-When-Then (GWT) table. Each row in the GWT table represents a test case.

      Your task as a Test Automation Engineer is to create Zephyr test cases in Jira based on the GWT table, ensuring comprehensive validation coverage as per the requirements specified in the 'Then' column.

      Here's the format of the GWT table:

      ||Given||When||Then||
      |<Given condition>|<When action>|<Expected result and validation actions>|

      Your job is to:

      1. Write a summary of each row to use as the title of the test case.

      2. Create test steps for each test case using the following format:
        {
          "step": "<Test step description>",
          "data": "<Test data or parameters>",
          "result": "<Expected result and validation actions>"
        }

      3. Ensure that each validation requirement specified in the 'Then' column has its own test step.

      4. If a validation requires multiple actions or checks, create multiple test steps to cover each action or check separately.

      5. If the expected payload is present in the 'Then' column, include it in the result column of the test step to represent the expected result.

      6. If you identify additional validation steps required beyond those specified in the 'Then' column, include those as well.

      7. Ensure that you consistently provide responses in the form of a JSON array containing information for each test case. The output should adhere to the following format:

      [
        {
          "summary": "<Title summary>",
          "testSteps": [ 
            {
              "step": "<Test step description>",
              "data": "<Test data or parameters>",
              "result": "<Expected result and validation actions> [Expected response payload if present]"
            },
            ...
          ]
        },
        ...
      ]

      Jira Description: '''${text}'''
  `

  getTestStepsFromJiraIssue(prompt)
}

// this is where we are going to train hit our GPTContainer
// and in there we have to prompt engineer our container.
// clone this repo and run locally: 
async function getTestStepsFromJiraIssue(prompt) {
  const requestOption = {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ "jiraPrompt": prompt }),
  };

  try {
    const response = await fetch("http://localhost:8080/api/gpt/test-step", requestOption);
    const data = await response.json();
    // chrome.runtime.sendMessage({ action: "log", message: data.generatedTestStep });
    updateJiraButton.disabled = false;
    tryAgainButton.disabled = false;
    statusLabel.classList.add("hidden")
    gptResultArea.value = data.generatedTestStep;
  } catch (error) {
    chrome.runtime.sendMessage({ action: "log", message: error.message });
    statusLabel.innerText = "Oops! An error Occured. Please refresh the page and try again"
  }
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



`
[
  {
    "summary": "CSG Tool submits a Vendor Funding Log with Location Stores as an array",
    "testSteps": [
      {
        "step": "Submit Vendor Funding Log with Location Stores as an array",
        "data": "Vendor Funding Log JSON payload with Location Stores as an array",
        "result": "Expect Response: 200 Ok [Response payload: { \"vendorLogId\": \"«new_id»\" }]",
      },
      {
        "step": "Validate MVFS DB entry for VendorLog ID and LocationGroup",
        "data": "",
        "result": "MVFS DB contains the VendorLog with ID received in response."
      },
      {
        "step": "Validate LocationGroup in MVFS DB",
        "data": "",
        "result": "MVFS DB contains the LocationGroup = *STORES* for VendorLog entry with «new_id»."
      },
      {
        "step": "Validate VendorLogLocationStores Table",
        "data": "",
        "result": "VendorLogLocationStores Table contains locationStore1, 4, 18 and has FK VendorLogId = «new_id»."
      }
    ]
  }
]

`