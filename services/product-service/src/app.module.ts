import { Module } from "@nestjs/common";

import { CacheModule } from "./cache/cache.module";
import { AppConfigModule } from "./config/app-config.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { ObservabilityModule } from "./observability/observability.module";
import { ProductsModule } from "./products/products.module";
import { ReviewsModule } from "./reviews/reviews.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CacheModule,
    ObservabilityModule,
    ProductsModule,
    ReviewsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
