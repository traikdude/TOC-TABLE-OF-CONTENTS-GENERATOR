# Table of Contents Generator and Structurer

A Google Apps Script project and React application for analyzing document structure and generating automated, linked Tables of Contents.

## Features

- Scans Google Docs for heading structures and generates an automated Table of Contents
- Interactive React sidebar interface deployed via Google Apps Script Web App
- Gemini API integration for document structuring and text analysis
- Parses document attachments, including PDFs and images (via Tesseract.js and PDF.js)
- Automated deployment to Google Apps Script via Clasp and GitHub Actions CI/CD pipeline

## Install & Usage

Install the required dependencies:
```bash
npm install
```

Start the local development server (Vite):
```bash
npm run dev
```

Build the project and prepare the Google Apps Script distribution:
```bash
npm run build
```

Deploy to Google Apps Script:
```bash
npm install -g @google/clasp
clasp login
clasp push -f
```

## Tech Stack

React, TypeScript, Vite, Tailwind CSS, Google Apps Script (Clasp), Gemini API, Tesseract.js, PDF.js