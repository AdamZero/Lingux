export interface LogMetadata {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  environment: string;
  metadata?: LogMetadata;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}
