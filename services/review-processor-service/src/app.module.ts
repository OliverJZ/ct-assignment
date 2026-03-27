import { Module } from "@nestjs/common";

import { ConsumerModule } from "./consumer/consumer.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { RatingProjectionModule } from "./rating-projection/rating-projection.module";

@Module({
  imports: [DatabaseModule, RatingProjectionModule, ConsumerModule],
  controllers: [HealthController],
})
export class AppModule {}
