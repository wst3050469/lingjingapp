#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/opt/lingjing/deploy"
STATE_FILE="$DEPLOY_DIR/.canary-state"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
CANARY_OVERRIDE="$DEPLOY_DIR/docker-compose.canary.yml"

DEFAULT_INITIAL_WEIGHT=5
DEFAULT_STEP=25
DEFAULT_INTERVAL=300
DEFAULT_ERROR_THRESHOLD=5

log() {
  local level="$1"; shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] [CANARY] $*"
}

usage() {
  echo "Usage: $0 <IMAGE_TAG> [options]"
  echo "  --initial-weight=N    Initial canary traffic weight (1-20, default: 5)"
  echo "  --step=N              Traffic increment step (10-50, default: 25)"
  echo "  --interval=N          Seconds between increments (>=60, default: 300)"
  echo "  --error-threshold=N   Error rate % threshold for auto-rollback (default: 5)"
  echo "  --promote             Promote canary to 100% (full rollout)"
  echo "  --rollback            Rollback canary to 0% (revert to stable)"
  echo "  --set-weight=N        Manually set canary traffic weight"
  exit 1
}

read_state() {
  if [ -f "$STATE_FILE" ]; then
    source "$STATE_FILE"
  else
    STABLE_TAG="none"
    CANARY_TAG="none"
    CURRENT_WEIGHT=0
    STATUS="idle"
  fi
}

write_state() {
  echo "stable_tag=$1" > "$STATE_FILE"
  echo "canary_tag=$2" >> "$STATE_FILE"
  echo "current_weight=$3" >> "$STATE_FILE"
  echo "status=$4" >> "$STATE_FILE"
}

update_nginx_weights() {
  local canary_weight="$1"
  local stable_weight=$((100 - canary_weight))
  local conf="$DEPLOY_DIR/nginx-canary-upstream.conf"
  cat > "$conf" <<EOF
upstream cloud_server {
    server lingjing-server:8000 weight=${stable_weight};
    server lingjing-canary-server:8000 weight=${canary_weight};
    keepalive 32;
}
EOF
  docker exec lingjing-admin nginx -s reload 2>/dev/null || true
  log INFO "Nginx weights updated: stable=${stable_weight}% canary=${canary_weight}%"
}

collect_canary_metrics() {
  local container="lingjing-canary-server"
  local logs
  logs=$(docker logs --since 60s "$container" 2>&1 || true)
  local total errors
  total=$(echo "$logs" | grep -c "HTTP" || echo 0)
  errors=$(echo "$logs" | grep -ciE "error|5[0-9]{2}" || echo 0)
  if [ "$total" -gt 0 ]; then
    ERROR_RATE=$((errors * 100 / total))
  else
    ERROR_RATE=0
  fi
}

deploy_canary() {
  local tag="$1"
  export COMPOSE_PROJECT_NAME="lingjing-canary"
  export IMAGE_TAG="$tag"
  log INFO "Deploying canary version $tag..."
  docker compose -f "$COMPOSE_FILE" -f "$CANARY_OVERRIDE" pull
  docker compose -f "$COMPOSE_FILE" -f "$CANARY_OVERRIDE" up -d
  local elapsed=0
  while [ $elapsed -lt 120 ]; do
    if docker exec lingjing-canary-server wget --spider -q http://localhost:8000/api/health 2>/dev/null; then
      log INFO "Canary is healthy"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  log ERROR "Canary health check timed out"
  return 1
}

stop_canary() {
  export COMPOSE_PROJECT_NAME="lingjing-canary"
  docker compose -f "$COMPOSE_FILE" -f "$CANARY_OVERRIDE" down --remove-orphans 2>/dev/null || true
  log INFO "Canary environment stopped"
}

do_rollback() {
  read_state
  log WARN "Rolling back canary ($CANARY_TAG), restoring 100% stable ($STABLE_TAG)..."
  update_nginx_weights 0
  stop_canary
  write_state "$STABLE_TAG" "none" 0 "rolled-back"
  log INFO "Rollback complete"
}

do_promote() {
  read_state
  log INFO "Promoting canary ($CANARY_TAG) to 100%..."
  update_nginx_weights 100
  local elapsed=0 fail=0
  while [ $elapsed -lt 300 ]; do
    if ! docker exec lingjing-canary-server wget --spider -q http://localhost:8000/api/health 2>/dev/null; then
      fail=$((fail + 1))
      [ $fail -ge 3 ] && { log ERROR "Canary unhealthy during promotion, rolling back"; do_rollback; exit 1; }
    else
      fail=0
    fi
    sleep 30
    elapsed=$((elapsed + 30))
  done
  log INFO "Canary promoted successfully"
  stop_canary
  write_state "$CANARY_TAG" "none" 100 "promoted"
}

main() {
  local IMAGE_TAG="" INITIAL_WEIGHT=$DEFAULT_INITIAL_WEIGHT STEP=$DEFAULT_STEP
  local INTERVAL=$DEFAULT_INTERVAL ERROR_THRESHOLD=$DEFAULT_ERROR_THRESHOLD
  local PROMOTE=false ROLLBACK=false SET_WEIGHT=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --initial-weight=*) INITIAL_WEIGHT="${1#*=}"; shift ;;
      --step=*) STEP="${1#*=}"; shift ;;
      --interval=*) INTERVAL="${1#*=}"; shift ;;
      --error-threshold=*) ERROR_THRESHOLD="${1#*=}"; shift ;;
      --promote) PROMOTE=true; shift ;;
      --rollback) ROLLBACK=true; shift ;;
      --set-weight=*) SET_WEIGHT="${1#*=}"; shift ;;
      -*) usage ;;
      *) IMAGE_TAG="$1"; shift ;;
    esac
  done

  read_state

  if $ROLLBACK; then do_rollback; exit 0; fi
  if $PROMOTE; then do_promote; exit 0; fi

  if [ -n "$SET_WEIGHT" ]; then
    update_nginx_weights "$SET_WEIGHT"
    write_state "$STABLE_TAG" "$CANARY_TAG" "$SET_WEIGHT" "manual"
    log INFO "Canary weight set to $SET_WEIGHT%"
    exit 0
  fi

  [ -z "$IMAGE_TAG" ] && usage

  deploy_canary "$IMAGE_TAG" || { log ERROR "Canary deploy failed"; exit 1; }

  local stable_tag="$STABLE_TAG"
  [ "$stable_tag" = "none" ] && stable_tag="current"

  update_nginx_weights "$INITIAL_WEIGHT"
  write_state "$stable_tag" "$IMAGE_TAG" "$INITIAL_WEIGHT" "progressing"
  log INFO "Initial canary traffic: ${INITIAL_WEIGHT}%"

  local current_weight=$INITIAL_WEIGHT
  while [ $current_weight -lt 100 ]; do
    sleep $INTERVAL
    collect_canary_metrics
    if [ "$ERROR_RATE" -ge "$ERROR_THRESHOLD" ]; then
      log ERROR "Error rate ${ERROR_RATE}% exceeds threshold ${ERROR_THRESHOLD}%, auto-rolling back"
      do_rollback
      exit 1
    fi
    current_weight=$((current_weight + STEP))
    [ $current_weight -gt 100 ] && current_weight=100
    update_nginx_weights "$current_weight"
    write_state "$stable_tag" "$IMAGE_TAG" "$current_weight" "progressing"
    log INFO "Canary traffic increased to ${current_weight}% (error_rate=${ERROR_RATE}%)"
  done

  log INFO "Canary at 100%, starting 300s observation..."
  local elapsed=0 fail=0
  while [ $elapsed -lt 300 ]; do
    collect_canary_metrics
    if [ "$ERROR_RATE" -ge "$ERROR_THRESHOLD" ]; then
      fail=$((fail + 1))
      [ $fail -ge 3 ] && { log ERROR "Observation failed, rolling back"; do_rollback; exit 1; }
    else
      fail=0
    fi
    sleep 30
    elapsed=$((elapsed + 30))
  done

  log INFO "Canary deployment complete and stable"
  write_state "$IMAGE_TAG" "none" 100 "complete"
}

main "$@"