import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  requestId?: string;
  source?: string;
  target?: string;
  operation?: string;
  message: string;
  durationMs?: number;
  success?: boolean;
  errorCode?: string;
  errorDetails?: any;
  trace?: string[];
}

export class GatewayLogger {
  private logFilePath: string;
  private consoleOutput: boolean;
  private maxFileSize: number;
  private maxFiles: number;

  constructor(options?: {
    logFilePath?: string;
    consoleOutput?: boolean;
    maxFileSize?: number;
    maxFiles?: number;
  }) {
    this.logFilePath = options?.logFilePath || path.join(process.cwd(), 'gateway.log');
    this.consoleOutput = options?.consoleOutput ?? true;
    this.maxFileSize = options?.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options?.maxFiles || 5;

    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private rotateLogsIfNeeded(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size >= this.maxFileSize) {
          this.rotateLogs();
        }
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  private rotateLogs(): void {
    // Delete oldest file if exists
    const oldestFile = `${this.logFilePath}.${this.maxFiles}`;
    if (fs.existsSync(oldestFile)) {
      fs.unlinkSync(oldestFile);
    }

    // Rotate files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldFile = `${this.logFilePath}.${i}`;
      const newFile = `${this.logFilePath}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile);
      }
    }

    // Rename current log file
    fs.renameSync(this.logFilePath, `${this.logFilePath}.1`);
  }

  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      entry.timestamp,
      `[${entry.level}]`,
      entry.requestId && `req:${entry.requestId}`,
      entry.source && `src:${entry.source}`,
      entry.target && `tgt:${entry.target}`,
      entry.operation && `op:${entry.operation}`,
      `- ${entry.message}`,
      entry.durationMs !== undefined && `(${entry.durationMs}ms)`,
      entry.success !== undefined && `success:${entry.success}`,
      entry.errorCode && `error:${entry.errorCode}`,
      entry.trace && `trace:[${entry.trace.join('→')}]`
    ].filter(Boolean);

    return parts.join(' ');
  }

  private writeToFile(entry: LogEntry): void {
    try {
      this.rotateLogsIfNeeded();
      const logLine = this.formatLogEntry(entry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const emoji = {
      INFO: '📝',
      WARN: '⚠️',
      ERROR: '❌',
      DEBUG: '🔍'
    }[entry.level];

    const consoleMessage = this.formatLogEntry(entry);
    const fullMessage = `${emoji} ${consoleMessage}`;

    switch (entry.level) {
      case 'ERROR':
        console.error(fullMessage);
        break;
      case 'WARN':
        console.warn(fullMessage);
        break;
      case 'DEBUG':
        console.debug(fullMessage);
        break;
      default:
        console.log(fullMessage);
    }
  }

  log(entry: Omit<LogEntry, 'timestamp'>): void {
    const fullEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };

    if (this.consoleOutput) {
      this.writeToConsole(fullEntry);
    }

    this.writeToFile(fullEntry);
  }

  info(message: string, metadata?: Partial<LogEntry>): void {
    this.log({
      level: 'INFO',
      message,
      ...metadata
    });
  }

  warn(message: string, metadata?: Partial<LogEntry>): void {
    this.log({
      level: 'WARN',
      message,
      ...metadata
    });
  }

  error(message: string, metadata?: Partial<LogEntry>): void {
    this.log({
      level: 'ERROR',
      message,
      ...metadata
    });
  }

  debug(message: string, metadata?: Partial<LogEntry>): void {
    this.log({
      level: 'DEBUG',
      message,
      ...metadata
    });
  }

  logContractRouting(contract: any, durationMs: number, success: boolean, error?: any): void {
    const metadata: Partial<LogEntry> = {
      requestId: contract.metadata?.requestId,
      source: contract.source,
      target: contract.target,
      operation: contract.operation,
      durationMs,
      success,
      errorCode: error?.code,
      errorDetails: error?.details,
      trace: contract.metadata?.context?.trace
    };

    if (success) {
      this.info(`Contract routed successfully`, metadata);
    } else {
      this.error(`Contract routing failed`, metadata);
    }
  }

  logTargetRegistration(target: string): void {
    this.info(`Target registered`, { target });
  }

  logTargetUnregistration(target: string): void {
    this.info(`Target unregistered`, { target });
  }

  logCycleDetection(cycleKey: string, trace?: string[]): void {
    this.warn(`Cycle detected`, {
      message: `Routing cycle detected: ${cycleKey}`,
      trace
    });
  }

  logRetryAttempt(contract: any, attempt: number, maxAttempts: number): void {
    this.info(`Retry attempt ${attempt}/${maxAttempts}`, {
      requestId: contract.metadata?.requestId,
      source: contract.source,
      target: contract.target,
      operation: contract.operation
    });
  }

  getLogStats(): { fileSize: number; lineCount: number; lastModified: Date | null } {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return { fileSize: 0, lineCount: 0, lastModified: null };
      }

      const stats = fs.statSync(this.logFilePath);
      const content = fs.readFileSync(this.logFilePath, 'utf8');
      const lineCount = content.split('\n').filter(line => line.trim()).length;

      return {
        fileSize: stats.size,
        lineCount,
        lastModified: stats.mtime
      };
    } catch (error) {
      return { fileSize: 0, lineCount: 0, lastModified: null };
    }
  }

  clearLogs(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, '', 'utf8');
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }
}

// Singleton instance
export const gatewayLogger = new GatewayLogger();
