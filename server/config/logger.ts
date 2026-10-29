import winston from 'winston';

function serializeErrors(info: any): any {
  if (info instanceof Error) {
    return {
      message: info.message,
      stack: info.stack,
      name: info.name,
      ...(info as any),
    };
  }
  if (typeof info === 'object' && info !== null) {
    const serialized: any = Array.isArray(info) ? [] : {};
    for (const key of Object.keys(info)) {
      const val = info[key];
      if (val instanceof Error) {
        serialized[key] = {
          message: val.message,
          stack: val.stack,
          name: val.name,
          ...(val as any),
        };
      } else if (typeof val === 'object' && val !== null) {
        serialized[key] = serializeErrors(val);
      } else {
        serialized[key] = val;
      }
    }
    return serialized;
  }
  return info;
}

const baseLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaClean = Object.keys(meta).length ? JSON.stringify(serializeErrors(meta)) : '';
      const msgClean = typeof message === 'object' ? JSON.stringify(serializeErrors(message)) : message;
      return JSON.stringify({
        timestamp,
        level,
        message: msgClean,
        ...(metaClean ? { meta: JSON.parse(metaClean) } : {}),
      });
    })
  ),
  transports: [new winston.transports.Console()],
});

export const logger = {
  info: (msg: string | object, meta?: any) => {
    baseLogger.info(serializeErrors(msg), serializeErrors(meta));
  },
  error: (msg: string | object, meta?: any) => {
    baseLogger.error(serializeErrors(msg), serializeErrors(meta));
  },
  warn: (msg: string | object, meta?: any) => {
    baseLogger.warn(serializeErrors(msg), serializeErrors(meta));
  },
  debug: (msg: string | object, meta?: any) => {
    baseLogger.debug(serializeErrors(msg), serializeErrors(meta));
  },
};