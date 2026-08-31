/**
 * 로컬/CI 검증용 목(mock) 서버.
 * 사내 test-support API(`/test/cars/:car_id`)의 상태 주입 동작을 메모리 스토어로 재현한다.
 * - PUT: 전달한 필드만 부분 갱신하고 갱신된 상태를 그대로 응답 (상태값 반영 검증이 가능하도록)
 * - GET: 현재 상태 조회
 */
const express = require('express');

const app = express();
app.use(express.json());

const store = new Map();
const EDITABLE = ['is_door_open', 'is_engine_on', 'is_locked', 'remaining_percentage'];

function getCar(carId) {
  if (!store.has(carId)) {
    store.set(carId, {
      car_id: carId,
      is_door_open: false,
      is_engine_on: false,
      is_locked: true,
      remaining_percentage: 100,
      updated_at: new Date().toISOString(),
    });
  }
  return store.get(carId);
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/test/cars/:carId', (req, res) => {
  res.json(getCar(req.params.carId));
});

app.put('/test/cars/:carId', (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.length <= 'Bearer '.length) {
    return res.status(401).json({ message: 'unauthorized' });
  }

  const body = req.body || {};
  const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k));
  if (unknown.length > 0) {
    return res.status(422).json({ message: `unknown fields: ${unknown.join(', ')}` });
  }
  if ('remaining_percentage' in body) {
    const v = body.remaining_percentage;
    if (typeof v !== 'number' || v < 0 || v > 100) {
      return res.status(422).json({ message: 'remaining_percentage must be a number between 0 and 100' });
    }
  }

  const car = getCar(req.params.carId);
  for (const key of EDITABLE) {
    if (key in body) car[key] = body[key];
  }
  car.updated_at = new Date().toISOString();
  res.json(car);
});

const port = process.env.PORT || 4010;
app.listen(port, () => console.log(`[mock] mobility test-support API listening on :${port}`));
