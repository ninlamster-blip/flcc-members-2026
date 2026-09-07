import test from 'node:test';
import assert from 'node:assert/strict';
import * as heat from '../js/core/heat.js';

test('heat index tracks the NWS table where the table exists', () => {
  // 32 °C / 70 % is 90 °F / 70 % on the chart, which reads 105 °F (40.6 °C).
  assert.ok(Math.abs(heat.heatIndexC(32, 70) - 40.6) < 1.5);
  // 27 °C / 40 % is barely above the air temperature.
  assert.ok(Math.abs(heat.heatIndexC(27, 40) - 27) < 1.5);
});

test('dry heat is not made worse than it is', () => {
  // Kuwait's ordinary summer: hot and very dry. The dry-side adjustment has to
  // pull the index back down, not push it up.
  const dry = heat.heatIndexC(45, 10);
  const humid = heat.heatIndexC(45, 50);
  assert.ok(dry < humid, 'humidity must make the same temperature feel worse');
  assert.ok(dry < 50, `45 °C at 10 % should not read like 50 °C, got ${dry}`);
});

test('wet bulb matches known psychrometric values', () => {
  // Published wet-bulb values for these pairs, to within Stull's stated error.
  assert.ok(Math.abs(heat.wetBulbC(25, 40) - 16.3) < 0.6, heat.wetBulbC(25, 40));
  assert.ok(Math.abs(heat.wetBulbC(35, 70) - 30.2) < 0.6, heat.wetBulbC(35, 70));
  assert.ok(Math.abs(heat.wetBulbC(20, 100) - 20) < 0.6, heat.wetBulbC(20, 100));
});

test('wet bulb is always at or below the air temperature', () => {
  for (let t = 0; t <= 55; t += 5) {
    for (let rh = 5; rh <= 100; rh += 5) {
      assert.ok(heat.wetBulbC(t, rh) <= t + 0.3, `${t}°C / ${rh}% gave ${heat.wetBulbC(t, rh)}`);
    }
  }
});

test('WBGT stays in the range a WBGT can actually reach', () => {
  // The whole reason the BoM approximation was thrown out: at a Kuwait July
  // noon it returned a WBGT above 43 °C. Nothing on earth has recorded that.
  const noon = heat.wbgtC(48, 22, { isDay: true, cloudCover: 0, windKmh: 18 });
  assert.ok(noon > 30 && noon < 40, `48 °C / 22 % gave WBGT ${noon}`);
});

test('humidity, not temperature, is what makes a WBGT dangerous', () => {
  const dryExtreme = heat.wbgtC(48, 15, { isDay: true, windKmh: 15 });
  const humidLess = heat.wbgtC(40, 65, { isDay: true, windKmh: 15 });
  assert.ok(humidLess > dryExtreme - 1,
    `40 °C at 65 % (${humidLess}) should be comparable to 48 °C at 15 % (${dryExtreme})`);
});

test('wind and cloud both take the edge off, and night removes the sun entirely', () => {
  const still = heat.wbgtC(45, 20, { isDay: true, cloudCover: 0, windKmh: 0 });
  const windy = heat.wbgtC(45, 20, { isDay: true, cloudCover: 0, windKmh: 40 });
  const cloudy = heat.wbgtC(45, 20, { isDay: true, cloudCover: 100, windKmh: 0 });
  const night = heat.wbgtC(45, 20, { isDay: false });
  assert.ok(windy < still, 'wind must reduce WBGT');
  assert.ok(cloudy < still, 'cloud must reduce WBGT');
  assert.equal(night, heat.wbgtShadeC(45, 20), 'night is the shade weighting');
  assert.ok(night < still);
});

test('globe temperature never falls below air temperature', () => {
  for (const wind of [0, 10, 40, 100]) {
    for (const cloud of [0, 50, 100]) {
      assert.ok(heat.globeTempC(40, { isDay: true, cloudCover: cloud, windKmh: wind }) >= 40);
    }
  }
  assert.equal(heat.globeTempC(40, { isDay: false }), 40);
});

test('work and rest step down as WBGT climbs, and never step back up', () => {
  let previousWork = Infinity;
  for (let w = 20; w <= 40; w += 0.5) {
    const band = heat.workRest(w);
    assert.ok(band.work <= previousWork, `WBGT ${w} gave more work than ${previousWork}`);
    previousWork = band.work;
  }
  assert.equal(heat.workRest(22).id, 'normal');
  assert.equal(heat.workRest(35).id, 'stop');
  assert.equal(heat.workRest(35).work, 0);
});

test('heavier work hits every band a degree earlier than lighter work', () => {
  const wbgt = 31.2;
  assert.equal(heat.workRest(wbgt, 'light').id, 'half');
  assert.equal(heat.workRest(wbgt, 'moderate').id, 'mostly-rest');
  assert.equal(heat.workRest(wbgt, 'heavy').id, 'stop');
});

test('an unknown work profile falls back to moderate rather than throwing', () => {
  assert.equal(heat.workProfile('nonsense').id, 'moderate');
  assert.deepEqual(heat.workRest(30, 'nonsense'), heat.workRest(30, 'moderate'));
});

test('heat bands cover the whole line with no gap', () => {
  for (let hi = -10; hi <= 70; hi += 0.5) {
    assert.ok(heat.heatBand(hi), `no band for heat index ${hi}`);
  }
  assert.equal(heat.heatBand(20).id, 'none');
  assert.equal(heat.heatBand(45).id, 'danger');
  assert.equal(heat.heatBand(60).id, 'extreme-danger');
});

test('the heat index says when it is past the range it was fitted for', () => {
  assert.ok(heat.heatIndexReliable(40));
  assert.ok(!heat.heatIndexReliable(48));
});

test('water guidance rises with the heat and stops at a litre', () => {
  assert.ok(heat.waterPerHourMl(25) < heat.waterPerHourMl(29));
  assert.equal(heat.waterPerHourMl(36), 1000);
});
