/**
 * 로컬/CI 검증용 목(mock) 서버.
 * "차량 테스트 픽스처" API(`/test-fixtures/vehicles/:vehicle_id`)의 상태 주입 동작을
 * 메모리 스토어로 재현한다. (실제 사내 API 와는 무관한 가상 스펙)
 * - PUT: 전달한 필드만 부분 갱신하고 갱신된 상태를 그대로 응답 (상태값 반영 검증 가능)
 * - GET: 현재 상태 조회
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
const EDITABLE = [...Object.keys(ENUMS), 'charge_percent'];

function defaults(vehicleId) {
  return {
    vehicle_id: vehicleId,
    door_state: 'CLOSED',
    power_state: 'OFF',
    lock_state: 'LOCKED',
    charge_percent: 100,
    updated_at: new Date().toISOString(),
  };
}

function getVehicle(vehicleId) {
  if (!store.has(vehicleId)) store.set(vehicleId, defaults(vehicleId));
  return store.get(vehicleId);
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

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
  if ('charge_percent' in body) {
    const v = body.charge_percent;
    if (typeof v !== 'number' || v < 0 || v > 100) {
      return res.status(422).json({ message: 'charge_percent must be a number between 0 and 100' });
    }
  }

  const vehicle = getVehicle(req.params.vehicleId);
  for (const key of EDITABLE) {
    if (key in body) vehicle[key] = body[key];
  }
  vehicle.updated_at = new Date().toISOString();
  res.json(vehicle);
});

const port = process.env.PORT || 4010;
app.listen(port, () => console.log(`[mock] vehicle test-fixture API listening on :${port}`));
