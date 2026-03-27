# ct-assignment

Interview assignment for a two-service product reviews system.

## Goal

Build a maintainable TypeScript solution with:

- a `product-service` exposing REST APIs for products and reviews
- a `review-processor-service` consuming review events and persisting average ratings
- shared caching for product review lists and average ratings
- a design that safely supports 2+ processor instances and concurrent event handling

## Technical direction

- `NestJS` for both services
- `PostgreSQL` for canonical and derived persistent storage
- `Redis` for shared caching
- `Redpanda` as the local Kafka-compatible broker
- `OpenTelemetry`, `Prometheus`, `Loki`, `Tempo`, and `Grafana` for local observability

## Thought process and design decisions

### Why two services

The assignment explicitly separates product-facing CRUD from rating computation. I keep those responsibilities split so the API service remains the source of truth for products and reviews, while the review processor owns the derived rating projection.

### Why event-driven communication

The review processor must run in multiple instances and process events concurrently. A Kafka-compatible broker fits that requirement better than direct HTTP callbacks because it gives:

- consumer groups for horizontal scaling
- partition-based concurrency
- replayable events for debugging and recovery
- looser coupling between write APIs and background processing

### Why Redpanda locally

For an assignment, Redpanda keeps the Kafka architecture story while being lighter to run in Docker Compose than a fuller Kafka setup. The design remains Kafka-compatible if production later standardizes on Kafka in KRaft mode.

### Why PostgreSQL

The data is relational and consistency matters more than schema flexibility. PostgreSQL is also a good fit for:

- transactional writes for products and reviews
- projection persistence for average ratings
- idempotency support through a `processed_events` table
- indexed, scalable read and recomputation queries

### Why Redis

The PDF requires caching for review lists and average ratings. Because the system runs with multiple service instances, a shared Redis cache is the correct choice over in-memory caching.

### Event processing model

- topic: `review-events`
- event types: `review.created`, `review.updated`, `review.deleted`
- message key: `productId`

Using `productId` as the message key preserves ordering for one product while still allowing different products to be processed concurrently across partitions.

### Why `kafkajs` over NestJS Kafka transport

NestJS already supports Kafka integration, but for this assignment I prefer `kafkajs` directly for the broker-facing layer.

- it keeps producer and consumer behavior explicit
- it gives direct control over topic names, message keys, retries, and offsets
- it makes the event flow easier to reason about during code review
- it avoids hiding broker behavior behind extra framework abstraction

NestJS is still used for application structure, DI, validation, and module boundaries. `kafkajs` is only the lower-level broker client.

### Consistency model

`averageRating` is eventually consistent. Review writes are committed by the product service first, then the processor recomputes and persists the derived rating. This keeps the write path clean and makes the distributed tradeoff explicit.

### Idempotency and scaling

The processor is designed for at-least-once delivery. To avoid duplicate projection updates, processed event IDs will be stored in persistent storage with a uniqueness guarantee. The processor should scale horizontally by running multiple instances in the same consumer group.

### Observability stance

Observability is treated as a core quality attribute, not end-stage polish. The final implementation should include:

- structured JSON logs with correlation identifiers
- distributed tracing across HTTP, broker, database, and cache boundaries
- metrics for request latency, processing latency, cache behavior, and failures
- a local Grafana stack for inspection during demo and debugging

## Tradeoffs

- I prefer one PostgreSQL instance with clear table ownership for assignment delivery speed, rather than introducing separate databases too early
- I prefer full rating recomputation per affected product over fragile incremental math because correctness and explainability matter more here than micro-optimization
- I prefer Redpanda for local setup simplicity, while keeping the message contract Kafka-compatible
- I am not introducing an outbox pattern in the first messaging slice; review writes will commit first and then publish events, which is simpler but not fully failure-proof if the broker is unavailable at publish time

## Workspace layout

```txt
services/
  product-service/
  review-processor-service/
packages/
  shared/
infra/
  docker/
```

## Current implementation focus

Completed so far:

1. Workspace bootstrap and core infrastructure scaffold
2. Prisma schema and initial database integration
3. Product CRUD endpoints with paginated product listing
4. Review CRUD and paginated review listing in `product-service`
5. Review lifecycle event publication from `product-service` to `review-events`
6. `review-processor-service` consumer and rating projection persistence
7. Redis caching for product detail responses and review-list responses

Next:

1. Add observability to real HTTP and event-processing flows
2. Expand integration and end-to-end tests

## Current API surface

Implemented in `product-service`:

- `POST /products`
- `GET /products?page=1&limit=20`
- `GET /products/:productId`
- `PATCH /products/:productId`
- `DELETE /products/:productId`
- `POST /products/:productId/reviews`
- `GET /products/:productId/reviews?page=1&limit=20`
- `PATCH /products/:productId/reviews/:reviewId`
- `DELETE /products/:productId/reviews/:reviewId`

Current API behavior:

- product responses do not embed reviews
- product list and review list are paginated
- review `rating` is validated as an integer in the range `1..5`
- `averageRating` is exposed as derived state and may be `null` until the processor is implemented
- product detail reads and review-list reads are cached in Redis

## Event publication approach

The next implemented step is broker publication from `product-service` when reviews change.

- topic: `review-events`
- key: `productId`
- event types: `review.created`, `review.updated`, `review.deleted`
- payload: `eventId`, `eventType`, `occurredAt`, `productId`, `reviewId`

The event payload intentionally stays small. The review processor can recompute the rating from canonical database state, so it only needs to know which product and review changed.

For local development, host-based services should connect to Redpanda through `localhost:19092`, which matches the external listener exposed by `docker-compose.yml`.

## Review processor behavior

`review-processor-service` consumes `review-events` in a consumer group and processes events keyed by `productId`.

Current processor behavior:

- logs when a review lifecycle event is received
- skips events already present in `processed_events`
- recomputes `averageRating` from canonical `reviews` data for the affected product
- upserts `product_ratings`
- records the processed event for idempotency

The current implementation intentionally recomputes from source-of-truth reviews rather than doing incremental arithmetic. That is slightly less optimized, but simpler and safer for correctness in an interview assignment.

## Caching strategy

The assignment requires cached product reviews and cached average ratings. The current implementation handles that with Redis-backed cache-aside behavior.

- `product-service` caches product detail responses by product ID
- `product-service` caches paginated review-list responses by product ID, page, and limit
- review mutations invalidate all cached review-list pages for the affected product
- the review processor invalidates the cached product detail after recomputing `averageRating`

This means review-list cache invalidation is immediate on canonical writes, while product-detail cache invalidation follows the eventual-consistency boundary of the asynchronous rating projection.

## Data model

The current PostgreSQL schema contains four main tables:

- `products`: canonical product data
- `reviews`: canonical review data owned by `product-service`
- `product_ratings`: persisted derived rating projection per product
- `processed_events`: idempotency table for the future review processor consumer

This separation is intentional: canonical writes stay simple, and asynchronous derived state is modeled explicitly instead of being hidden inside the product row.

## Local infrastructure

`docker-compose.yml` currently provisions:

- `postgres`
- `redis`
- `redpanda`

Observability configuration files are scaffolded in `infra/docker/` and will be enabled after the core application flow is working.

## Delivery notes

The final repository should be easy to run, easy to review, and explicit about design choices. This `README.md` is intended to hold the implementation rationale and tradeoffs required by the assignment, so reviewer-facing documentation stays close to the code.

As implementation progresses, this file should be updated alongside the code so the documented architecture, tradeoffs, and known limitations stay consistent with the actual repository state.
