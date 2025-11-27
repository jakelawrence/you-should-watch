import fs from "fs";
import path from "path";

// Detect if running on Vercel or in production
const isVercel = process.env.VERCEL === "1";
const isProduction = process.env.NODE_ENV === "production";

// Use /tmp for Vercel (ephemeral), or local logs directory for development
const logsDir = isVercel ? "/tmp/logs" : path.join(process.cwd(), "logs");

// Only create logs directory in development (not on Vercel's read-only filesystem)
if (!isVercel && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
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

// Helper to safely write to file (skip on Vercel)
const writeToFile = (filePath, message) => {
  if (!isVercel) {
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

    // Always log to console (Vercel captures this)
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
