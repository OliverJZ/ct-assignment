import { Controller, Get, Header, Inject } from "@nestjs/common";

import { MetricsService } from "./metrics.service";

@Controller("metrics")
export class MetricsController {
  constructor(
    @Inject(MetricsService)
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getMetrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
