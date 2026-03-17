import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { maskSensitiveData } from './utils/mask.util';

const { combine, timestamp, json, errors, printf } = format;

// 云原生模式：仅输出到 stdout，JSON 格式
const cloudNativeFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format((info) => {
    // 脱敏处理
    if (info.metadata) {
      info.metadata = maskSensitiveData(info.metadata);
    }
    return info;
  })(),
  json(),
);

// 开发模式：带颜色的简单格式
const developmentFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, metadata, stack }) => {
    const metaStr = metadata
      ? ` | ${JSON.stringify(maskSensitiveData(metadata))}`
      : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}${stackStr}`;
  }),
);

export function createWinstonLogger(serviceName: string): Logger {
  const isCloudNative = process.env.LOG_CLOUD_NATIVE === 'true';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logDir = process.env.LOG_DIR || './logs';

  const loggerTransports: transports.ConsoleTransportInstance[] = [];

  // 控制台输出
  loggerTransports.push(
    new transports.Console({
      format: isCloudNative ? cloudNativeFormat : developmentFormat,
    }),
  );

  const logger = createLogger({
    level: logLevel,
    defaultMeta: {
      service: serviceName,
      version: process.env.npm_package_version || '0.0.1',
      environment: process.env.NODE_ENV || 'development',
    },
    transports: loggerTransports,
  });

  // 非云原生模式下，添加文件输出
  if (!isCloudNative) {
    // 错误日志单独存储
    logger.add(
      new DailyRotateFile({
        dirname: logDir,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '30d',
        format: cloudNativeFormat,
      }),
    );

    // 所有日志存储
    logger.add(
      new DailyRotateFile({
        dirname: logDir,
        filename: 'combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '30d',
        format: cloudNativeFormat,
      }),
    );
  }

  return logger;
}
