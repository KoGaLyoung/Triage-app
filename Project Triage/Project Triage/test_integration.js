// End-to-end pipeline integration test:
// answers (from question flow) → buildTTASInput → TTAS.evaluate → result
const TTAS = require('./js/ttas_engine.js');
const QD = require('./js/questions_data.js');

let pass = 0, fail = 0;

function test(name, answers, ageGroup, pregnancy, expectedLevel, debug) {
  const input = QD.buildTTASInput(answers, ageGroup, pregnancy);
  const r = TTAS.evaluate(input);
  const ok = expectedLevel.some(l => r.level === l);
  console.log((ok ? '✅' : '❌') + ' ' + name + ' → ' + r.level + ' (' + r.primaryCategory + ': ' + r.primaryReason + ')');
  if (ok) pass++; else fail++;
  if (!ok) {
    console.log('   Expected: ' + expectedLevel.join('/'));
    console.log('   Input: ' + JSON.stringify(input));
    if (debug) console.log('   Findings: ' + JSON.stringify(r.allFindings));
  }
}

// ── Scenario 1: Adult chest pain, heavy central pain ──
test('U1: Adult chest pain 9/10 central (crushing)',
  { _chiefComplaint: 'chest', isPediatric: false, consciousnessRaw: 'alert', painScore: 9, painType: 'central', spo2: 96, hr: 85, sbp: 128, dbp: 80, temp: 36.5 },
  'adult', false, [2, 1]);

// ── Scenario 2: Adult minor cold → Level 4/5 diversion ──
test('U2: Adult mild cold (pain 2, normal vitals)',
  { _chiefComplaint: 'minor', isPediatric: false, painScore: 2, temp: 37.2 },
  'adult', false, [5, 4]);

// ── Scenario 3: Adult fever 39.2 looks well → Level 4 ──
test('U3: Adult fever 39.2 looks well',
  { _chiefComplaint: 'fever', isPediatric: false, temp: 39.2, looksIll: false, immunocompromised: false, spo2: 97, rr: 16, hr: 85, sbp: 120, dbp: 80, consciousnessRaw: 'alert' },
  'adult', false, [4]);

// ── Scenario 4: Pediatric <3mo fever 38.7 → Level 2 ──
test('U4: Infant <3m fever 38.7',
  { _chiefComplaint: 'fever', isPediatric: true, infantAge: 'under_3m', temp: 38.7, looksIll: false, spo2: 97, consciousnessRaw: 'alert' },
  'pediatric', false, [2]);

// ── Scenario 5: Adult high-risk car mechanism → Level 2 ──
test('U5: Adult car ejection mechanism',
  { _chiefComplaint: 'trauma', isPediatric: false, trauma_mechanism: 'car_accident', mechanism: 'car_ejected', painScore: 4, painType: 'central', spo2: 97, hr: 90, sbp: 120, dbp: 80, temp: 36.5, consciousnessRaw: 'alert' },
  'adult', false, [2]);

// ── Scenario 6: Pregnant adult + high-risk trauma → Level 1 ──
test('U6: Pregnant adult gunshot → Level 1',
  { _chiefComplaint: 'trauma', isPediatric: false, trauma_mechanism: 'gunshot', mechanism: 'gunshot', painScore: 5, painType: 'central', spo2: 97, consciousnessRaw: 'alert' },
  'adult', true, [1]);

// ── Scenario 7: Adult abdominal pain moderate central → Level 3 ──
test('U7: Adult abdominal pain 6/10 central',
  { _chiefComplaint: 'abdomen', isPediatric: false, painScore: 6, painType: 'central', temp: 37.5, spo2: 98, hr: 80, sbp: 120, dbp: 80, consciousnessRaw: 'alert' },
  'adult', false, [3]);

// ── Scenario 8: Adult HEAVY trauma pain 8/10 peripheral → Level 3 ──
test('U8: Adult deep laceration pain 8/10 peripheral',
  { _chiefComplaint: 'trauma', isPediatric: false, trauma_mechanism: 'penetrating', painScore: 8, painType: 'peripheral', spo2: 98, hr: 85, sbp: 125, dbp: 80, temp: 36.8, consciousnessRaw: 'alert' },
  'adult', false, [3]);

// ── Scenario 9: Adult confusion (GCS altered) → Level 2 ──
test('U9: Adult confused states (GCS 12)',
  { _chiefComplaint: 'neuro', isPediatric: false, consciousnessRaw: 'confused', painScore: 0, spo2: 97, hr: 80, sbp: 120, dbp: 80, temp: 36.5 },
  'adult', false, [2]);

// ── Scenario 10: Pediatric fall 1.5m from child 1.1m → not high risk, mild peripheral pain → Level 4/5 ──
test('U10: Peds fall below 2x height (1.5m, child 1.1m)',
  { _chiefComplaint: 'trauma', isPediatric: true, infantAge: 'over_3y', trauma_mechanism: 'fall_height', fallHeight: 1.5, childHeight: 1.1, painScore: 3, painType: 'peripheral', spo2: 98, temp: 36.5, consciousnessRaw: 'alert' },
  'pediatric', false, [5, 4]);

// ── Scenario 11: Pediatric fall above 2x height → Level 2 ──
test('U11: Peds fall above 2x height (3m, child 1.1m)',
  { _chiefComplaint: 'trauma', isPediatric: true, infantAge: 'over_3y', trauma_mechanism: 'fall_height', fallHeight: 3, childHeight: 1.1, painScore: 4, painType: 'peripheral', spo2: 98, temp: 36.5, consciousnessRaw: 'alert' },
  'pediatric', false, [2]);

// ── Scenario 12: Adult suicide attempt → Level 1/2 with crisis line ──
test('U12: Adult suicide attempt',
  { _chiefComplaint: 'mental', isPediatric: false, mentalCategoryRaw: 'suicide_attempt', painScore: 0, spo2: 98, hr: 85, sbp: 120, dbp: 80, consciousnessRaw: 'alert' },
  'adult', false, [1, 2]);

// ── Scenario 13: Adult SpO2 88 (severe hypoxia) → Level 1 ──
test('U13: Adult SpO2 88',
  { _chiefComplaint: 'chest', isPediatric: false, consciousnessRaw: 'alert', painScore: 3, painType: 'central', spo2: 88, hr: 110, sbp: 100, dbp: 70, temp: 36.5 },
  'adult', false, [1]);

// ── Scenario 14: Adult SBP 65 → Level 1 shock ──
test('U14: Adult SBP 65 profound shock',
  { _chiefComplaint: 'trauma', isPediatric: false, trauma_mechanism: 'car_accident', mechanism: 'car_rollover', painScore: 6, painType: 'central', spo2: 90, hr: 125, sbp: 65, dbp: 40, temp: 36.0, consciousnessRaw: 'drowsy' },
  'adult', false, [1]);

// ── Scenario 15: Adult MI-like hypertension emergency symptomatic ──
test('U15: Adult HTN emergency symptomatic SBP 225',
  { _chiefComplaint: 'chest', isPediatric: false, painScore: 4, painType: 'central', spo2: 95, hr: 95, sbp: 225, dbp: 130, hypertensiveSymptoms: true, consciousnessRaw: 'alert' },
  'adult', false, [2]);

// ── Scenario 16: Adult mild peripheral pain level 2/10 → Level 5 ──
test('U16: Adult mild hand injury pain 2/10 peripheral',
  { _chiefComplaint: 'minor', isPediatric: false, painScore: 2, painType: 'peripheral', temp: 36.6 },
  'adult', false, [5]);

console.log('');
console.log('──────────────────────────────');
console.log('PIPELINE RESULTS: ' + pass + ' passed, ' + fail + ' failed');
console.log('──────────────────────────────');
process.exit(fail > 0 ? 1 : 0);