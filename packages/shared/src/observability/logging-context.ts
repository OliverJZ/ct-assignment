export interface LoggingContext {
  traceId?: string;
  spanId?: string;
  requestId?: string;
  productId?: string;
  reviewId?: string;
  eventId?: string;
  topic?: string;
  partition?: number;
  offset?: string;
}
