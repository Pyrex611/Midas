import winston from 'winston';

const baseLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export const logger = {
  info: (msg: string | object, meta?: any) => {
    if (typeof msg === 'object') baseLogger.info(JSON.stringify(msg), meta);
    else baseLogger.info(msg, meta);
  },
  error: (msg: string | object, meta?: any) => {
    if (typeof msg === 'object') baseLogger.error(JSON.stringify(msg), meta);
    else baseLogger.error(msg, meta);
  },
  warn: (msg: string | object, meta?: any) => {
    if (typeof msg === 'object') baseLogger.warn(JSON.stringify(msg), meta);
    else baseLogger.warn(msg, meta);
  },
  debug: (msg: string | object, meta?: any) => {
    if (typeof msg === 'object') baseLogger.debug(JSON.stringify(msg), meta);
    else baseLogger.debug(msg, meta);
  },
};