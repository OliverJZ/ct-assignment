import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { tap } from "rxjs";
import type { Observable } from "rxjs";

import { AppLoggerService } from "./logger.service";
import { MetricsService } from "./metrics.service";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService,
    @Inject(MetricsService)
    private readonly metrics: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const response = http.getResponse<{
      statusCode: number;
      setHeader(name: string, value: string): void;
    }>();

    const requestIdHeader = request.headers["x-request-id"];
    const requestId =
      typeof requestIdHeader === "string" ? requestIdHeader : randomUUID();
    const route = request.originalUrl ?? request.url ?? "unknown";
    const startedAt = performance.now();

    response.setHeader("x-request-id", requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = performance.now() - startedAt;
          const statusCode = response.statusCode;

          this.metrics.recordHttpRequest(
            request.method,
            route,
            statusCode,
            durationMs,
          );

          this.logger.info("HTTP request completed", {
            requestId,
            method: request.method,
            route,
            statusCode,
            durationMs: Number(durationMs.toFixed(2)),
          });
        },
        error: (error) => {
          const durationMs = performance.now() - startedAt;
          const statusCode = response.statusCode || 500;

          this.metrics.recordHttpRequest(
            request.method,
            route,
            statusCode,
            durationMs,
          );

          this.logger.errorWithFields("HTTP request failed", {
            requestId,
            method: request.method,
            route,
            statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            error: error instanceof Error ? error.message : String(error),
          });
        },
      }),
    );
  }
}
