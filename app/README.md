# Optia - Chrome Extension

A Chrome extension that analyzes web pages for SEO issues and provides AI-powered recommendations to improve search rankings.

## Prerequisites

Before you begin, you need to install two things on your computer:

### 1. Node.js

Node.js is a JavaScript runtime that lets you run the extension's code.

**Download and install from:** https://nodejs.org/

- Download the **LTS** (Long Term Support) version
- Run the installer and follow the prompts
- When done, restart your terminal/command prompt

**Verify installation:**
```bash
node --version
```
You should see something like `v22.15.0` (any version 18+ works)

### 2. pnpm (Package Manager)

pnpm is used to install the extension's dependencies.

**Install pnpm:**
```bash
npm install -g pnpm
```

**Verify installation:**
```bash
pnpm --version
```
You should see something like `9.x.x`

---

## Setup Instructions

### Step 1: Download the Code

Clone or download this repository from GitHub:

```bash
git clone https://github.com/YOUR-USERNAME/optia-extension.git
cd optia-extension
```

Or download the ZIP file from GitHub and extract it.

### Step 2: Install Dependencies

Open a terminal in the `app` folder and run:

```bash
cd app
pnpm install
```

This downloads all the required libraries. You'll see a progress bar and it may take a minute.

### Step 3: Build the Extension

Build the extension for Chrome:

```bash
pnpm build
```

This creates a `dist` folder with the built extension.

---

## Loading the Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`

2. Enable **Developer mode** (toggle in the top-right corner)

3. Click **Load unpacked**

4. Navigate to the `app/dist` folder inside this project and select it

5. The Optia extension icon should appear in your browser toolbar

---

## Using the Extension

1. Navigate to any website you want to analyze

2. Click the Optia icon in your toolbar

3. Enter your target keyword and click **Analyze**

4. Review the SEO score and recommendations

5. For AI-powered suggestions, add your OpenAI API key in Settings

---

## Development Mode (Optional)

If you want to make changes and see them live:

```bash
cd app
pnpm dev
```

This starts a development server. The extension will update automatically when you save changes.

**Note:** When running in dev mode, you'll access the extension through the browser at `http://localhost:5173` rather than as a Chrome extension.

---

## Testing

Run the test suite to verify everything works:

```bash
cd app
pnpm test
```

You should see all tests pass (283 tests currently).

---

## Troubleshooting

### "pnpm: command not found"

Make sure you installed pnpm globally:
```bash
npm install -g pnpm
```

Then close and reopen your terminal.

### "Cannot find module" errors

Try deleting `node_modules` and reinstalling:
```bash
cd app
rm -rf node_modules
pnpm install
```

### Extension not showing in Chrome

1. Make sure you ran `pnpm build`
2. Check that Developer mode is enabled in Chrome
3. Try removing and re-adding the extension

### Changes not appearing

If you made code changes, rebuild the extension:
```bash
pnpm build
```

Then go to `chrome://extensions/` and click the refresh icon on the extension.

---

## Project Structure

```
app/
├── dist/           # Built extension (load this in Chrome)
├── icons/          # Extension icons
├── src/            # Source code
│   ├── background/ # Service worker
│   ├── components/ # React components
│   ├── lib/        # Utilities (AI, storage, analysis)
│   └── sidepanel/  # Main extension UI
├── manifest.json   # Chrome extension configuration
└── package.json    # Dependencies and scripts
```

---

## Getting an OpenAI API Key

For AI-powered suggestions, you need an OpenAI API key:

1. Go to https://platform.openai.com/signup
2. Create an account or sign in
3. Navigate to API Keys in your account settings
4. Create a new secret key
5. Copy the key and paste it in the extension's Settings

**Note:** OpenAI API usage has associated costs. The extension uses GPT-4o-mini which is inexpensive (typically fractions of a cent per request).

---

## Questions?

If you run into issues, check the GitHub Issues page or open a new issue with:
- What you were trying to do
- The exact error message
- Your operating system (Windows/Mac/Linux)
