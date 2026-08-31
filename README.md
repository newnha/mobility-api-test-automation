# mobility-api-test-automation

모빌리티 차량 상태값을 API로 직접 주입하고, 그 반영 여부를 자동으로 검증하는 테스트 자동화 프로젝트.
**Postman 컬렉션 + Newman(CLI) + GitHub Actions(수동 실행)** 로 구성했다.

---

## 2. API 상태값 조작 및 테스트 데이터 세팅 자동화

### 문제 상황
- 모빌리티 도메인 특성상 특정 차량 상태(문 열림/잠김, 시동 여부, 배터리 잔량 등)나 예외 상황을
  테스트하려면 실제 앱 화면을 복잡하게 거치거나 선행 조건을 수동으로 세팅해야 함.
- 반복적인 수동 컨디션 세팅으로 인해 테스트 준비에 불필요한 리소스가 낭비됨.

### 해결 과정
- **Postman API 컬렉션 구축**: Swagger 명세를 바탕으로 도메인별(카셰어링, 비대면 등) 핵심 상태 변경
  API(예: `PUT /test/cars/:car_id`)를 정리하여 테스트 환경 구성.
- **상태값 직접 주입**: UI를 거치지 않고, 요청 데이터(Payload)에 상태값
  (`is_door_open`, `is_engine_on`, `remaining_percentage` 등)을 직접 변경해 입력함으로써
  원하는 테스트 조건을 빠르게 생성.
- **자동화**: API 요청 → 응답 스키마 검증 → 주입값 반영 검증을 Newman으로 코드화하고,
  GitHub Actions `workflow_dispatch` 로 환경(alpha/dev)을 골라 수동 실행할 수 있게 파이프라인 구성.

### 효과 및 회고
- 복잡한 예외 상황 및 경계값 테스트를 위한 데이터 세팅 과정을 간소화함.
- 사내에서 활용 중인 API 툴(Postman)을 테스트 검증 영역으로 확장하는 방안을 실무에 적용해 봄.

> 이 레포의 `spec/openapi.yaml` 및 목 서버는 사내 실제 스펙/인증 정보를 제거하고
> 동작만 재현한 **익명화 버전**이다.

---

## 프로젝트 구조

```
.
├── .github/workflows/api-test.yml   # 수동 실행(workflow_dispatch) 워크플로우
├── postman/
│   ├── mobility-state-injection.postman_collection.json   # 상태 주입 & 검증 컬렉션
│   └── environments/
│       ├── local.postman_environment.json   # 목 서버용 (기본값 포함)
│       ├── alpha.postman_environment.json    # 값은 CI 시크릿/변수로 주입
│       └── dev.postman_environment.json
├── spec/openapi.yaml                # 익명화한 test-support API 스펙
├── mock/server.js                   # 로컬/CI 검증용 목 서버 (상태 저장 & 반영)
├── scripts/run-newman.sh            # Newman 실행 래퍼 (env/domain 인자)
└── package.json
```

## 컬렉션이 검증하는 것

| 도메인 | 요청 | 주입값 | 검증 |
| --- | --- | --- | --- |
| 카셰어링 | `PUT /test/cars/:car_id` | `is_door_open=true` | 200 · 응답 스키마 · 값 반영 |
| 카셰어링 | `PUT /test/cars/:car_id` | `is_engine_on=true` | 200 · 값 반영 |
| 카셰어링 | `PUT /test/cars/:car_id` | `remaining_percentage=15` | 200 · 경계값 정확히 반영 |
| 비대면 | `PUT /test/cars/:car_id` | `is_locked=false` | 200 · 값 반영 |
| 비대면 | `PUT /test/cars/:car_id` | `remaining_percentage=150` | 422 (범위 초과 거부) |
| 공통 | `GET /test/cars/:car_id` | – | 200 · 필수 필드 · car_id 일치 |

---

## 로컬 실행

```bash
npm install

# 목 서버 대상 전체 실행
npm test

# 도메인만 골라서
npm run test:carsharing
npm run test:contactless
```

리포트는 `reports/report.html`(htmlextra), `reports/junit.xml` 로 생성된다.

## GitHub Actions에서 실행

1. 레포 **Actions** 탭 → **"API 상태값 주입 테스트"** → **Run workflow**
2. 입력값 선택
   - `environment`: `local`(목 서버, 시크릿 불필요) / `alpha` / `dev`
   - `targets`: 실행할 **폴더 또는 요청 이름**을 쉼표로 나열 (비우면 전체).
     포스트맨에서 폴더/요청 골라 Send 하는 것과 동일하게 동작한다.
     - `카셰어링` — 카셰어링 폴더 전체
     - `카셰어링,비대면` — 두 폴더
     - `문 열림 상태 주입 (is_door_open=true)` — 특정 요청 하나만

> `environment` 가 `local` 이 아니면 리포트에서 요청/응답 본문을 자동 제외한다
> (공개 Actions 로그·아티팩트로 실데이터가 새지 않도록).

### alpha / dev 로 실제 서버를 대상으로 하려면

레포 **Settings → Environments** 에서 `alpha`, `dev` 환경을 만들고 각각 등록:

| 종류 | 이름 | 예시 |
| --- | --- | --- |
| Variable | `BASE_URL` | `https://api-alpha.example-mobility.internal` |
| Secret | `ACCESS_TOKEN` | (테스트 계정 Bearer 토큰) |
| Variable | `CAR_ID` | `TEST-CAR-0001` (선택) |

`run-newman.sh` 가 `--env-var` 로 이 값들을 컬렉션에 주입하므로, 환경 파일에는 비밀 값을 커밋하지 않는다.
