import { Module } from "@nestjs/common";

import { RatingProjectionModule } from "../rating-projection/rating-projection.module";
import { ReviewEventsConsumer } from "./review-events.consumer";

@Module({
  imports: [RatingProjectionModule],
  providers: [ReviewEventsConsumer],
})
export class ConsumerModule {}
