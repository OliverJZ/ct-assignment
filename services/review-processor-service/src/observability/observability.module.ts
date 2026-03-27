import { Global, Module } from "@nestjs/common";

import { AppLoggerService } from "./logger.service";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";

@Global()
@Module({
  controllers: [MetricsController],
  providers: [AppLoggerService, MetricsService],
  exports: [AppLoggerService, MetricsService],
})
export class ObservabilityModule {}
