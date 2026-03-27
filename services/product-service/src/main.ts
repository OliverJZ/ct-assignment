import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  console.log("Creating Nest application...");

  const app = await NestFactory.create(AppModule);

  console.log("Applying global validation pipe...");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  console.log("Starting product service...");

  await app.listen(process.env.PRODUCT_SERVICE_PORT ?? 3000);

  console.log(
    "Product service is running on port",
    process.env.PRODUCT_SERVICE_PORT ?? 3000,
  );
}

bootstrap();
