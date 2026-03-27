import { Module } from "@nestjs/common";

import { RatingProjectionService } from "./rating-projection.service";

@Module({
  providers: [RatingProjectionService],
  exports: [RatingProjectionService],
})
export class RatingProjectionModule {}
