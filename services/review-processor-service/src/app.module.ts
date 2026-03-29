import { Module } from "@nestjs/common";

import { CacheModule } from "./cache/cache.module";
import { AppConfigModule } from "./config/app-config.module";
import { ConsumerModule } from "./consumer/consumer.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { ObservabilityModule } from "./observability/observability.module";
import { RatingProjectionModule } from "./rating-projection/rating-projection.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CacheModule,
    ObservabilityModule,
    RatingProjectionModule,
    ConsumerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
