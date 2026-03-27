import { ConsoleLogger, Injectable } from "@nestjs/common";
import pino, { type Logger } from "pino";

type LogContext = Record<string, unknown>;

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  private readonly logger: Logger;

  constructor() {
    super();

    this.logger = pino({
      level: process.env.LOG_LEVEL ?? "info",
      base: { service: "review-processor-service" },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  override log(message: string, context?: string) {
    this.logger.info({ context }, message);
  }

  override error(message: string, trace?: string, context?: string) {
    this.logger.error({ context, trace }, message);
  }

  override warn(message: string, context?: string) {
    this.logger.warn({ context }, message);
  }

  override debug(message: string, context?: string) {
    this.logger.debug({ context }, message);
  }

  override verbose(message: string, context?: string) {
    this.logger.trace({ context }, message);
  }

  info(message: string, fields: LogContext = {}) {
    this.logger.info(fields, message);
  }

  errorWithFields(message: string, fields: LogContext = {}) {
    this.logger.error(fields, message);
  }
}
