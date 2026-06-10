# **Table of Contents Generator Project**

This document outlines the requirements and implementation details for the Google Docs Table of Contents (TOC) Generator. The goal is to provide a sidebar interface that allows users to scan their document for headings and generate a dynamic, linked table of contents at the cursor position.

# **Project Overview**

The solution consists of a Google Apps Script project that parses document structure, identifies `HEADING` styles, and builds a list of internal links.

## **File Structure**

* **Code.gs**: Core server-side logic and menu creation.  
* **index.html**: Frontend sidebar interface.  
* **monitoring.gs**: Error handling and execution logging.  
* **appsscript.json**: Project manifest and permissions.  
* **pipeline.yml**: CI/CD configuration for automated deployment via Clasp.

# **Core Implementation**

## **Code.gs**

/\*\*

 \* Creates a custom menu in the Google Docs UI.

 \*/

function onOpen() {

  DocumentApp.getUi()

    .createMenu('TOC Helper')

    .addItem('Open Generator', 'showSidebar')

    .addToUi();

}

/\*\*

 \* Opens the sidebar interface.

 \*/

function showSidebar() {

  const html \= HtmlService.createTemplateFromFile('index')

    .evaluate()

    .setTitle('TOC Generator')

    .setWidth(300);

  DocumentApp.getUi().showSidebar(html);

}

/\*\*

 \* Scans the document and generates the TOC at the current cursor position.

 \*/

function generateTOC() {

  const doc \= DocumentApp.getActiveDocument();

  const body \= doc.getBody();

  const paragraphs \= body.getParagraphs();

  const tocEntries \= \[\];

  paragraphs.forEach(p \=\> {

    const type \= p.getHeading();

    if (type \!== DocumentApp.ParagraphHeading.NORMAL && type \!== DocumentApp.ParagraphHeading.TITLE) {

      tocEntries.push({

        text: p.getText(),

        headingType: type.toString(),

        element: p

      });

    }

  });

  if (tocEntries.length \=== 0\) {

    throw new Error('No headings found in the document.');

  }

  insertTOC(doc, tocEntries);

  return "TOC Generated Successfully";

}

function insertTOC(doc, entries) {

  const cursor \= doc.getCursor();

  let element \= cursor ? cursor.getElement() : doc.getBody().getChild(0);

  

  entries.forEach(entry \=\> {

    const text \= doc.getBody().appendParagraph(entry.text);

    text.setHeading(DocumentApp.ParagraphHeading.NORMAL);

    // Logic for internal linking would be expanded here

  });

}

## **index.html**

l\<\!DOCTYPE html\>\<html\>  
  \<head\>  
    \<base target="\_top"\>  
    \<style\>  
      body { font-family: 'Inter', sans-serif; padding: 15px; color: \#333; }  
      .button {   
        background-color: \#4285f4;   
        color: white;   
        padding: 10px 20px;   
        border: none;   
        border-radius: 4px;   
        cursor: pointer;  
        width: 100%;  
      }  
      .button:disabled { background-color: \#ccc; }  
      \#status { margin-top: 15px; font-size: 0.9em; }  
    \</style\>  
  \</head\>  
  \<body\>  
    \<h3\>TOC Generator\</h3\>  
    \<p\>Click the button below to scan your document and insert a table of contents at your cursor position.\</p\>  
    \<button class="button" onclick="runGenerator()" id="genBtn"\>Generate TOC\</button\>  
    \<div id="status"\>\</div\>\<script\>

  function runGenerator() {

    const btn \= document.getElementById('genBtn');

    const status \= document.getElementById('status');

    btn.disabled \= true;

    status.innerText \= 'Processing...';

    google.script.run

      .withSuccessHandler((msg) \=\> {

        status.innerText \= msg;

        btn.disabled \= false;

      })

      .withFailureHandler((err) \=\> {

        status.innerText \= 'Error: ' \+ err.message;

        btn.disabled \= false;

      })

      .generateTOC()  
;  
}  
  \</body\>  
\</html\>  
\`\`\`

## **monitoring.gs**

/\*\*

 \* Custom logging utility for tracking execution and errors.

 \*/

function logExecution(action, status, details) {

  const logSheetId \= \<span type="placeholder" placeholder-type="file"\>\</span\>;

  try {

    const ss \= SpreadsheetApp.openById(logSheetId);

    const sheet \= ss.getSheets()\[0\];

    sheet.appendRow(\[new Date(), action, status, details, Session.getActiveUser().getEmail()\]);

  } catch (e) {

    console.error("Failed to log execution: " \+ e.message);

  }

}

function handleError(error) {

  logExecution("ERROR", "FAILED", error.toString());

  throw error;

}

# **Configuration & Metadata**

## **appsscript.json**

{

  "timeZone": "America/New\_York",

  "dependencies": {

    "enabledAdvancedServices": \[\]

  },

  "exceptionLogging": "STACKDRIVER",

  "runtimeVersion": "V8",

  "webapp": {

    "executeAs": "USER\_ACCESSING",

    "access": "ANYONE"

  }

}

## **CI/CD Pipeline (pipeline.yml)**

name: Deploy to Google Apps Script

on:

  push:

    branches:

      \- main

jobs:

  deploy:

    runs-on: ubuntu-latest

    steps:

      \- name: Checkout Code

        uses: actions/checkout@v3

      \- name: Setup Node.js

        uses: actions/setup-node@v3

        with:

          node-version: '16'

      \- name: Install Clasp

        run: npm install \-g @google/clasp

      \- name: Create Netrc

        run: |

          echo "default login ${{ secrets.CLASP\_USER\_EMAIL }} password ${{ secrets.CLASP\_USER\_TOKEN }}" \> \~/.netrc

      \- name: Push to Apps Script

        run: clasp push \-f

# **Task Checklist**

| Module | Status | Priority |
| :---- | :---- | :---- |
| UI Design | Pending | High |
| Header Parsing Logic | In-Progress | Critical |
| Internal Linking | Not Started | Medium |
| Logging Setup | Completed | Low |

The developer responsible for this task should ensure that all scopes are correctly authorized by Person before deployment on Date.