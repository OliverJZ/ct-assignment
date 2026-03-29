import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

import { AppConfigService } from "../config/app-config";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  private readonly redis: Redis;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleInit() {
    await this.redis.connect();
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
    this.logger.debug(`Deleted cache key ${key}`);
  }

  productDetailKey(productId: string): string {
    return `product:${productId}:detail`;
  }
}
