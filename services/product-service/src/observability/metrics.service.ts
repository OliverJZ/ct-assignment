import { Injectable } from "@nestjs/common";
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: "product_service_http_requests_total",
    help: "Total HTTP requests handled by product-service",
    labelNames: ["method", "route", "status_code"],
    registers: [this.registry],
  });

  readonly httpRequestDurationMs = new Histogram({
    name: "product_service_http_request_duration_ms",
    help: "HTTP request duration in milliseconds for product-service",
    labelNames: ["method", "route", "status_code"],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [this.registry],
  });

  readonly cacheOperationsTotal = new Counter({
    name: "product_service_cache_operations_total",
    help: "Cache operations performed by product-service",
    labelNames: ["operation", "result"],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: "product_service_",
    });
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ) {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, durationMs);
  }

  recordCacheOperation(
    operation: string,
    result: "hit" | "miss" | "write" | "delete",
  ) {
    this.cacheOperationsTotal.inc({ operation, result });
  }
}
