#!/bin/sh
set -eu

TOPIC_NAME="${REVIEW_EVENTS_TOPIC:-review-events}"
TARGET_PARTITIONS="${REVIEW_EVENTS_PARTITIONS:-4}"
RPK_BROKERS="${RPK_BROKERS:-}"

run_rpk() {
  if [ -n "$RPK_BROKERS" ]; then
    rpk -X brokers="$RPK_BROKERS" "$@"
  else
    docker compose exec redpanda rpk "$@"
  fi
}

topic_exists="no"

if run_rpk topic list | awk 'NR>1 {print $1}' | grep -qx "$TOPIC_NAME"; then
  topic_exists="yes"
fi

if [ "$topic_exists" = "no" ]; then
  run_rpk topic create "$TOPIC_NAME" --partitions "$TARGET_PARTITIONS" --replicas 1
else
  current_partitions="$({ run_rpk topic describe "$TOPIC_NAME" 2>/dev/null || true; } | awk '/^PARTITIONS/ {print $2}')"

  if [ "$current_partitions" -lt "$TARGET_PARTITIONS" ]; then
    additional_partitions=$((TARGET_PARTITIONS - current_partitions))
    run_rpk topic add-partitions "$TOPIC_NAME" --num "$additional_partitions"
  fi
fi

run_rpk topic describe "$TOPIC_NAME"
