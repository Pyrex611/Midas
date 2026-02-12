import winston from 'winston';
import { env } from './env';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  env.NODE_ENV === 'production'
    ? winston.format.json()
    : winston.format.prettyPrint()
);

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [new winston.transports.Console()],
});