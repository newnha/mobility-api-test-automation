#!/usr/bin/env bash
#
# Newman 실행 래퍼.
#   사용법: bash scripts/run-newman.sh <env> <domain>
#     env    : local | alpha | dev        (기본 local)
#     domain : all | carsharing | contactless  (기본 all)
#
#   CI에서는 BASE_URL / ACCESS_TOKEN 환경변수로 값을 주입한다(환경 파일보다 우선).
#
set -euo pipefail

ENV_NAME="${1:-local}"
DOMAIN="${2:-all}"

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

case "$DOMAIN" in
  all) ;;
  carsharing)  ARGS+=(--folder "카셰어링") ;;
  contactless) ARGS+=(--folder "비대면") ;;
  *) echo "::error::알 수 없는 도메인입니다: ${DOMAIN}"; exit 1 ;;
esac

# CI 시크릿 오버라이드 (환경 파일의 빈 값을 실제 값으로 채움)
[[ -n "${BASE_URL:-}" ]]     && ARGS+=(--env-var "base_url=${BASE_URL}")
[[ -n "${ACCESS_TOKEN:-}" ]] && ARGS+=(--env-var "access_token=${ACCESS_TOKEN}")
[[ -n "${CAR_ID:-}" ]]       && ARGS+=(--env-var "car_id=${CAR_ID}")

echo "▶ env=${ENV_NAME} domain=${DOMAIN}"
npx --yes newman "${ARGS[@]}"
