import { Inject, ConsoleLogger, Injectable } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import pino, { type Logger } from "pino";

import { AppConfigService } from "../config/app-config";

type LogContext = Record<string, unknown>;

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  private readonly logger: Logger;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    super();

    this.logger = pino({
      level: config.logLevel,
      base: {
        service: "review-processor-service",
        instanceId: config.instanceId,
      },
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
    this.logger.info(this.withTrace(fields), message);
  }

  errorWithFields(message: string, fields: LogContext = {}) {
    this.logger.error(this.withTrace(fields), message);
  }

  private withTrace(fields: LogContext): LogContext {
    const spanContext = trace.getActiveSpan()?.spanContext();

    return {
      ...fields,
      ...(spanContext
        ? {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
          }
        : {}),
    };
  }
}
