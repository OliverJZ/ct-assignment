import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { AppLoggerService } from "./observability/logger.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(AppLoggerService));
  await app.listen(process.env.REVIEW_PROCESSOR_PORT ?? 3001, "0.0.0.0");
}

bootstrap();
