type LogLevel = "info" | "warn" | "error" | "debug";

type LogEntry = {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  service: string;
};

class Logger {
  private readonly service: string;
  private readonly isDebugMode: boolean;

  constructor(service: string) {
    this.service = service;
    this.isDebugMode =
      process.env.NODE_ENV === "development" ||
      process.env.DEBUG_LOGGING === "true";
  }

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      service: this.service,
    };

    // Format log entry
    const logString = `[${entry.timestamp}] [${entry.service}] [${level.toUpperCase()}] ${message}`;

    if (data) {
      console.log(logString, data);
    } else {
      console.log(logString);
    }
  }

  info(message: string, data?: any) {
    this.log("info", message, data);
  }

  warn(message: string, data?: any) {
    this.log("warn", message, data);
  }

  error(message: string, data?: any) {
    this.log("error", message, data);
  }

  debug(message: string, data?: any) {
    if (this.isDebugMode) {
      this.log("debug", message, data);
    }
  }
}

// Create logger instances for different services
export const youtubeLogger = new Logger("YOUTUBE");
export const chatLogger = new Logger("CHAT");
export const transcriptLogger = new Logger("TRANSCRIPT");
export const videoLogger = new Logger("VIDEOS");

// Export the Logger class for custom loggers
export { Logger };
