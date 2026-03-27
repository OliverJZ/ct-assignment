import { Module } from "@nestjs/common";

import { ReviewEventsPublisher } from "./review-events.publisher";

@Module({
  providers: [ReviewEventsPublisher],
  exports: [ReviewEventsPublisher],
})
export class EventsModule {}
