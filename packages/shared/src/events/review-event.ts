export const REVIEW_EVENT_TYPES = [
  "review.created",
  "review.updated",
  "review.deleted",
] as const;

export const REVIEW_EVENTS_TOPIC = "review-events";

export type ReviewEventType = (typeof REVIEW_EVENT_TYPES)[number];

export interface ReviewEvent {
  eventId: string;
  eventType: ReviewEventType;
  occurredAt: string;
  productId: string;
  reviewId: string;
}
