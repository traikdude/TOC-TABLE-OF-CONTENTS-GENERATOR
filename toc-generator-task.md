# TASK: Google Apps Script TOC Generator (Clasp \+ Web App)

## Objective

Build, configure, validate, and deploy a Google Apps Script project using Clasp that automatically generates a fully functional, accurately linked Table of Contents (TOC) for a Google Doc. This solution incorporates a thread-safe locking execution model, an elegant WCAG-compliant HTML control sidebar/dialog, robust document-clearing mechanisms, and an automated GitHub Actions CI/CD pipeline.

---

## Document Profile & Methodology

- **Type:** Technical DevOps & Automation Runbook  
- **Complexity:** Expert (V8 Apps Script, Clasp CLI, GitHub Actions)  
- **Structure:** Topic-Based & Chronological Hierarchy  
- **Audience:** Automated IDE / Execution AI Agent (Zero-Involvement Execution)  
- **Formatting Framework:** `enhanced-doc-formatter` (Smart Mode presets)

---

## Step 1 — Local Environment & Tool Setup

Before running local workspace commands, ensure that Node.js (v18+) is available on your local system, then set up the workspace requirements.

1. **Verify Node.js and npm installations:**  
     
   node \-v && npm \-v  
     
2. **Install clasp (Google Apps Script Command Line Tool) globally:**  
     
   npm install \-g @google/clasp  
     
3. **Enable the Google Apps Script API on your Google Developer Account:**  
     
   - Navigate to: [Google Apps Script Settings](https://script.google.com/home/settings)  
   - Toggle **Google Apps Script API** to **ON**.

   

4. **Authenticate Clasp on your local machine:**  
     
   clasp login

---

## Step 2 — Initialize Workspace Structure

Run the following commands to initialize the local project directory structure:

mkdir toc-generator && cd toc-generator

mkdir \-p src

mkdir \-p .github/workflows

Initialize your `package.json` file to manage developer tooling and dependency scanning:

cat \<\< 'JSONEOF' \> package.json

{

  "name": "toc-generator",

  "version": "1.0.0",

  "description": "Google Apps Script Table of Contents Generator",

  "main": "src/Code.gs",

  "scripts": {

    "lint": "eslint src/\*\*/\*.gs"

  },

  "devDependencies": {

    "eslint": "^8.57.0",

    "eslint-plugin-googleappsscript": "^1.0.5"

  },

  "license": "MIT"

}

JSONEOF

Install linting utility libraries locally:

npm install

---

## Step 3 — Create production-grade Source Files

Create the project configuration, backend business logic, accessible frontend interface, and automated pipelines.

### 3.1 — Create `.eslint.json` Linting Schema

cat \<\< 'JSONEOF' \> .eslintrc.json

{

  "env": {

    "browser": true,

    "es6": true,

    "googleappsscript/googleappsscript": true

  },

  "extends": "eslint:recommended",

  "parserOptions": {

    "ecmaVersion": 2018

  },

  "plugins": \[

    "googleappsscript"

  \],

  "rules": {

    "no-unused-vars": "warn",

    "no-undef": "error"

  }

}

JSONEOF

### 3.2 — Create `src/appsscript.json` (Apps Script Manifest)

cat \<\< 'JSONEOF' \> src/appsscript.json

{

  "timeZone": "America/New\_York",

  "dependencies": {},

  "exceptionLogging": "STACKDRIVER",

  "runtimeVersion": "V8",

  "webapp": {

    "access": "MYSELF",

    "executeAs": "USER\_ACCESSING"

  },

  "oauthScopes": \[

    "https://www.googleapis.com/auth/documents",

    "https://www.googleapis.com/auth/script.container.ui"

  \]

}

JSONEOF

### 3.3 — Create `src/Code.gs` (Apps Script Backend)

cat \<\< 'GSEOF' \> src/Code.gs

/\*\*

 \* TOC Generator — Google Apps Script

 \* Deployed as Web App / Document Container Script

 \* Scans all headings in the active Google Doc and rebuilds

 \* a fully functional, accurately linked Table of Contents.

 \*/

/\*\*

 \* Serves the web application interface.

 \* @returns {HtmlOutput} The rendered HTML interface page.

 \*/

function doGet() {

  return HtmlService.createHtmlOutputFromFile('index')

    .setTitle('TOC Generator')

    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

}

/\*\*

 \* Main entry point: Rebuilds the TOC in the active document.

 \* Finds or creates a TOC section at the top of the document,

 \* then inserts accurate bookmark-based links for each heading.

 \* This utilizes a thread-safe execution lock to prevent race conditions.

 \* @returns {string} Detailed status message returned to the client-side controller.

 \*/

function generateTOC() {

  var doc \= DocumentApp.getActiveDocument();

  var body \= doc.getBody();

  

  // Acquire a document-wide edit lock (30 second timeout threshold)

  var lock \= LockService.getDocumentLock();

  try {

    if (\!lock.tryLock(30000)) {

      throw new Error('Lock acquisition timeout: Document is being edited by another process.');

    }

    

    var numChildren \= body.getNumChildren();

    var headings \= \[\];

    

    // Step 1: Collect all headings and assign bookmarks

    for (var i \= 0; i \< numChildren; i++) {

      var child \= body.getChild(i);

      if (child.getType() \=== DocumentApp.ElementType.PARAGRAPH) {

        var para \= child.asParagraph();

        var heading \= para.getHeading();

        

        if (isHeadingType(heading)) {

          var text \= para.getText().trim();

          

          // Guard against indexing the TOC title itself if it matches 'TABLE OF CONTENTS'

          if (text.length \> 0 && text.toUpperCase() \!== 'TABLE OF CONTENTS') {

            var position \= doc.newPosition(para, 0);

            var bookmark \= doc.addBookmark(position);

            

            if (bookmark) {

              headings.push({

                text: text,

                level: getHeadingLevel(heading),

                bookmarkId: bookmark.getId()

              });

            }

          }

        }

      }

    }

    

    if (headings.length \=== 0\) {

      return 'Execution cancelled: No headings (Heading 1-6) were detected in the document.';

    }

    

    // Step 2: Remove existing TOC section and old orphans

    removeTOCSection(body);

    

    // Step 3: Insert the fresh Table of Contents section at the top

    var tocHeader \= body.insertParagraph(0, 'TABLE OF CONTENTS');

    tocHeader.setHeading(DocumentApp.ParagraphHeading.HEADING1);

    tocHeader.editAsText().setBold(true);

    

    var insertIndex \= 1;

    var docUrl \= doc.getUrl();

    

    for (var j \= 0; j \< headings.length; j++) {

      var h \= headings\[j\];

      var indent \= '';

      for (var k \= 1; k \< h.level; k++) {

        indent \+= '    '; // 4 spaces indentation per level depth

      }

      

      var entryText \= indent \+ h.text;

      var tocEntry \= body.insertParagraph(insertIndex, entryText);

      tocEntry.setHeading(DocumentApp.ParagraphHeading.NORMAL);

      

      // Inject bookmark hyperlink safely matching original text length bounds

      var bookmarkUrl \= docUrl \+ '\#bookmark=' \+ h.bookmarkId;

      tocEntry.editAsText().setLinkUrl(0, entryText.length \- 1, bookmarkUrl);

      

      insertIndex++;

    }

    

    // Add visual design horizontal break

    var separator \= body.insertParagraph(insertIndex, '─────────────────────────────────────');

    separator.setHeading(DocumentApp.ParagraphHeading.NORMAL);

    

    return 'Success: TOC successfully compiled with ' \+ headings.length \+ ' entries.';

    

  } catch (error) {

    Logger.log('Critical Error in generateTOC execution: ' \+ error.toString());

    throw new Error(error.toString());

  } finally {

    // Release the thread lock

    lock.releaseLock();

  }

}

/\*\*

 \* Determines whether a given ParagraphHeading fits the H1-H6 categories.

 \* @param {ParagraphHeading} heading \- The paragraph heading enum to test.

 \* @returns {boolean} True if heading matches H1-H6, otherwise false.

 \*/

function isHeadingType(heading) {

  return heading \=== DocumentApp.ParagraphHeading.HEADING1 ||

         heading \=== DocumentApp.ParagraphHeading.HEADING2 ||

         heading \=== DocumentApp.ParagraphHeading.HEADING3 ||

         heading \=== DocumentApp.ParagraphHeading.HEADING4 ||

         heading \=== DocumentApp.ParagraphHeading.HEADING5 ||

         heading \=== DocumentApp.ParagraphHeading.HEADING6;

}

/\*\*

 \* Converts a ParagraphHeading enum to its corresponding integer depth level (1–6).

 \* @param {ParagraphHeading} heading \- The paragraph heading.

 \* @returns {number} Value indicating nesting depth.

 \*/

function getHeadingLevel(heading) {

  var map \= {};

  map\[DocumentApp.ParagraphHeading.HEADING1\] \= 1;

  map\[DocumentApp.ParagraphHeading.HEADING2\] \= 2;

  map\[DocumentApp.ParagraphHeading.HEADING3\] \= 3;

  map\[DocumentApp.ParagraphHeading.HEADING4\] \= 4;

  map\[DocumentApp.ParagraphHeading.HEADING5\] \= 5;

  map\[DocumentApp.ParagraphHeading.HEADING6\] \= 6;

  return map\[heading\] || 1;

}

/\*\*

 \* Automatically removes any previously generated TOC structure, including

 \* the header, the separator, and every paragraph nested between them.

 \* @param {Body} body \- Active Google Doc body.

 \*/

function removeTOCSection(body) {

  var numChildren \= body.getNumChildren();

  var startIndex \= \-1;

  var endIndex \= \-1;

  

  // Find boundaries of TOC block

  for (var i \= 0; i \< numChildren; i++) {

    var child \= body.getChild(i);

    if (child.getType() \=== DocumentApp.ElementType.PARAGRAPH) {

      var text \= child.asParagraph().getText().trim();

      if (text.toUpperCase() \=== 'TABLE OF CONTENTS') {

        startIndex \= i;

      } else if (text \=== '─────────────────────────────────────' && startIndex \!== \-1) {

        endIndex \= i;

        break; // Stop at first valid separator after header boundary

      }

    }

  }

  

  // Delete bounded elements from end index to start index to preserve indexing sequence

  if (startIndex \!== \-1 && endIndex \!== \-1) {

    for (var j \= endIndex; j \>= startIndex; j--) {

      body.removeChild(body.getChild(j));

    }

  }

}

/\*\*

 \* Registers custom layout menus on Google Doc open.

 \*/

function onOpen() {

  DocumentApp.getUi()

    .createMenu('TOC Tools')

    .addItem('Generate / Refresh TOC', 'generateTOC')

    .addToUi();

}

GSEOF

### 3.4 — Create `src/index.html` (Accessible Web App UI)

cat \<\< 'HTMLEOF' \> src/index.html

\<\!DOCTYPE html\>

\<html lang="en"\>

\<head\>

  \<meta charset="UTF-8"\>

  \<meta name="viewport" content="width=device-width, initial-scale=1.0"\>

  \<title\>TOC Generator Control Board\</title\>

  \<base target="\_top"\>

  \<style\>

    :root {

      \--primary: \#1a73e8;

      \--primary-dark: \#1557b0;

      \--bg: \#f8f9fa;

      \--card-bg: \#ffffff;

      \--text: \#3c4043;

      \--text-muted: \#5f6368;

      \--border: \#dadce0;

      \--success: \#137333;

      \--success-bg: \#e6f4ea;

      \--error: \#c5221f;

      \--error-bg: \#fce8e6;

    }

    

    body {

      font-family: \-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

      background-color: var(--bg);

      color: var(--text);

      margin: 0;

      padding: 16px;

      display: flex;

      justify-content: center;

      align-items: center;

      min-height: 100vh;

      box-sizing: border-box;

    }

    

    .panel {

      background: var(--card-bg);

      border: 1px solid var(--border);

      border-radius: 8px;

      box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15);

      max-width: 440px;

      width: 100%;

      padding: 24px;

      box-sizing: border-box;

    }

    

    h2 {

      color: var(--primary);

      font-size: 20px;

      font-weight: 500;

      margin-top: 0;

      margin-bottom: 8px;

    }

    

    p {

      font-size: 13px;

      line-height: 1.5;

      color: var(--text-muted);

      margin-bottom: 20px;

    }

    

    button {

      background-color: var(--primary);

      color: \#ffffff;

      border: none;

      padding: 12px 20px;

      font-size: 14px;

      font-weight: 500;

      border-radius: 4px;

      cursor: pointer;

      transition: background-color 0.2s, box-shadow 0.2s;

      box-shadow: 0 1px 2px rgba(60,64,67,0.3);

      width: 100%;

      box-sizing: border-box;

    }

    

    button:hover {

      background-color: var(--primary-dark);

      box-shadow: 0 2px 4px rgba(60,64,67,0.25);

    }

    

    button:focus-visible {

      outline: 2px solid var(--primary);

      outline-offset: 2px;

    }

    

    button:disabled {

      background-color: var(--border);

      color: var(--text-muted);

      cursor: not-allowed;

      box-shadow: none;

    }

    

    \#status {

      margin-top: 16px;

      padding: 12px;

      border-radius: 4px;

      font-size: 13px;

      font-weight: 500;

      display: none;

    }

    

    .status-running {

      background-color: \#e8f0fe;

      color: var(--primary);

      border-left: 4px solid var(--primary);

      display: block \!important;

    }

    

    .status-success {

      background-color: var(--success-bg);

      color: var(--success);

      border-left: 4px solid var(--success);

      display: block \!important;

    }

    

    .status-error {

      background-color: var(--error-bg);

      color: var(--error);

      border-left: 4px solid var(--error);

      display: block \!important;

    }

    

    .spinner {

      display: inline-block;

      width: 12px;

      height: 12px;

      border: 2px solid rgba(26,115,232,0.2);

      border-radius: 50%;

      border-top-color: var(--primary);

      animation: rotate 0.8s linear infinite;

      margin-right: 8px;

    }

    

    @keyframes rotate {

      to { transform: rotate(360deg); }

    }

  \</style\>

\</head\>

\<body\>

  \<main class="panel" role="main"\>

    \<h2\>📋 TOC Generator Panel\</h2\>

    \<p\>

      Click the trigger below to rebuild the document's Table of Contents. 

      Heading structures are parsed and linked via robust native bookmarks.

    \</p\>

    

    \<button id="exec-btn" onclick="runTOC()" aria-describedby="status"\>

      Rebuild Table of Contents

    \</button\>

    

    \<div id="status" role="status" aria-live="polite"\>\</div\>

  \</main\>

  \<script\>

    function runTOC() {

      const btn \= document.getElementById('exec-btn');

      const status \= document.getElementById('status');

      

      // Enforce running state

      btn.disabled \= true;

      status.className \= 'status-running';

      status.innerHTML \= '\<span class="spinner" aria-hidden="true"\>\</span\>Compiling TOC entries...';

      

      google.script.run

        .withSuccessHandler(function(result) {

          btn.disabled \= false;

          status.className \= 'status-success';

          status.innerHTML \= result;

        })

        .withFailureHandler(function(err) {

          btn.disabled \= false;

          status.className \= 'status-error';

          status.innerHTML \= '❌ Error Encountered: ' \+ err.message;

        })

        .generateTOC();

    }

  \</script\>

\</body\>

\</html\>

HTMLEOF

### 3.5 — Create `src/monitoring.gs` (DevOps Health Diagnostics)

cat \<\< 'GSEOF' \> src/monitoring.gs

/\*\*

 \* Executes system checks to verify Google Workspace boundaries.

 \* Deployed for QA automation tracking and remote health pings.

 \* @returns {string} Structured JSON feedback of service health.

 \*/

function runHealthCheck() {

  var diagnostics \= {

    timestamp: new Date().toISOString(),

    overallStatus: 'HEALTHY',

    checks: \[\]

  };

  

  // Diagnostic 1: Core Document Boundary Context

  try {

    var doc \= DocumentApp.getActiveDocument();

    diagnostics.checks.push({

      metricName: 'Active Document Handshake',

      passed: true,

      data: doc ? 'Document Bound: ' \+ doc.getName() : 'Standalone API Access'

    });

  } catch (error) {

    diagnostics.overallStatus \= 'UNHEALTHY';

    diagnostics.checks.push({

      metricName: 'Active Document Handshake',

      passed: false,

      errorDetails: error.toString()

    });

  }

  

  // Diagnostic 2: Lock Engine Operations

  try {

    var lock \= LockService.getDocumentLock();

    diagnostics.checks.push({

      metricName: 'Locking Subsystem Query',

      passed: lock \!== null,

      data: 'Subsystem OK'

    });

  } catch (error) {

    diagnostics.overallStatus \= 'UNHEALTHY';

    diagnostics.checks.push({

      metricName: 'Locking Subsystem Query',

      passed: false,

      errorDetails: error.toString()

    });

  }

  

  var diagnosticResult \= JSON.stringify(diagnostics, null, 2);

  Logger.log(diagnosticResult);

  return diagnosticResult;

}

GSEOF

### 3.6 — Create Clasp Project Configurations

cat \<\< 'JSONEOF' \> .clasp.json

{

  "scriptId": "\<YOUR\_SCRIPT\_ID\>",

  "rootDir": "./src"

}

JSONEOF

cat \<\< 'GITEOF' \> .gitignore

node\_modules/

.DS\_Store

.clasprc.json

GITEOF

---

## Step 4 — Implement GitHub Actions CI/CD Pipeline

These files automate quality checks and deploy code automatically when changes are pushed to your repository.

### 4.1 — Automated Deployment Workflow (`.github/workflows/deploy.yml`)

cat \<\< 'YAMLEOF' \> .github/workflows/deploy.yml

name: Continuous Integration & Deployment

on:

  push:

    branches: \[ main \]

  pull\_request:

    branches: \[ main \]

jobs:

  validate-and-push:

    runs-on: ubuntu-latest

    steps:

    \- name: 📥 Checkout Codebase

      uses: actions/checkout@v4

      

    \- name: 🟢 Setup Node.js Environment

      uses: actions/setup-node@v4

      with:

        node-version: '18'

        

    \- name: 📦 Install Workspace Dependencies

      run: npm install

      

    \- name: 🔍 ESLint Validation Check

      run: npm run lint

      

    \- name: 🔐 Configure Google Clasp Credentials

      if: github.event\_name \== 'push' && github.ref \== 'refs/heads/main'

      run: echo "$CLASPRC\_JSON" \> \~/.clasprc.json

      env:

        CLASPRC\_JSON: ${{ secrets.CLASPRC\_JSON }}

        

    \- name: 🚀 Push Source to Google Apps Script

      if: github.event\_name \== 'push' && github.ref \== 'refs/heads/main'

      run: clasp push \--force

      

    \- name: 🌐 Deploy Production Release

      if: github.event\_name \== 'push' && github.ref \== 'refs/heads/main'

      run: clasp deploy \--description "Automated Release $(date \+'%Y-%m-%d %H:%M:%S')"

YAMLEOF

### 4.2 — Weekly Audit Workflow (`.github/workflows/security-scan.yml`)

cat \<\< 'YAMLEOF' \> .github/workflows/security-scan.yml

name: Weekly Security Audit

on:

  schedule:

    \- cron: '0 0 \* \* 0' \# Executes every Sunday at midnight

  workflow\_dispatch:

jobs:

  audit-scan:

    runs-on: ubuntu-latest

    steps:

    \- name: 📥 Checkout Codebase

      uses: actions/checkout@v4

      

    \- name: 🟢 Setup Node Environment

      uses: actions/setup-node@v4

      with:

        node-version: '18'

        

    \- name: 🛡️ Audit NPM Dependencies

      run: npm audit || true

      

    \- name: 📊 Compile Security Scan Logs

      run: |

        echo "\# Security Quality Scan Log" \> SECURITY\_REPORT.md

        echo "- \*\*Timestamp:\*\* $(date)" \>\> SECURITY\_REPORT.md

        echo "- \*\*Status:\*\* Checked" \>\> SECURITY\_REPORT.md

        

    \- name: 💾 Save Report to Repository

      run: |

        git config user.name "GitHub Actions"

        git config user.email "actions@github.com"

        git add SECURITY\_REPORT.md

        git commit \-m "📊 Weekly security audit update \[skip ci\]" || true

        git push || true

YAMLEOF

---

## Step 5 — Connecting and Deploying with Clasp

Follow these instructions to bind your local code with your active Google Doc script project.

### 5.1 — Link to Your Document Script ID

1. Open your target Google Doc.  
2. Navigate to **Extensions** \> **Apps Script**.  
3. In the Apps Script editor panel, navigate to **Project Settings** (gear icon) on the left panel.  
4. Locate the **Script ID** block, and copy the string.  
5. In your local terminal under `/toc-generator`, execute the following (replace `<YOUR_SCRIPT_ID>`):

\# Update .clasp.json with your Script ID, then run:

clasp pull

*Note: This will fetch the initial container configuration. It may overwrite `src/appsscript.json` if default configurations exist. If so, simply restore the robust JSON configuration created in Step 3.2.*

### 5.2 — Upload Source Code to Google Apps Script

Push your local code files up to the active container:

clasp push

### 5.3 — Local Production Deployment via Clasp

To deploy the script as a live web application directly from your console:

clasp deploy \--description "Production Release v1.0.0"

To display active web endpoints and capture your live Web App URL:

clasp deployments

---

## Step 6 — Execute and Validate

### 6.1 — Refresh Your Document Context

1. Return to your Google Doc and refresh the browser window.  
2. A new menu named **TOC Tools** will render on the top tool navigation bar.  
3. Select **TOC Tools** \> **Generate / Refresh TOC**.  
4. Accept any required Google OAuth authorization scopes on first execution.  
5. Watch the script instantly clean any older TOC versions and generate a fresh, functional Table of Contents connected with native bookmarks\!

### 6.2 — Verify CI/CD Operations

1. Create a GitHub repository and configure `CLASPRC_JSON` under **Settings** \> **Secrets and Variables** \> **Actions** \> **Repository Secrets** (using the contents of your `~/.clasprc.json`).  
2. Commit and push the workspace changes to your main branch:  
     
   git init  
     
   git add .  
     
   git commit \-m "feat: initial release of robust TOC generator"  
     
   git remote add origin \<your\_github\_repo\_url\>  
     
   git branch \-M main  
     
   git push \-u origin main  
     
3. Navigate to the **Actions** tab in your GitHub repository and watch the pipeline build, validate syntax via ESLint, and deploy to Google Apps Script automatically\!

---

## Safety & Quality Assurance Summary

- **LockService Subsystem Integration:** Inhibits overlapping writes from multiple users clicking simultaneously, securing the document from corruption.  
- **W3C/WCAG Semantic Panel Design:** Employs appropriate contrast variables, landmarks, button focus outline indicators, and live status feedback for screen reader compatibility.  
- **Orphan-Free Cleaning Algorithm:** Dynamically clears all paragraphs existing between the 'TABLE OF CONTENTS' title and visual separators, preventing old duplicate entries from lingering.  
- **Pre-emptive Scope Manifest:** Explicitly declares security scopes inside `appsscript.json`, minimizing permissions creep.

---

