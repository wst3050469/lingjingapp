#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/opt/lingjing/deploy"
STATE_FILE="$DEPLOY_DIR/.deploy-state"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
HEALTH_TIMEOUT=120
HEALTH_INTERVAL=5
OBSERVE_DURATION=60
OBSERVE_INTERVAL=10
OBSERVE_FAIL_THRESHOLD=3

log() {
  local level="$1"; shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] [BLUE-GREEN] $*"
}

usage() {
  echo "Usage: $0 <IMAGE_TAG> [--rollback]"
  echo "  IMAGE_TAG    Docker image tag to deploy (e.g., 1.2.3)"
  echo "  --rollback   Rollback to previous environment"
  exit 1
}

check_prerequisites() {
  command -v docker >/dev/null 2>&1 || { log ERROR "docker not found"; exit 1; }
  [ -f "$COMPOSE_FILE" ] || { log ERROR "$COMPOSE_FILE not found"; exit 1; }
  [ -f "$STATE_FILE" ] || { log INFO "No state file, initializing with blue"; echo "active_env=blue" > "$STATE_FILE"; echo "active_tag=none" >> "$STATE_FILE"; }
}

read_state() {
  source "$STATE_FILE"
  ACTIVE_ENV="$active_env"
  ACTIVE_TAG="$active_tag"
}

write_state() {
  echo "active_env=$1" > "$STATE_FILE"
  echo "active_tag=$2" >> "$STATE_FILE"
}

get_idle_env() {
  [ "$1" = "blue" ] && echo "green" || echo "blue"
}

wait_for_health() {
  local env="$1" port="$2" elapsed=0
  local container="lingjing-${env}-server"
  while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    if docker exec "$container" wget --spider -q http://localhost:8000/api/health 2>/dev/null; then
      log INFO "$env environment is healthy"
      return 0
    fi
    sleep $HEALTH_INTERVAL
    elapsed=$((elapsed + HEALTH_INTERVAL))
  done
  log ERROR "$env environment health check timed out after ${HEALTH_TIMEOUT}s"
  return 1
}

observe_health() {
  local env="$1" fail_count=0 elapsed=0
  local container="lingjing-${env}-server"
  while [ $elapsed -lt $OBSERVE_DURATION ]; do
    if ! docker exec "$container" wget --spider -q http://localhost:8000/api/health 2>/dev/null; then
      fail_count=$((fail_count + 1))
      log WARN "Health check failed ($fail_count/$OBSERVE_FAIL_THRESHOLD)"
      [ $fail_count -ge $OBSERVE_FAIL_THRESHOLD ] && return 1
    else
      fail_count=0
    fi
    sleep $OBSERVE_INTERVAL
    elapsed=$((elapsed + OBSERVE_INTERVAL))
  done
  return 0
}

switch_traffic() {
  local target_env="$1"
  local host="lingjing-${target_env}-server"
  local conf="$DEPLOY_DIR/nginx-upstream.conf"
  cat > "$conf" <<EOF
upstream cloud_server {
    server ${host}:8000;
    keepalive 32;
}
EOF
  docker exec lingjing-admin nginx -s reload 2>/dev/null || true
  log INFO "Traffic switched to $target_env (upstream: ${host}:8000)"
}

deploy_idle_env() {
  local idle_env="$1" tag="$2"
  local override="$DEPLOY_DIR/docker-compose.${idle_env}.yml"
  export COMPOSE_PROJECT_NAME="lingjing-${idle_env}"
  export IMAGE_TAG="$tag"
  log INFO "Deploying $tag to $idle_env environment..."
  if [ -f "$override" ]; then
    docker compose -f "$COMPOSE_FILE" -f "$override" pull
    docker compose -f "$COMPOSE_FILE" -f "$override" up -d
  else
    docker compose -f "$COMPOSE_FILE" pull
    docker compose -f "$COMPOSE_FILE" up -d
  fi
}

stop_env() {
  local env="$1"
  export COMPOSE_PROJECT_NAME="lingjing-${env}"
  log INFO "Stopping $env environment..."
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
}

rollback() {
  read_state
  local idle_env
  idle_env=$(get_idle_env "$ACTIVE_ENV")
  log WARN "Rolling back from $ACTIVE_ENV to $idle_env..."
  switch_traffic "$idle_env"
  stop_env "$ACTIVE_ENV"
  write_state "$idle_env" "rollback-from-$ACTIVE_TAG"
  log INFO "Rollback complete, active: $idle_env"
}

main() {
  [ $# -lt 1 ] && usage
  local IMAGE_TAG="$1"
  local ROLLBACK=false
  [ "${2:-}" = "--rollback" ] && ROLLBACK=true

  check_prerequisites
  read_state

  if $ROLLBACK; then
    rollback
    exit 0
  fi

  local idle_env
  idle_env=$(get_idle_env "$ACTIVE_ENV")

  deploy_idle_env "$idle_env" "$IMAGE_TAG"
  wait_for_health "$idle_env" || { log ERROR "Deploy failed, keeping $ACTIVE_ENV active"; stop_env "$idle_env"; exit 1; }

  switch_traffic "$idle_env"
  write_state "$idle_env" "$IMAGE_TAG"
  log INFO "Traffic switched to $idle_env ($IMAGE_TAG)"

  if ! observe_health "$idle_env"; then
    log ERROR "Health observation failed, auto-rolling back..."
    switch_traffic "$ACTIVE_ENV"
    stop_env "$idle_env"
    write_state "$ACTIVE_ENV" "$ACTIVE_TAG"
    log INFO "Rollback complete, active: $ACTIVE_ENV"
    exit 1
  fi

  log INFO "Deployment successful, scheduling cleanup of $ACTIVE_ENV in 5 minutes..."
  (sleep 300 && stop_env "$ACTIVE_ENV") &
  log INFO "Blue-green deployment complete: $idle_env ($IMAGE_TAG)"
}

main "$@"