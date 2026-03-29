import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config";
import { AppLoggerService } from "./observability/logger.service";
import { initializeTracing } from "./observability/tracing";

async function bootstrap() {
  await initializeTracing();

  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  app.useLogger(app.get(AppLoggerService));
  await app.listen(config.port, "0.0.0.0");
}

bootstrap();
