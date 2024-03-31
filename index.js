if (typeof browser === "undefined") {
    var browser = chrome;
  }
let urlVal;
(async () => {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  urlVal = tab.url;
})();


const testButton = document.getElementById("createTestCase");
testButton.addEventListener("click", getIssueDescription);

async function getIssueDescription() {
    let n = urlVal.lastIndexOf('/');
    let issueId = urlVal.substring(n + 1);

    await fetch(`https://code.bestbuy.com/jira/rest/api/2/issue/${issueId}`)
    .then((response) => response.json())
    .then((data) => {
        console.log("Issue data:", data);
        console.log("data: ", data)
        chrome.runtime.sendMessage({ action: "log", message: data.fields.description });
        // generatePrompt()

    })
    .catch((error) => {
        console.error("Error fetching issue details:", error);
    });
}

function generatePrompt(text) {
  const prompt = `
      You will be provided with Jira Story description marked with <story><story>. The description has a GWT table marked with ||Given|When|Then|| and each record in a row is delimited by | character like this 
      |given|then|when|. 

      Your job is to act as a Test Automation Engineer who is creating zephyr test cases in Jira using this GWT table. 
      Each row of the GWT table represents one Zephyr test case. 

      For instance, you can expect the following example which has two rows: 

      ||Given||When||Then||
      |We want to search vendor logs by SKU|GET:/v1/search?by=SKU&sku=17000000|Expect response: 200 Ok
      with payload (example):{code:java}
      [
         {
            "createdBy" : "John Doh",
            "createdDate" : "2024-03-01T00:00:00Z",
            "departmentId" : 40,
            "departmentName" : "Electronics",
            "endDate" : "2024-02-01T00:00:00Z",
            "fundTypeName" : "Sell-Thru (Markdown)",
            "fundsAllocation" : "13a Vendor Income, Advertising",
            "locationType" : "STORES",
            "lumpAmount" : 3000.99,
            "merchName" : "Merchant name",
            "startDate" : "2024-01-26T00:00:00Z",
            "vendorContactName" : "Lisa Houston",
            "vendorLogId" : 2,
            "vendorLogType" : "SKU",
            "vendorName" : "Solutions 2 Go Inc."
         }
      ]
      {code}|
      |We want to search vendor logs by USER|GET:/v1/search?by=USER&user=todd|Expect response: 200 Ok
      with payload (example):{code:java}
      [
         {
            "createdBy" : "todd",
            "createdDate" : "2024-03-01T00:00:00Z",
            "departmentId" : 40,
            "departmentName" : "Electronics",
            "endDate" : "2024-02-01T00:00:00Z",
            "fundTypeName" : "Sell-Thru (Markdown)",
            "fundsAllocation" : "13a Vendor Income, Advertising",
            "locationType" : "STORES",
            "lumpAmount" : 3000.99,
            "merchName" : "Merchant name",
            "startDate" : "2024-01-26T00:00:00Z",
            "vendorContactName" : "Lisa Houston",
            "vendorLogId" : 2,
            "vendorLogType" : "SKU",
            "vendorName" : "Solutions 2 Go Inc."
         }
      ]
      {code}|
      
      Given the GWT table your task is to do the following actions:

      1 - Write a summary of each row to use as the title of the test case. Use the following summary as an example: 
      title: <Validate GET: search?by=SKU&sku=18000000 get logs by id>

      2- For each test case, create test steps using the following format: 
      {
        "step": "Make Get Request to v1/search?by=SKU&sku=18000000",
        "data": "set the sku to something that exists in the DB like 18000000",
        "result": "should recieve status 200 ok with following response payload:
        [
          {
             "createdBy" : "John Doh",
             "createdDate" : "2024-03-01T00:00:00Z",
             "departmentId" : 40,
             "departmentName" : "Electronics",
             "endDate" : "2024-02-01T00:00:00Z",
             "fundTypeName" : "Sell-Thru (Markdown)",
             "fundsAllocation" : "13a Vendor Income, Advertising",
             "locationType" : "STORES",
             "lumpAmount" : 3000.99,
             "merchName" : "Merchant name",
             "startDate" : "2024-01-26T00:00:00Z",
             "vendorContactName" : "Lisa Houston",
             "vendorLogId" : 2,
             "vendorLogType" : "SKU",
             "vendorName" : "Solutions 2 Go Inc."
          }
       ]  
        ",
      },
      {
        "step: "validate DB",
        "test data": "look for Sku 18000000."
        "result": "There needs to be same amount of entries as you receive in the response payload"
      }

      3- Return your output for each GWT row in the following json format: 
      {
        "summary": "<title summary>"
        "test steps": [ 
          {
            "step": "<>",
            "data": "<>",
            "result": "<>",
          },
        ]
      }

      
      <story>${text}</story>
  `
}

// now this is where we are going to train hit our GPTContainer
// and in there we have to prompt engineer our container.
// clone this repo and run locally: 
async function getTestStepsFromJiraIssue(jiraDescription) {
  const requestOption = {
    method: "POST",
    headers: {
      'Content-Type': 'application/jsopn',
    },
    body: {"jiraDescription": JSON.stringify(jiraDescription) },
  }
  await fetch("https://localhost:8080", requestOption)
  .then(response => { response.json()})
  .then(data => chrome.runtime.sendMessage({ action: "log", message: data.fields.description })
  )

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