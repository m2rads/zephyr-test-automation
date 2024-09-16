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
const spinner_1 = document.getElementById("spin-1")

const generateButton = document.getElementById("createTestCase");
const updateJiraButton = document.getElementById("updateJira")
const clear = document.getElementById("clearBox");
const searchButton = document.getElementById("searchButton");
const searchQuery = document.getElementById("searchQuery");

generateButton.addEventListener("click", getIssueDescription);
updateJiraButton.addEventListener("click", updateJira);
clear.addEventListener("click", clearPreviewBox);
searchButton.addEventListener("click", searchJira);

function clearPreviewBox() {
  gptResultArea.value = "";
}

async function searchJira() {
  statusLabel.classList.remove("hidden");
  spinner_1.classList.remove("hidden");
  
  const jql = searchQuery.value;
  let startAt = 0;
  const maxResults = 50; // Increased for efficiency, adjust if needed
  let totalIssues = [];
  
  try {
      while (true) {
          const response = await fetch('https://jira.tools.bestbuy.com/rest/api/2/search', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
              },
              body: JSON.stringify({
                  jql: jql,
                  startAt: startAt,
                  maxResults: maxResults,
                  fields: ['key', 'summary', 'description']
              })
          });

          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          totalIssues = totalIssues.concat(data.issues);

          if (totalIssues.length >= data.total) {
              break; // We've retrieved all issues
          }

          startAt += data.issues.length;
      }

      let result = `Total issues found: ${totalIssues.length}\n\n`;
      
      for (const issue of totalIssues) {
          result += `Key: ${issue.key}\n`;
          result += `Summary: ${issue.fields.summary}\n`;
          result += `Description: ${issue.fields.description}\n\n`;
      }

      gptResultArea.value = result;
  } catch (error) {
      console.error("Error searching Jira:", error);
      gptResultArea.value = `Error searching Jira: ${error.message}`;
  } finally {
      statusLabel.classList.add("hidden");
      spinner_1.classList.add("hidden");
  }
}

async function getIssueDescription() {
    let n = urlVal.lastIndexOf('/');
    let issueId = urlVal.substring(n + 1);

    statusLabel.classList.remove("hidden");
    spinner_1.classList.remove("hidden");
    
    await fetch(`https://jira.tools.bestbuy.com/rest/api/2/issue/${issueId}`)
    .then((response) => response.json())
    .then((data) => {
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
  try {
    spinner_1.classList.remove("hidden");
    let jsonResults = JSON.parse(gptResultArea.value);

    jsonResults.forEach((item, key) => {
      console.log(key)
      createJiraTestCase(item)
    })

  } catch (e) {
    chrome.runtime.sendMessage({ action: "log", message: `error when updating jira: ${e.message}` });
    spinner_1.classList.add("hidden");
  }
}

async function createJiraTestCase(testData) {
  var reqBody = {
      fields: {
          project: { key: "UB" },
          summary: testData.summary,
          issuetype: { name: "Test" },
          description: "Testing jira issue creation",
          labels: ["test", "automation"],
          priority: { name: "Lowest" }
      }
  };

  var headers = {"Content-Type": "application/json", "Accept": "application/json"};
  var reqOptions = {"method": "POST", "headers": headers, "body": JSON.stringify(reqBody)};

  try {
    const response = await fetch('https://jira.tools.bestbuy.com/rest/api/2/issue', reqOptions);
    const data = await response.json();
    let testCaseKey = data.key;
    let testCaseId = data.id
    for (const [key, item] of testData.testSteps.entries()) {
      console.log(key);
      let reqOption = {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item),
      };
      await createJiraTestSteps(reqOption, testCaseId);
    }
    await linkTests(testCaseKey)
  } catch (e) {
    chrome.runtime.sendMessage({ action: "log", message: `Error processing test step ${key}: ${error.message}`});
  }
}

async function createJiraTestSteps(reqOption, testCaseId) {
  try {
    const response = await fetch(`https://jira.tools.bestbuy.com/rest/zapi/latest/teststep/${testCaseId}`, reqOption);
    const data = await response.json();
  } catch (e) {
    chrome.runtime.sendMessage({ action: "log", message: `error when creating test steps: ${e.message}` });
  }
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

      6. Try to identify additional validation steps required beyond those specified in the 'Then' column, include those as well.

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

      8. Lastly make sure you do not use any character that is not supported in a json body request such as << and >> characters.


      Jira Description: '''${text}'''
  `

  getTestStepsFromJiraIssue(prompt)
}

// this is where we are going to hit our GPTContainer
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
    statusLabel.classList.add("hidden")
    spinner_1.classList.add("hidden");

    gptResultArea.value = data.generatedTestStep;
  } catch (error) {
    chrome.runtime.sendMessage({ action: "log", message: error.message });
    statusLabel.innerText = "Oops! An error Occured. Please refresh the page and try again"
  }
}

async function linkTests(testCaseKey) {
  let n = urlVal.lastIndexOf('/');
  let idInUrl = urlVal.substring(n + 1);
  chrome.runtime.sendMessage({ action: "log", message: `testCaseKey: ${testCaseKey}` });

  var linkType = { "name": "Relates" };
  var outwardIssue = { "key": idInUrl };
  const inwardIssue = { "key": testCaseKey };
  const payload = { "type": linkType, "inwardIssue": inwardIssue, "outwardIssue": outwardIssue };
  const headers = { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "dummyValue" };
  const options = { "method": "POST", "headers": headers, "body": JSON.stringify(payload) };

  try {
    const response = await fetch('https://jira.tools.bestbuy.com/rest/api/2/issueLink', options);
    if (response.ok) {
      if (response.headers.get('Content-Length') === '0' || response.headers.get('Content-Type') !== 'application/json') {
        spinner_1.classList.add("hidden");
        refreshCurrentTab();
      } else {
        const data = await response.json();
        chrome.runtime.sendMessage({ action: "log", message: `link test result: ${JSON.stringify(data)}` });
      }
    } else {
      throw new Error(`HTTP error, status = ${response.status}`);
    }
  } catch (error) {
    chrome.runtime.sendMessage({ action: "log", message: `error when linking test: ${error}` });
  }
}


function refreshCurrentTab() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    var currentTab = tabs[0];
    if (currentTab && currentTab.id) {
      chrome.tabs.reload(currentTab.id);
    }
  });
}
