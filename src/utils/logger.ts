import { join } from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const ANSI_COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
} as const;

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: ANSI_COLORS.gray,
  [LogLevel.INFO]: ANSI_COLORS.cyan,
  [LogLevel.WARN]: ANSI_COLORS.yellow,
  [LogLevel.ERROR]: ANSI_COLORS.red,
};

const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

export class Logger {
  private static instance: Logger | null = null;
  private level: LogLevel = LogLevel.INFO;
  private useColors: boolean = true;
  private logFile: string | null = null;
  private logRotationSize: number = 10 * 1024 * 1024;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setColors(enabled: boolean): void {
    this.useColors = enabled;
  }

  enableFileLogging(logDir: string, rotationSize?: number): void {
    this.logFile = join(logDir, 'kairos.log');
    if (rotationSize !== undefined) {
      this.logRotationSize = rotationSize;
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const levelLabel = LOG_LEVEL_LABELS[level];
    
    let formatted: string;
    if (context) {
      formatted = `[${timestamp}] [${levelLabel}] [${context}] ${message}`;
    } else {
      formatted = `[${timestamp}] [${levelLabel}] ${message}`;
    }
    
    if (this.useColors) {
      const color = LOG_LEVEL_COLORS[level];
      return `${color}${formatted}${ANSI_COLORS.reset}`;
    }
    
    return formatted;
  }

  private async writeToFile(message: string): Promise<void> {
    if (!this.logFile) return;
    
    try {
      const file = Bun.file(this.logFile);
      let content = '';
      
      if (await file.exists()) {
        content = await file.text();
        
        if (content.length > this.logRotationSize) {
          const rotatedPath = `${this.logFile}.${Date.now()}`;
          await Bun.write(rotatedPath, content);
          content = '';
        }
      }
      
      await Bun.write(this.logFile, content + message + '\n');
    } catch {
      // Silently fail if we can't write to log file
    }
  }

  private async log(level: LogLevel, message: string, context?: string): Promise<void> {
    if (level < this.level) return;
    
    const formatted = this.formatMessage(level, message, context);
    console.log(formatted);
    await this.writeToFile(formatted);
  }

  async debug(message: string, context?: string): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context);
  }

  async info(message: string, context?: string): Promise<void> {
    await this.log(LogLevel.INFO, message, context);
  }

  async warn(message: string, context?: string): Promise<void> {
    await this.log(LogLevel.WARN, message, context);
  }

  async error(message: string, context?: string): Promise<void> {
    await this.log(LogLevel.ERROR, message, context);
  }

  async child(context: string): Promise<ChildLogger> {
    return new ChildLogger(this, context);
  }
}

export class ChildLogger {
  private parent: Logger;
  private context: string;

  constructor(parent: Logger, context: string) {
    this.parent = parent;
    this.context = context;
  }

  async debug(message: string): Promise<void> {
    await this.parent.debug(message, this.context);
  }

  async info(message: string): Promise<void> {
    await this.parent.info(message, this.context);
  }

  async warn(message: string): Promise<void> {
    await this.parent.warn(message, this.context);
  }

  async error(message: string): Promise<void> {
    await this.parent.error(message, this.context);
  }
}

export const logger = Logger.getInstance();
