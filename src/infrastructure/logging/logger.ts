export type LogLevel = 'info' | 'warn' | 'error' | 'audit' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  timestamp: string;
}

class SystemLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 200;

  public log(level: LogLevel, message: string, context?: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      context,
      data,
      timestamp: new Date().toISOString()
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] ${context ? `[${context}]` : ''}`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'audit':
        console.info(`🛡️ ${prefix}`, message, data || '');
        break;
      case 'debug':
        console.debug(prefix, message, data || '');
        break;
      default:
        console.log(prefix, message, data || '');
        break;
    }
  }

  public info(message: string, context?: string, data?: any) {
    this.log('info', message, context, data);
  }

  public warn(message: string, context?: string, data?: any) {
    this.log('warn', message, context, data);
  }

  public error(message: string, context?: string, data?: any) {
    this.log('error', message, context, data);
  }

  public audit(message: string, context?: string, data?: any) {
    this.log('audit', message, context, data);
  }

  public getRecentLogs(): LogEntry[] {
    return [...this.logs];
  }
}

export const logger = new SystemLogger();
