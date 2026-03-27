import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { ProductsModule } from "./products/products.module";
import { ReviewsModule } from "./reviews/reviews.module";

@Module({
  imports: [DatabaseModule, ProductsModule, ReviewsModule],
  controllers: [HealthController],
})
export class AppModule {}
