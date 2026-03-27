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

  readonly reviewEventsTotal = new Counter({
    name: "review_processor_events_total",
    help: "Review events handled by review-processor-service",
    labelNames: ["event_type", "status"],
    registers: [this.registry],
  });

  readonly reviewEventDurationMs = new Histogram({
    name: "review_processor_event_duration_ms",
    help: "Time spent processing review events in milliseconds",
    labelNames: ["event_type", "status"],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [this.registry],
  });

  readonly cacheInvalidationsTotal = new Counter({
    name: "review_processor_cache_invalidations_total",
    help: "Cache invalidations triggered by the review processor",
    labelNames: ["target"],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: "review_processor_",
    });
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordReviewEvent(
    eventType: string,
    status: "processed" | "skipped" | "failed",
    durationMs: number,
  ) {
    const labels = { event_type: eventType, status };

    this.reviewEventsTotal.inc(labels);
    this.reviewEventDurationMs.observe(labels, durationMs);
  }

  recordCacheInvalidation(target: string) {
    this.cacheInvalidationsTotal.inc({ target });
  }
}
