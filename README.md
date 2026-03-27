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

1. Finish workspace bootstrap and dependency installation
2. Add Prisma schemas and migrations
3. Implement product and review APIs
4. Publish review lifecycle events
5. Implement processor concurrency, idempotency, and projection persistence
6. Add cache behavior and observability to the real flows
7. Add integration and end-to-end tests

## Local infrastructure

`docker-compose.yml` currently provisions:

- `postgres`
- `redis`
- `redpanda`

Observability configuration files are scaffolded in `infra/docker/` and will be enabled after the core application flow is working.

## Delivery notes

The final repository should be easy to run, easy to review, and explicit about design choices. This `README.md` is intended to hold the implementation rationale and tradeoffs required by the assignment, so reviewer-facing documentation stays close to the code.
