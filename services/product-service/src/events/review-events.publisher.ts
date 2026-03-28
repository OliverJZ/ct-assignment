import { Inject, Injectable } from "@nestjs/common";
import {
  context,
  propagation,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { Kafka, logLevel } from "kafkajs";

import { AppLoggerService } from "../observability/logger.service";

const REVIEW_EVENTS_TOPIC = process.env.REVIEW_EVENTS_TOPIC ?? "review-events";
const REDPANDA_BROKERS = (process.env.REDPANDA_BROKERS ?? "localhost:19092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);
const tracer = trace.getTracer("product-service-events");

type ReviewEventType = "review.created" | "review.updated" | "review.deleted";

type ReviewEvent = {
  eventId: string;
  eventType: ReviewEventType;
  occurredAt: string;
  productId: string;
  reviewId: string;
};

@Injectable()
export class ReviewEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly kafka = new Kafka({
    clientId: "product-service",
    brokers: REDPANDA_BROKERS,
    logLevel: logLevel.NOTHING,
  });

  private readonly producer = this.kafka.producer();

  constructor(
    @Inject(AppLoggerService)
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  publishCreated(productId: string, reviewId: string): Promise<void> {
    return this.publish("review.created", productId, reviewId);
  }

  publishUpdated(productId: string, reviewId: string): Promise<void> {
    return this.publish("review.updated", productId, reviewId);
  }

  publishDeleted(productId: string, reviewId: string): Promise<void> {
    return this.publish("review.deleted", productId, reviewId);
  }

  private async publish(
    eventType: ReviewEventType,
    productId: string,
    reviewId: string,
  ): Promise<void> {
    const event: ReviewEvent = {
      eventId: randomUUID(),
      eventType,
      occurredAt: new Date().toISOString(),
      productId,
      reviewId,
    };

    await tracer.startActiveSpan(
      "review-events.publish",
      {
        attributes: {
          "messaging.system": "kafka",
          "messaging.destination.name": REVIEW_EVENTS_TOPIC,
          "messaging.operation": "publish",
          "review.event_type": eventType,
          "review.product_id": productId,
          "review.review_id": reviewId,
        },
      },
      async (span) => {
        try {
          const headers: Record<string, string> = {};
          propagation.inject(context.active(), headers);

          await this.producer.send({
            topic: REVIEW_EVENTS_TOPIC,
            messages: [
              {
                key: productId,
                value: JSON.stringify(event),
                headers,
              },
            ],
          });

          this.logger.info("Published review lifecycle event", {
            eventId: event.eventId,
            eventType: event.eventType,
            productId: event.productId,
            reviewId: event.reviewId,
            topic: REVIEW_EVENTS_TOPIC,
          });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
