#!/usr/bin/env bash
set -Eeuo pipefail

export COMPOSE_PROJECT_NAME=prompt-processor-smoke
export DOTNET_ENVIRONMENT=Demo
export LLM_PROVIDER=Fake

response_file=""

cleanup() {
  status=$?
  if [[ "$status" -ne 0 ]]; then
    docker compose logs --no-color --tail 200 || true
  fi

  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  [[ -z "$response_file" ]] || rm -f "$response_file"
}

trap cleanup EXIT
docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true

command -v jq >/dev/null || {
  echo "jq is required to run the smoke test."
  exit 1
}

docker compose up --build --detach --wait --wait-timeout 120

response_file="$(mktemp)"
http_status="$(curl --fail --silent --show-error \
  --retry 20 --retry-delay 2 --retry-all-errors \
  -H "Content-Type: application/json" \
  -d '{"prompts":[{"content":"Explain asynchronous processing."},{"content":"Describe idempotency in one sentence."}]}' \
  --output "$response_file" --write-out "%{http_code}" \
  http://localhost:8080/api/prompts)"

if [[ "$http_status" != "202" ]]; then
  echo "Expected HTTP 202, received $http_status."
  cat "$response_file"
  exit 1
fi

job_ids="$(jq -c '[.[].id]' "$response_file")"
if [[ "$(jq 'length' "$response_file")" -ne 2 ]]; then
  echo "Expected two accepted jobs."
  cat "$response_file"
  exit 1
fi

for _ in {1..30}; do
  jobs="$(curl --fail --silent --show-error http://localhost:8080/api/prompts)"
  result="$(jq -r --argjson ids "$job_ids" '
    [.[] | select(.id as $id | $ids | index($id))] as $jobs
    | if ($jobs | length) != ($ids | length) then "waiting"
      elif any($jobs[]; .status == "Failed") then "failed"
      elif all($jobs[]; .status == "Completed" and ((.result // "") | length > 0)) then "completed"
      elif all($jobs[]; .status == "Completed") then "failed"
      else "waiting"
      end
  ' <<<"$jobs")"

  case "$result" in
    completed)
      echo "Smoke test passed: both jobs completed."
      exit 0
      ;;
    failed)
      echo "A smoke-test job failed."
      jq --argjson ids "$job_ids" '[.[] | select(.id as $id | $ids | index($id))]' <<<"$jobs"
      exit 1
      ;;
  esac

  sleep 2
done

echo "Timed out waiting for smoke-test jobs."
exit 1
