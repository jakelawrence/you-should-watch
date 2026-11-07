import fs from "fs";
import path from "path";

// File logging is a local-development convenience only. Hosted runtimes (Amplify, Vercel)
// have read-only or ephemeral filesystems and capture console output instead.
const writeLogFiles = process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";

const logsDir = path.join(process.cwd(), "logs");

if (writeLogFiles) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    console.error("Failed to create logs directory:", error.message);
  }
}

// Generate timestamp for log files
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
};

// Create log file paths
const timestamp = getTimestamp();
const logFile = path.join(logsDir, `recommendations-${timestamp}.log`);
const errorFile = path.join(logsDir, `recommendations-errors-${timestamp}.log`);

// Helper to safely write to file (development only)
const writeToFile = (filePath, message) => {
  if (writeLogFiles) {
    try {
      fs.appendFileSync(filePath, message);
    } catch (error) {
      console.error("Failed to write to log file:", error.message);
    }
  }
};

// Custom logging functions
const logger = {
  log: (message, ...args) => {
    const fullMessage = `[${new Date().toISOString()}] ${message} ${args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg))
      .join(" ")}\n`;

    // Write to file only in development
    writeToFile(logFile, fullMessage);

    // Always log to console (hosted runtimes capture this)
    console.log(message, ...args);
  },

  error: (message, ...args) => {
    const fullMessage = `[${new Date().toISOString()}] ERROR: ${message} ${args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg))
      .join(" ")}\n`;

    // Write to both files only in development
    writeToFile(logFile, fullMessage);
    writeToFile(errorFile, fullMessage);

    // Always log to console
    console.error(message, ...args);
  },

  info: (message, ...args) => {
    logger.log(`INFO: ${message}`, ...args);
  },

  debug: (message, ...args) => {
    logger.log(`DEBUG: ${message}`, ...args);
  },

  warn: (message, ...args) => {
    logger.log(`WARN: ${message}`, ...args);
  },
};

export { logger };
