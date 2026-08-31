/**
 * 로컬/CI 검증용 목(mock) 서버.
 * "차량 테스트 픽스처" API(`/test-fixtures/vehicles/:vehicle_id`)의 상태 주입 동작을
 * 메모리 스토어로 재현한다. (실제 사내 API 와는 무관한 가상 스펙)
 * - PUT  /test-fixtures/vehicles/:id          상태값 부분 갱신 후 전체 상태 응답
 * - GET  /test-fixtures/vehicles/:id          전체 상태 조회
 * - GET  /test-fixtures/vehicles/:id/status   위치 + 문/시동 상태만 조회
 */
const express = require('express');

const app = express();
app.use(express.json());

const store = new Map();

const ENUMS = {
  door_state: ['OPEN', 'CLOSED'],
  power_state: ['ON', 'OFF'],
  lock_state: ['LOCKED', 'UNLOCKED'],
};
const NUMERIC = {
  charge_percent: [0, 100],
  latitude: [-90, 90],
  longitude: [-180, 180],
};
const EDITABLE = [...Object.keys(ENUMS), ...Object.keys(NUMERIC)];

function defaults(vehicleId) {
  return {
    vehicle_id: vehicleId,
    door_state: 'CLOSED',
    power_state: 'OFF',
    lock_state: 'LOCKED',
    charge_percent: 100,
    location: { latitude: 37.5665, longitude: 126.978 },
    updated_at: new Date().toISOString(),
  };
}

function getVehicle(vehicleId) {
  if (!store.has(vehicleId)) store.set(vehicleId, defaults(vehicleId));
  return store.get(vehicleId);
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 위치 + 문/시동 상태만 추린 조회용 뷰
app.get('/test-fixtures/vehicles/:vehicleId/status', (req, res) => {
  const v = getVehicle(req.params.vehicleId);
  res.json({
    vehicle_id: v.vehicle_id,
    location: v.location,
    door_state: v.door_state,
    power_state: v.power_state,
  });
});

app.get('/test-fixtures/vehicles/:vehicleId', (req, res) => {
  res.json(getVehicle(req.params.vehicleId));
});

app.put('/test-fixtures/vehicles/:vehicleId', (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.length <= 'Bearer '.length) {
    return res.status(401).json({ message: 'unauthorized' });
  }

  const body = req.body || {};
  const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k));
  if (unknown.length > 0) {
    return res.status(422).json({ message: `unknown fields: ${unknown.join(', ')}` });
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (key in body && !allowed.includes(body[key])) {
      return res.status(422).json({ message: `${key} must be one of: ${allowed.join(', ')}` });
    }
  }
  for (const [key, [min, max]] of Object.entries(NUMERIC)) {
    if (key in body) {
      const v = body[key];
      if (typeof v !== 'number' || v < min || v > max) {
        return res.status(422).json({ message: `${key} must be a number between ${min} and ${max}` });
      }
    }
  }

  const vehicle = getVehicle(req.params.vehicleId);
  for (const key of Object.keys(ENUMS)) {
    if (key in body) vehicle[key] = body[key];
  }
  if ('charge_percent' in body) vehicle.charge_percent = body.charge_percent;
  if ('latitude' in body) vehicle.location.latitude = body.latitude;
  if ('longitude' in body) vehicle.location.longitude = body.longitude;
  vehicle.updated_at = new Date().toISOString();
  res.json(vehicle);
});

const port = process.env.PORT || 4010;
app.listen(port, () => console.log(`[mock] vehicle test-fixture API listening on :${port}`));
