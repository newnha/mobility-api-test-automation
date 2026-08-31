# mobility-api-test-automation

모빌리티 차량 상태값을 API로 직접 주입하고, 그 반영 여부를 자동으로 검증하는 테스트 자동화 프로젝트.
**Postman 컬렉션 + Newman(CLI) + GitHub Actions(수동 실행)** 로 구성했다.

> 이 레포의 API 스펙(`spec/openapi.yaml`)·목 서버·필드명은 실제 사내 API 와 무관하게
> 재구성한 **가상 스펙**이다. (경로 `PUT /test-fixtures/vehicles/:vehicle_id`,
> 필드 `door_state` / `power_state` / `lock_state` / `charge_percent`)

---

## 2. API 상태값 조작과 테스트 데이터 세팅 자동화

### 문제 (needs)
- 모빌리티 도메인 특성상 차량의 문 잠금이나 시동, 배터리 잔량 같은 상태와 예외 상황을 테스트하려면,
  실제 앱 화면을 복잡하게 거치거나 선행 조건을 수동으로 세팅해야 했음.
- 반복적인 수동 컨디션 세팅으로 테스트 준비에 리소스가 낭비됐음.

### 설계
- Swagger 명세를 바탕으로 카셰어링과 비대면 같은 도메인별 핵심 상태 변경 API를 Postman 컬렉션으로
  정리해 테스트 환경을 구성함.
- UI를 거치지 않고 요청 데이터에 상태값(문 열림/시동/배터리 잔량 등)을 직접 넣어 원하는 조건을
  빠르게 생성함. 각 요청은 응답 스키마와 주입값 반영 여부를 함께 검증함.
- GitHub Actions의 `workflow_dispatch`로 alpha·dev 같은 실행 환경을 선택해 수동 실행하도록 만들고,
  Newman으로 Postman 컬렉션을 실행해 반복 검증을 파이프라인으로 만들었음.
  도메인 폴더(카셰어링·비대면)는 별도 job으로 나눠 병렬 실행됨.

### 결과와 한계
- 복잡한 예외 상황과 경계값 테스트를 위한 데이터 세팅 과정을 간소화함.
- 사내에서 쓰던 API 툴을 검증 영역으로 확장해, 팀 누구나 같은 조건을 재현할 수 있는 방향으로 넓힘.
- 한계: 실행 환경(alpha/dev)의 인증 토큰·baseURL 을 외부에서 주입받는 구조라, 실제 사내망 연동은
  시크릿 설정이 선행되어야 함. 공개 레포에서는 목 서버(`local`) 기준으로만 상시 검증됨.

---

## 프로젝트 구조

```
.
├── .github/workflows/api-test.yml   # 수동 실행(workflow_dispatch), 폴더별 병렬 job
├── postman/
│   ├── mobility-state-injection.postman_collection.json   # 상태 주입 & 검증 컬렉션
│   └── environments/
│       ├── local.postman_environment.json   # 목 서버용 (기본값 포함)
│       ├── alpha.postman_environment.json    # 값은 CI 시크릿/변수로 주입
│       └── dev.postman_environment.json
├── spec/openapi.yaml                # 가상 test-fixture API 스펙
├── mock/server.js                   # 로컬/CI 검증용 목 서버 (상태 저장 & 반영)
├── scripts/run-newman.sh            # Newman 실행 래퍼 (env / 대상 인자)
└── package.json
```

## 컬렉션이 검증하는 것

| 폴더 | 요청 | 주입값 | 검증 |
| --- | --- | --- | --- |
| 카셰어링 | `PUT /test-fixtures/vehicles/:id` | `door_state=OPEN` | 200 · 응답 스키마 · 값 반영 |
| 카셰어링 | `PUT /test-fixtures/vehicles/:id` | `power_state=ON` | 200 · 값 반영 |
| 카셰어링 | `PUT /test-fixtures/vehicles/:id` | `charge_percent=15` | 200 · 경계값 정확히 반영 |
| 카셰어링 | `GET /test-fixtures/vehicles/:id/status` | – | 200 · 위/경도 좌표 · 문/시동 상태 유효 |
| 비대면 | `PUT /test-fixtures/vehicles/:id` | `lock_state=UNLOCKED` | 200 · 값 반영 |
| 비대면 | `PUT /test-fixtures/vehicles/:id` | `charge_percent=150` | 422 (범위 초과 거부) |
| 공통 | `GET /test-fixtures/vehicles/:id` | – | 200 · 필수 필드 · id 일치 |

---

## 로컬 실행

```bash
npm install

# 목 서버 대상 전체 실행
npm test

# 폴더만 골라서
npm run test:carsharing
npm run test:contactless
```

리포트는 `reports/report.html`(htmlextra), `reports/junit.xml` 로 생성된다.

## GitHub Actions에서 실행

1. 레포 **Actions** 탭 → **"API 상태값 주입 테스트"** → **Run workflow**
2. 입력값
   - `environment`: `local`(목 서버, 시크릿 불필요) / `alpha` / `dev`
   - `targets`: 실행할 **폴더 또는 요청 이름**을 쉼표로 나열.
     포스트맨에서 폴더/요청 골라 Send 하는 것과 동일하게 동작한다.
     - **비우면** → `카셰어링` / `비대면` / `공통` 이 **각각 별도 job으로 병렬 실행**
     - `카셰어링,비대면` → 두 폴더만
     - `문 열림 상태 세팅 (door_state=OPEN)` → 특정 요청 하나만

> `environment` 가 `local` 이 아니면 리포트에서 요청/응답 본문을 자동 제외한다
> (공개 Actions 로그·아티팩트로 실데이터가 새지 않도록).

### alpha / dev 로 실제 서버를 대상으로 하려면

레포 **Settings → Environments** 에서 `alpha`, `dev` 환경을 만들고 각각 등록:

| 종류 | 이름 | 예시 |
| --- | --- | --- |
| Variable | `BASE_URL` | `https://vehicle-fixtures.alpha.example.test` |
| Secret | `ACCESS_TOKEN` | (테스트 계정 Bearer 토큰) |
| Variable | `VEHICLE_ID` | `FIXTURE-0001` (선택) |

`run-newman.sh` 가 `--env-var` 로 이 값들을 컬렉션에 주입하므로, 환경 파일에는 비밀 값을 커밋하지 않는다.
