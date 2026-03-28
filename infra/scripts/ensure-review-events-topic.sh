#!/usr/bin/env bash
set -euo pipefail

TOPIC_NAME="${REVIEW_EVENTS_TOPIC:-review-events}"
TARGET_PARTITIONS="${REVIEW_EVENTS_PARTITIONS:-4}"

current_partitions="$({ docker compose exec redpanda rpk topic describe "$TOPIC_NAME" 2>/dev/null || true; } | awk '/^PARTITIONS/ {print $2}')"

if [ -z "$current_partitions" ]; then
  docker compose exec redpanda rpk topic create "$TOPIC_NAME" --partitions "$TARGET_PARTITIONS" --replicas 1
  exit 0
fi

if [ "$current_partitions" -lt "$TARGET_PARTITIONS" ]; then
  additional_partitions=$((TARGET_PARTITIONS - current_partitions))
  docker compose exec redpanda rpk topic add-partitions "$TOPIC_NAME" --num "$additional_partitions"
fi

docker compose exec redpanda rpk topic describe "$TOPIC_NAME"
