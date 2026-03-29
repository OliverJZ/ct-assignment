# ct-assignment

Interview assignment for a two-service product reviews system.

## Goal

Build a maintainable TypeScript solution with:

- a `product-service` exposing REST APIs for products and reviews
- a `review-processor-service` consuming review events and persisting average ratings
- shared caching for product review lists and average ratings
- a design that safely supports 2+ processor instances and concurrent event handling

## Technical direction

- `Node.js` for both services using `NestJS`, `KafkaJS`, and `Prisma`
- `PostgreSQL` for canonical and derived persistent storage
- `Redis` for shared caching
- `Redpanda` as the local Kafka-compatible broker
- `OpenTelemetry`, `Prometheus`, `Loki`, `Tempo`, and `Grafana` for local observability

## Thought process and design decisions

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

## Assignment Checklist

- Product CRUD API: implemented
- Product payload does not return reviews: implemented
- Review create, edit, delete API: implemented
- Product review listing endpoint: implemented
- Product service notifies review processor on review changes: implemented through `review-events`
- Review processor consumes events and persists average rating: implemented
- Review processor supports 2+ instances: implemented through Kafka consumer group membership
- Concurrent event processing design: implemented through partitioned topic consumption keyed by `productId`
- Product reviews and average ratings are cached: implemented with Redis
- Docker Compose project setup: implemented
- TypeScript and lint configuration: implemented
- Documentation of thought process and tradeoffs: implemented in this `README.md`

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
- `averageRating` is exposed as derived state and may be `null` when a product has no reviews yet
- product detail reads and review-list reads are cached in Redis

## How To Run

Preferred full-stack startup:

```bash
cp .env.example .env
npm run compose:full
```

This starts infrastructure, both services, a second review-processor instance, and the observability stack.

Primary endpoints:

- product API: `http://localhost:3000`
- processor metrics: `http://localhost:3001/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3002`

To stop everything:

```bash
npm run compose:full:down
```

Development mode is still available if needed by running infrastructure in Docker and services locally.

## How To Verify

Start the stack:

```bash
cp .env.example .env
npm run compose:full
```

Generate realistic traffic:

```bash
npm run demo:traffic
```

Verify processor group membership and partition assignment:

```bash
npm run topic:describe
npm run group:describe
```

Verify derived rating state:

```bash
docker compose exec postgres psql -U postgres -d ct_assignment -c "select product_id, average_rating, review_count from product_ratings order by product_id;"
docker compose exec postgres psql -U postgres -d ct_assignment -c "select event_id, product_id, review_id, partition, offset from processed_events order by processed_at desc limit 20;"
```

Verify observability:

- Prometheus queries such as `product_service_cache_operations_total` and `review_processor_events_total`
- Grafana Explore with Tempo for traces
- Grafana Explore with Loki for service logs

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

## Observability strategy

The observability rollout is layered: logs and metrics first, then distributed tracing.

- both services emit structured JSON logs through `pino`
- `product-service` logs HTTP requests with request IDs, route, status code, and duration
- `product-service` exposes `GET /metrics`
- `review-processor-service` logs event receipt and processing outcomes with event metadata
- `review-processor-service` exposes `GET /metrics`
- both services export Prometheus-style metrics through `prom-client`
- `docker-compose.yml` includes an `observability` profile for Prometheus and Grafana
- both services export distributed traces through OpenTelemetry to the collector
- trace context is propagated through Kafka message headers between the two services
- Docker logs are aggregated into Loki through Promtail for service-level log querying in Grafana

Current metrics coverage includes:

- product-service HTTP request count and latency
- product-service cache operation counts
- review-processor event counts and processing duration
- review-processor cache invalidation counts

Tracing is now enabled with OpenTelemetry. The current tracing flow covers:

- incoming HTTP requests into `product-service`
- Kafka publish spans for review lifecycle events
- Kafka consumer spans in `review-processor-service`
- trace context propagation across Kafka headers
- downstream auto-instrumented Node spans where available

To start the current metrics stack locally:

```bash
npm run compose:observability
```

Then open:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3002` (`admin` / `admin`)
- Tempo API: `http://localhost:3200` (Grafana is the primary UI for trace exploration)
- Loki: `http://localhost:3100`

The services expose metrics at:

- `http://localhost:3000/metrics`
- `http://localhost:3001/metrics`

Tracing is exported to the collector through `OTEL_EXPORTER_OTLP_ENDPOINT`, which defaults to `http://localhost:4318` in local development.

To generate demo traffic for logs, metrics, cache activity, and traces:

```bash
npm run demo:traffic
```

The script creates multiple products, creates reviews for each, updates one review per product, deletes one review per product, and fetches product/review endpoints between mutations so the observability stack has useful activity to display.

For log inspection in Grafana:

- open Explore
- choose the `Loki` datasource
- query by labels such as `service="product-service"` or `service=~"review-processor-service.*"`
- use JSON fields like `traceId`, `instanceId`, `productId`, `reviewId`, and `eventId` to narrow results

For demonstrating 2+ processor instances and concurrent work across products, the demo traffic script now creates multiple products so the event stream contains multiple distinct `productId` keys.

## Processor scaling note

The review processor scales horizontally through a shared Kafka consumer group, but actual parallelism depends on topic partition count.

- `review-events` should have more than one partition to demonstrate multiple active processor instances
- messages are keyed by `productId`, which preserves ordering for one product while allowing different products to be processed in parallel
- heavier traffic alone does not create parallelism if the topic only has a single partition

For local verification with Redpanda, ensure the topic has enough partitions before running multiple processor instances:

```bash
npm run topic:ensure
```

## Data model

The current PostgreSQL schema contains four main tables:

- `products`: canonical product data
- `reviews`: canonical review data owned by `product-service`
- `product_ratings`: persisted derived rating projection per product
- `processed_events`: idempotency table for the future review processor consumer

This separation is intentional: canonical writes stay simple, and asynchronous derived state is modeled explicitly instead of being hidden inside the product row.

## Local infrastructure

The full Docker startup includes:

- `postgres`
- `redis`
- `redpanda`
- `redpanda-init`
- `product-service`
- `review-processor-service`
- `review-processor-service-2`
- `prometheus`
- `tempo`
- `loki`
- `otel-collector`
- `promtail`
- `grafana`

If you want only the core runtime without observability, use:

```bash
npm run compose:up
```

If you want to run services locally instead of in Docker, the supporting workflow is:

```bash
cp .env.example .env
npm run compose:infra
npm run compose:observability
npm run topic:ensure
npm run prisma:migrate:dev
npm run dev:product
npm run dev:processor
```

For a second processor instance:

```bash
INSTANCE_ID=processor-b REVIEW_PROCESSOR_PORT=3003 npm run dev:processor
```

The full observability stack is configured around the containerized runtime path. If services are run locally instead of in Docker, the applications still expose logs, traces, and `/metrics`, but the Dockerized Prometheus scrape targets will not match those local service endpoints unless the observability configuration is adjusted.

In the full Docker startup path, PostgreSQL creates the database and the service containers apply Prisma migrations automatically. In the local-service path, you should create `.env` from `.env.example` and run Prisma migrations yourself before starting the apps.

Useful broker inspection commands:

```bash
npm run topic:describe
npm run group:describe
```

Primary service endpoints in the full Docker setup:

- product API: `http://localhost:3000`
- processor metrics: `http://localhost:3001/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3002`
- Loki: `http://localhost:3100`
- Tempo: `http://localhost:3200`
