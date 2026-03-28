import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { AppLoggerService } from "./observability/logger.service";
import { RequestLoggingInterceptor } from "./observability/request-logging.interceptor";
import { initializeTracing } from "./observability/tracing";

async function bootstrap() {
  await initializeTracing();

  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(AppLoggerService));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(app.get(RequestLoggingInterceptor));

  await app.listen(process.env.PRODUCT_SERVICE_PORT ?? 3000, "0.0.0.0");
}

bootstrap();
