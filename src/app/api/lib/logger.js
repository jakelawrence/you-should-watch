import fs from "fs";
import path from "path";

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Generate timestamp for log files
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, -5); // Remove milliseconds and colons
};

// Create log file paths
const timestamp = getTimestamp();
const logFile = path.join(logsDir, `recommendations-${timestamp}.log`);
const errorFile = path.join(logsDir, `recommendations-errors-${timestamp}.log`);

// Custom logging functions
const logger = {
  log: (message, ...args) => {
    const fullMessage = `[${new Date().toISOString()}] ${message} ${args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg))
      .join(" ")}\n`;

    // Write to file
    fs.appendFileSync(logFile, fullMessage);

    // Also log to console (optional - you can remove this)
    console.log(message, ...args);
  },

  error: (message, ...args) => {
    const fullMessage = `[${new Date().toISOString()}] ERROR: ${message} ${args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg))
      .join(" ")}\n`;

    // Write to both files
    fs.appendFileSync(logFile, fullMessage);
    fs.appendFileSync(errorFile, fullMessage);

    // Also log to console (optional)
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
