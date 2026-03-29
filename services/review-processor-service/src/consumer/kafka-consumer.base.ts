import type { EachMessagePayload, Kafka, Consumer, logLevel } from "kafkajs";
import { Kafka as KafkaClient, logLevel as kafkaLogLevel } from "kafkajs";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

export abstract class KafkaConsumerBase
  implements OnModuleInit, OnModuleDestroy
{
  private readonly kafka: Kafka;

  protected readonly consumer: Consumer;

  protected constructor(
    clientId: string,
    brokers: string[],
    groupId: string,
    level: logLevel = kafkaLogLevel.NOTHING,
  ) {
    this.kafka = new KafkaClient({
      clientId,
      brokers,
      logLevel: level,
    });

    this.consumer = this.kafka.consumer({ groupId });
  }

  protected abstract topic(): string;

  protected abstract fromBeginning(): boolean;

  protected abstract handleMessage(payload: EachMessagePayload): Promise<void>;

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.topic(),
      fromBeginning: this.fromBeginning(),
    });

    await this.consumer.run({
      eachMessage: async (payload) => this.handleMessage(payload),
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
