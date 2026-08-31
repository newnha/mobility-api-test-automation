#!/usr/bin/env bash
#
# Newman 실행 래퍼.
#   사용법: bash scripts/run-newman.sh <env> [targets]
#     env     : local | alpha | dev                (기본 local)
#     targets : 실행할 폴더/요청 이름, 쉼표 구분    (비우면 전체 실행)
#               예) "카셰어링"   "카셰어링,비대면"   "문 열림 상태 주입 (is_door_open=true)"
#
#   CI 환경변수:
#     BASE_URL / ACCESS_TOKEN / CAR_ID  → 환경 파일 값보다 우선 주입
#     REDACT_BODIES=true               → 리포트에서 요청/응답 본문 제외
#
set -euo pipefail

ENV_NAME="${1:-local}"
TARGETS="${2:-}"

COLLECTION="postman/mobility-state-injection.postman_collection.json"
ENV_FILE="postman/environments/${ENV_NAME}.postman_environment.json"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "::error::알 수 없는 환경입니다: ${ENV_NAME} (${ENV_FILE} 없음)"
  exit 1
fi

mkdir -p reports

ARGS=(
  run "$COLLECTION"
  --environment "$ENV_FILE"
  --reporters cli,htmlextra,junit
  --reporter-htmlextra-export "reports/report.html"
  --reporter-junit-export "reports/junit.xml"
  --color on
)

# 포스트맨에서 폴더/요청 골라 돌리듯이 --folder 를 필요한 만큼 반복
if [[ -n "$TARGETS" ]]; then
  IFS=',' read -ra ITEMS <<< "$TARGETS"
  for item in "${ITEMS[@]}"; do
    trimmed="$(echo "$item" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [[ -n "$trimmed" ]] && ARGS+=(--folder "$trimmed")
  done
fi

if [[ "${REDACT_BODIES:-false}" == "true" ]]; then
  ARGS+=(--reporter-htmlextra-omitRequestBodies --reporter-htmlextra-omitResponseBodies)
fi

# CI 시크릿 오버라이드 (환경 파일의 빈 값을 실제 값으로 채움)
[[ -n "${BASE_URL:-}" ]]     && ARGS+=(--env-var "base_url=${BASE_URL}")
[[ -n "${ACCESS_TOKEN:-}" ]] && ARGS+=(--env-var "access_token=${ACCESS_TOKEN}")
[[ -n "${CAR_ID:-}" ]]       && ARGS+=(--env-var "car_id=${CAR_ID}")

echo "▶ env=${ENV_NAME} targets=${TARGETS:-<전체>}"
npx --yes newman "${ARGS[@]}"
