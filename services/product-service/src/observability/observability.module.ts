import { Global, Module } from "@nestjs/common";

import { AppLoggerService } from "./logger.service";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { RequestLoggingInterceptor } from "./request-logging.interceptor";

@Global()
@Module({
  controllers: [MetricsController],
  providers: [AppLoggerService, MetricsService, RequestLoggingInterceptor],
  exports: [AppLoggerService, MetricsService, RequestLoggingInterceptor],
})
export class ObservabilityModule {}
