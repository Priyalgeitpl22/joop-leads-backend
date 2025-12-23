/**
 * Debug script - Run this with VS Code debugger to step through schedulerTick
 * 
 * 1. Open this file
 * 2. Set breakpoints in scheduler.ts where you want to pause
 * 3. Press F5 or go to Run > Start Debugging
 * 4. Select "Debug Current File"
 */

import { schedulerTick } from "./scheduler";

async function main() {
  console.log("Starting debug tick...");
  
  try {
    await schedulerTick();
    console.log("Debug tick completed successfully");
  } catch (error) {
    console.error("Debug tick failed:", error);
  }
  
  process.exit(0);
}

main();

