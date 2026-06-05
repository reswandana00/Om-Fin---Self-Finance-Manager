# Om Fin - Self Finance Manager

Om Fin is a mobile-first personal finance manager built with Next.js and Capacitor. It helps users record expenses with low-friction inputs: type a transaction, scan a receipt, or speak naturally in Indonesian. AI turns those inputs into editable transaction items before they are saved to the local finance database.

<img width="412" height="915" alt="Screenshot 2026-06-05 093400" src="https://github.com/user-attachments/assets/f873d126-2937-4186-b1a1-5e7467350171" />


## Features

- Dashboard for monthly balance, spending, budget usage, and category distribution.
- Text input for natural transaction descriptions, for example `beli kopi 25 ribu`.
- Receipt scanning from camera or gallery with AI extraction.
- Voice input using speech-to-text first, then an editable transcript before AI parsing.
- Editable AI confirmation screen before saving scanned or parsed transactions.
- Transaction history, spending categories, finance cards, notifications, and analysis pages.
- Local SQLite persistence through Capacitor Community SQLite and `sql.js` for web.
- Profile settings for balance, currency, notifications, PIN security, CSV export, data reset, and GitHub Models token storage.
- Android build support through Capacitor.

## Tech Stack

- Next.js 16 App Router with static export
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui components
- Capacitor 8
- Capacitor Community SQLite
- Capacitor Community Speech Recognition
- GitHub Models API for AI extraction and analysis

## Requirements

- Node.js 20 or newer
- npm
- Android Studio and JDK for Android builds
- A GitHub token with access to GitHub Models for AI features

## Getting Started

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Before using AI scan features, open the Profile page in the app and save your GitHub Models token. The token is stored locally in the browser or native app storage and is used by the client to call GitHub Models.

## Environment

The main app does not require a server-side API key because the token is configured from the Profile page. A local AI proxy script is still available for development experiments.

Copy the example file if you need to run the proxy:

```bash
cp .env.example .env
```

Optional variable:

```env
RECEIPT_AI_PORT=8787
```

Run the optional proxy:

```bash
npm run ai:server
```

## Common Commands

```bash
npm run dev       # Start Next.js development server
npm run build     # Copy SQLite assets and export the web build to out/
npm run lint      # Run ESLint
npx tsc --noEmit  # Type-check the project
```

## Android

Build the static web output and sync it into the native Android project:

```bash
npm run build
npx cap sync android
```

Open the Android project:

```bash
npx cap open android
```

Speech recognition is handled by `@capacitor-community/speech-recognition`. On Android, the plugin requests microphone permission through the native app. The voice flow converts speech to Indonesian text first, shows the transcript for editing, and only sends the edited text to the AI parser after the user presses Send.

## Project Structure

```text
app/                  Next.js routes and screens
components/           Reusable UI and app components
hooks/                Client-side React hooks
lib/                  Database, AI, security, profile, and domain logic
scripts/              Build helper scripts
public/assets/        Static runtime assets, including sql-wasm.wasm
android/              Capacitor Android project
```

## Data and Privacy Notes

- Finance data is stored locally in SQLite.
- The GitHub Models token is stored locally through app storage.
- AI features send the selected text, receipt image, or analysis context to GitHub Models.
- Voice input is converted to text on-device/native speech services before the text is shown for editing and sent to the AI parser.

## Release Checklist

1. Run `npm run lint`.
2. Run `npx tsc --noEmit`.
3. Run `npm run build`.
4. Run `npx cap sync android`.
5. Build or sign the APK/AAB from Android Studio.
