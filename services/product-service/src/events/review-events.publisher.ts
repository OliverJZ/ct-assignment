import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { Kafka, logLevel } from "kafkajs";

const REVIEW_EVENTS_TOPIC = process.env.REVIEW_EVENTS_TOPIC ?? "review-events";
const REDPANDA_BROKERS = (process.env.REDPANDA_BROKERS ?? "localhost:19092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

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

    await this.producer.send({
      topic: REVIEW_EVENTS_TOPIC,
      messages: [
        {
          key: productId,
          value: JSON.stringify(event),
        },
      ],
    });
  }
}
