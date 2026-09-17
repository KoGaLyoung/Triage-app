// TTAS Engine test harness
const TTAS = require('./js/ttas_engine.js');

let passCount = 0;
let failCount = 0;

function test(name, input, expectedLevel) {
  const r = TTAS.evaluate(input);
  const pass = expectedLevel.some(l => r.level === l);
  console.log((pass ? '✅' : '❌') + ' ' + name + ' → ' + r.level + ' (' + r.primaryCategory + ': ' + r.primaryReason + ')');
  if (pass) passCount++; else failCount++;
  if (!pass) {
    console.log('   Expected: ' + expectedLevel.join('/'));
    console.log('   Findings: ' + JSON.stringify(r.allFindings));
  }
}

// Level 1: Severe respiratory distress, SpO2 < 90
test('L1: SpO2=85 severe respiratory', {
  ageGroup: 'adult', spo2: 85, respiratoryDistress: 'severe'
}, [1]);

// Level 1: Profound shock SBP < 70
test('L1: SBP=65 profound shock', { ageGroup: 'adult', sbp: 65 }, [1]);

// Level 2: HR > 140 without shock
test('L2: HR=150', { ageGroup: 'adult', hr: 150 }, [2]);

// Level 2: MAP < 65
test('L2: MAP < 65 (90/50)', { ageGroup: 'adult', sbp: 90, dbp: 50 }, [2]);

// Level 2: GCS 10
test('L2: GCS=10', { ageGroup: 'adult', gcs: 10 }, [2]);

// Level 1: GCS 6
test('L1: GCS=6', { ageGroup: 'adult', gcs: 6 }, [1]);

// Level 2: Temp > 41
test('L1: Temp=41.5', { ageGroup: 'adult', temp: 41.5 }, [1]);

// Level 2: < 3mo infant temp > 38
test('L2: infant <3m temp=38.5', { ageGroup: 'pediatric', infantAge: 'under_3m', temp: 38.5 }, [2]);

// Level 2: Pain 9 central
test('L2: Pain 9/10 central', { ageGroup: 'adult', painScore: 9, painType: 'central' }, [2]);

// Level 4: Pain 6 peripheral (中度周邊 = 4級 per 表五)
test('L4: Pain 6/10 peripheral', { ageGroup: 'adult', painScore: 6, painType: 'peripheral' }, [4]);

// Level 3: Pain 6 central (中度中樞 = 3級 per 表五)
test('L3: Pain 6/10 central', { ageGroup: 'adult', painScore: 6, painType: 'central' }, [3]);

// Level 3: Pain 8 peripheral
test('L3: Pain 8/10 peripheral', { ageGroup: 'adult', painScore: 8, painType: 'peripheral' }, [3]);

// Level 2: High risk mechanism - ejected
test('L2: car ejected mechanism', { ageGroup: 'adult', mechanism: 'car_ejected' }, [2]);

// Level 1: Pregnancy + high-risk trauma
test('L1: Pregnancy + high-risk mechanism', { ageGroup: 'adult', mechanism: 'gunshot', pregnancy: true }, [1]);

// Level 2: Hypertension emergency symptomatic
test('L2: HTN emergency w/ symptoms SBP=230', { ageGroup: 'adult', sbp: 230, hypertensiveSymptoms: true }, [2, 3]);

// Level 2: Life-threatening bleed
test('L2: Life-threatening bleeding', { ageGroup: 'adult', bleedingType: 'life_threatening' }, [2]);

// Level 5: Default minor issue
test('L5: No findings (default)', { ageGroup: 'adult' }, [5]);

// Level 2: Suicide attempt
test('L2: Suicide attempt', { ageGroup: 'adult', mentalHealthCategory: 'suicide_attempt' }, [1, 2]);

// Pediatric: HR < 100 for under 3m
test('L2: Peds infant HR=90', { ageGroup: 'pediatric', infantAge: 'under_3m', hr: 90 }, [2]);

// Pediatric: pain 9 = L2
test('L2: Peds pain 9/10', { ageGroup: 'pediatric', painScore: 9 }, [2]);

// Level 4: Temp 39 looks well adult
test('L4: Adult fever 39 looks well', { ageGroup: 'adult', temp: 39, looksIll: false }, [4]);

// Level 2: fever looks ill adult
test('L2: Adult fever 39 looks ill', { ageGroup: 'adult', temp: 39, looksIll: true }, [2]);

// Level 2: fever immunocompromised
test('L2: Adult fever 38.5 immunocompromised', { ageGroup: 'adult', temp: 38.5, immunocompromised: true }, [2]);

// Level 3: mild respiratory distress + SpO2 93
test('L3: Mild respiratory distress + SpO2=93', { ageGroup: 'adult', respiratoryDistress: 'mild', spo2: 93 }, [3]);

// Capillary refill > 4s peds
test('L1: Peds capillary refill 5s', { ageGroup: 'pediatric', capillaryRefill: 5 }, [1]);

// Pediatric mechanism 2x height fall
test('L2: Peds fall > 2x height', { ageGroup: 'pediatric', mechanism: 'fall_height', fallHeight: 3, childHeight: 1.2 }, [2]);

// Level 3: moderate bleeding
test('L3: Moderate bleeding', { ageGroup: 'adult', bleedingType: 'moderate' }, [3]);

// Mental health: suicide ideation with plan
test('L2: Suicide ideation with plan', { ageGroup: 'adult', mentalHealthCategory: 'suicidal_ideation', mentalHealthSeverity: 'with_plan' }, [2]);

// Mental health: mild anxiety
test('L4: Mild anxiety', { ageGroup: 'adult', mentalHealthCategory: 'mild_anxiety' }, [4]);

console.log('');
console.log('──────────────────────────────');
console.log('RESULTS: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('──────────────────────────────');
process.exit(failCount > 0 ? 1 : 0);