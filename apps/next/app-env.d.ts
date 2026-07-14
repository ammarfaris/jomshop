/// <reference types="app/rnw-overrides" />

// Next.js only declares *.module.css; plain stylesheet side-effect imports
// (e.g. `import './globals.css'`) need this under TypeScript 6 (TS2882).
declare module '*.css'
