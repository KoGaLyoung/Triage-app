/**
 * TTAS Decision Engine
 * Taiwan Triage and Acuity Scale — Full implementation
 * Based on: 急診五級檢傷分類基準修正版-總表 (18 pages)
 *
 * Tables implemented:
 *  Table 1-4: Adult vital signs (respiratory, hemodynamic, consciousness, temperature)
 *  Table 5:   Adult pain severity (central vs peripheral)
 *  Table 6:   Adult high-risk mechanism of injury
 *  Table 7:   Hypertension emergency
 *  Table 8-9: Pediatric vital signs
 *  Table 10:  Pediatric pain severity
 *  Table 11:  Pediatric high-risk mechanism
 *  Table 12:  Bleeding / coagulopathy (adult & pediatric)
 *  Table 13:  Mental health (psychiatric)
 */

const TTAS = (() => {
  'use strict';

  // ── Level constants ──
  const LEVEL = Object.freeze({
    LEVEL_1: 1, // 復甦急救 — Resuscitation
    LEVEL_2: 2, // 危急 — Emergent
    LEVEL_3: 3, // 緊急 — Urgent
    LEVEL_4: 4, // 次緊急 — Less Urgent
    LEVEL_5: 5, // 非緊急 — Non-Urgent
  });

  const LEVEL_NAMES = {
    1: '一級 — 復甦急救',
    2: '二級 — 危急',
    3: '三級 — 緊急',
    4: '四級 — 次緊急',
    5: '五級 — 非緊急',
  };

  const LEVEL_LABELS = {
    1: '復甦急救',
    2: '危急',
    3: '緊急',
    4: '次緊急',
    5: '非緊急',
  };

  const LEVEL_COLORS = {
    1: 'level-1',
    2: 'level-2',
    3: 'level-3',
    4: 'level-4',
    5: 'level-5',
  };

  const LEVEL_EMOJI = {
    1: '🚨',
    2: '🔴',
    3: '🟡',
    4: '🟢',
    5: '🔵',
  };

  // ── Helper: return worst (lowest number) level from array ──
  function worstLevel(...levels) {
    const valid = levels.filter(l => l !== null && l !== undefined && l >= 1 && l <= 5);
    return valid.length > 0 ? Math.min(...valid) : null;
  }

  // ──────────────────────────────────────────────
  // 1. RESPIRATORY — Tables 1 (adult) & 8 (peds)
  // ──────────────────────────────────────────────
  function evaluateRespiratory(data) {
    const { spo2, rr, speechLevel, airway, respiratoryDistress } = data;

    // Level 1: Severe distress, single words/unable to speak, SpO2 < 90%, RR < 10
    if (spo2 !== undefined && spo2 < 90) return { level: LEVEL.LEVEL_1, reason: '血氧飽和度 SpO2 < 90%' };
    if (rr !== undefined && rr < 10) return { level: LEVEL.LEVEL_1, reason: '呼吸次數 < 10 次/分' };
    if (speechLevel === 'single_word' || speechLevel === 'unable') return { level: LEVEL.LEVEL_1, reason: '僅能說出單一字或無法言語' };
    if (respiratoryDistress === 'severe') return { level: LEVEL.LEVEL_1, reason: '重度呼吸窘迫：呼吸衰竭、發紺及意識混亂' };
    if (airway === 'upper_obstruction') return { level: LEVEL.LEVEL_1, reason: '上氣道阻塞' };

    // Level 2: Moderate distress, phrases/incomplete sentences, SpO2 < 92%, PEFR < 40%
    if (spo2 !== undefined && spo2 < 92) return { level: LEVEL.LEVEL_2, reason: '血氧飽和度 SpO2 < 92%' };
    if (speechLevel === 'phrases') return { level: LEVEL.LEVEL_2, reason: '僅能說出片語或不成句' };
    if (respiratoryDistress === 'moderate') return { level: LEVEL.LEVEL_2, reason: '中度呼吸窘迫：呼吸費力、使用呼吸輔助肌' };
    if (data.pefr !== undefined && data.pefr < 40) return { level: LEVEL.LEVEL_2, reason: '尖峰呼氣流速 < 40%' };

    // Level 3: Mild distress, can use sentences, SpO2 92-94%, PEFR 40-60%
    if (spo2 !== undefined && spo2 >= 92 && spo2 <= 94) return { level: LEVEL.LEVEL_3, reason: '血氧飽和度 SpO2 92%-94%' };
    if (respiratoryDistress === 'mild') return { level: LEVEL.LEVEL_3, reason: '輕度呼吸窘迫：走動時呼吸急促' };
    if (data.pefr !== undefined && data.pefr >= 40 && data.pefr <= 60) return { level: LEVEL.LEVEL_3, reason: '尖峰呼氣流速 40%-60%' };

    return null; // No respiratory finding → not a first-order modifier here
  }

  // ──────────────────────────────────────────────
  // 2. HEMODYNAMIC — Tables 2 (adult) & 9 (peds)
  // ──────────────────────────────────────────────
  function evaluateHemodynamic(data) {
    const { sbp, dbp, hr, map, shockSigns, ageGroup, infantAge } = data;

    // Calculate MAP if sbp and dbp are provided
    const calculatedMap = map !== undefined ? map : (sbp !== undefined && dbp !== undefined)
      ? ((sbp - dbp) / 3 + dbp) : undefined;

    // Level 1: Profound shock, SBP < 70
    if (sbp !== undefined && sbp < 70) return { level: LEVEL.LEVEL_1, reason: '絕對低血壓 SBP < 70mmHg' };
    if (sbp !== undefined && sbp < 90 && shockSigns) return { level: LEVEL.LEVEL_1, reason: '血壓偏低 SBP < 90mmHg 伴隨典型休克徵象' };
    if (hr !== undefined && (hr < 50 || hr > 140) && (shockSigns || (sbp !== undefined && sbp < 70)))
      return { level: LEVEL.LEVEL_1, reason: '心跳速率異常合併休克徵象或低血壓' };

    // Level 2: SBP < 90 without shock, HR < 50 or > 140 without shock, MAP < 65
    if (sbp !== undefined && sbp < 90 && !shockSigns)
      return { level: LEVEL.LEVEL_2, reason: '血壓偏低 SBP < 90mmHg（未有休克徵象）' };
    if (hr !== undefined && (hr < 50 || hr > 140) && !shockSigns)
      return { level: LEVEL.LEVEL_2, reason: '心跳速率異常 < 50 或 > 140 次/分' };
    if (calculatedMap !== undefined && calculatedMap < 65)
      return { level: LEVEL.LEVEL_2, reason: `平均動脈壓 MAP < 65mmHg（計算值: ${calculatedMap.toFixed(1)}）` };

    // Pediatric-specific: HR by age group
    if (ageGroup === 'pediatric' && hr !== undefined) {
      if (infantAge === 'under_3m' && hr < 100)
        return { level: LEVEL.LEVEL_2, reason: '嬰兒（< 3 個月）心跳 < 100 次/分' };
      if (infantAge === '3m_3y' && hr < 80)
        return { level: LEVEL.LEVEL_2, reason: '幼兒（3 個月 - 3 歲）心跳 < 80 次/分' };
      if (infantAge === 'over_3y' && hr < 60)
        return { level: LEVEL.LEVEL_2, reason: '兒童（> 3 歲）心跳 < 60 次/分' };
    }

    // Pediatric-specific: Capillary refill
    if (data.capillaryRefill !== undefined) {
      if (data.capillaryRefill > 4)
        return { level: LEVEL.LEVEL_1, reason: '微血管填充時間 > 4 秒' };
      if (data.capillaryRefill > 2)
        return { level: LEVEL.LEVEL_2, reason: '微血管填充時間 > 2 秒' };
    }

    // Pediatric-specific: cyanosis
    if (data.cyanosis === 'lips_mucosa')
      return { level: LEVEL.LEVEL_1, reason: '嘴唇、黏膜發紫' };
    if (data.cyanosis === 'extremities')
      return { level: LEVEL.LEVEL_2, reason: '肢端發紫、斑駁' };

    return null;
  }

  // ──────────────────────────────────────────────
  // 3. CONSCIOUSNESS — Tables 3 (adult) & 10 (peds)
  // ──────────────────────────────────────────────
  function evaluateConsciousness(data) {
    const { gcs, airwayProtection, responseToStimulus, consciousnessChange, ageGroup } = data;

    // Level 1: Unresponsive, GCS 3-8, cannot protect airway, no response
    if (gcs !== undefined && gcs >= 3 && gcs <= 8)
      return { level: LEVEL.LEVEL_1, reason: `昏迷指數 GCS ${gcs}（3-8）` };
    if (airwayProtection === 'unable')
      return { level: LEVEL.LEVEL_1, reason: '無法保護呼吸道' };
    if (responseToStimulus === 'none' || responseToStimulus === 'pain_no_purpose')
      return { level: LEVEL.LEVEL_1, reason: '對刺激無反應或僅出現無意義反應動作' };
    if (consciousnessChange === 'worsening')
      return { level: LEVEL.LEVEL_1, reason: '意識程度持續惡化' };

    // Pediatric-specific: seizures
    if (ageGroup === 'pediatric') {
      if (data.seizure === 'continuous')
        return { level: LEVEL.LEVEL_1, reason: '持續抽搐' };
      if (data.seizure === 'just_ended')
        return { level: LEVEL.LEVEL_2, reason: '剛抽搐結束' };
      if (data.muscleTone === 'paralyzed')
        return { level: LEVEL.LEVEL_1, reason: '肢體癱瘓' };
      if (data.muscleTone === 'weak')
        return { level: LEVEL.LEVEL_2, reason: '虛弱無力，無法坐起' };
    }

    // Level 2: GCS 9-13, altered mental status, disorientation
    if (gcs !== undefined && gcs >= 9 && gcs <= 13)
      return { level: LEVEL.LEVEL_2, reason: `昏迷指數 GCS ${gcs}（9-13）` };
    if (responseToStimulus === 'localize_pain')
      return { level: LEVEL.LEVEL_2, reason: '可定位痛點，含糊或不適當語言回應' };
    if (consciousnessChange === 'altered') {
      const reasons = [];
      if (data.orientation === false) reasons.push('對人、時、地失去定向感');
      if (data.memoryLoss) reasons.push('新發生的近期記憶障礙');
      if (data.behaviorChange) reasons.push('行為改變（激動、幻想或暴力動作）');
      const reason = reasons.length > 0 ? reasons.join('、') : '急性意識程度改變';
      return { level: LEVEL.LEVEL_2, reason };
    }

    // Pediatric-specific behavioral changes
    if (ageGroup === 'pediatric' && consciousnessChange === 'altered_behavioral') {
      return { level: LEVEL.LEVEL_2, reason: '疲倦昏睡、反應遲鈍、躁動不安、無法安撫' };
    }

    return null;
  }

  // ──────────────────────────────────────────────
  // 4. TEMPERATURE — Tables 4 (adult) & 11 (peds)
  // ──────────────────────────────────────────────
  function evaluateTemperature(data) {
    const { temp, ageGroup, infantAge, immunocompromised, looksIll, environmentalExposure } = data;

    if (temp === undefined || temp === null) return null;

    // Hyperthermia (> 38°C)
    if (temp > 38) {
      // Level 1: Core temp > 41°C
      if (temp > 41)
        return { level: LEVEL.LEVEL_1, reason: '中樞體溫 > 41°C' };

      // < 3 months infant: > 38°C → Level 2
      if (ageGroup === 'pediatric' && infantAge === 'under_3m')
        return { level: LEVEL.LEVEL_2, reason: '嬰兒（< 3 個月）體溫 > 38°C' };

      // Sepsis criteria: temp > 38 with ≥3 SIRS + organ dysfunction
      if (data.suspectedSepsis && data.sirsCount >= 3 &&
          (data.sepsisOrganDysfunction === true))
        return { level: LEVEL.LEVEL_2, reason: '疑似敗血症伴隨器官功能障礙及 SIRS ≥ 3 條件' };

      // Immunocompromised → Level 2
      if (immunocompromised)
        return { level: LEVEL.LEVEL_2, reason: '免疫功能缺陷合併發燒' };

      // Looks ill → Level 2 (adult) or Level 2/3 depending on age
      if (looksIll) {
        if (ageGroup === 'pediatric' && (infantAge === '3m_3y'))
          return { level: LEVEL.LEVEL_2, reason: '幼兒（≥ 3 個月 - 3 歲）看起來有病容' };
        if (ageGroup === 'pediatric' && (infantAge === 'over_3y'))
          return { level: LEVEL.LEVEL_3, reason: '兒童（> 3 歲）看起來有病容' };
        return { level: LEVEL.LEVEL_2, reason: '看起來有病容（疑似敗血症相關徵象）' };
      }

      // Looks well → Level 4 (adult) or Level 3/4 (peds)
      if (ageGroup === 'adult') {
        // Without specific concerns → not first-order modifier for adults at lower levels
        // but per table it shows for Level 4
        return { level: LEVEL.LEVEL_4, reason: '體溫過高但看起來無病容' };
      } else {
        // Pediatric ≥ 3 months - 3 years, looks well → Level 3
        if (infantAge === '3m_3y')
          return { level: LEVEL.LEVEL_3, reason: '幼兒（≥ 3 個月 - 3 歲）發燒但看起來無病容' };
        // Pediatric > 3 years, looks well → Level 4
        if (infantAge === 'over_3y')
          return { level: LEVEL.LEVEL_4, reason: '兒童（> 3 歲）發燒但看起來無病容' };
      }
    }

    // Hypothermia (< 35°C)
    if (temp < 35) {
      // Level 1: Core temp < 32°C (all ages)
      if (temp < 32)
        return { level: LEVEL.LEVEL_1, reason: '中樞體溫 < 32°C' };

      // < 3 months: 32-36°C → Level 2
      if (ageGroup === 'pediatric' && infantAge === 'under_3m' && temp >= 32 && temp <= 36)
        return { level: LEVEL.LEVEL_2, reason: '嬰兒（< 3 個月）體溫 < 36°C' };

      // 32-35°C environmental exposure → Level 2 (3 months+)
      if (temp >= 32 && temp <= 35 && environmentalExposure)
        return { level: LEVEL.LEVEL_2, reason: '環境暴露引起之低體溫 32-35°C' };
    }

    // Special: infant < 3 months with temp < 36°C (without environmental context)
    if (ageGroup === 'pediatric' && infantAge === 'under_3m' && temp < 36 && temp >= 32)
      return { level: LEVEL.LEVEL_2, reason: '嬰兒（< 3 個月）體溫 < 36°C' };

    return null;
  }

  // ──────────────────────────────────────────────
  // 5. PAIN SEVERITY — Table 5 (adult) & 10 (peds)
  // ──────────────────────────────────────────────
  function evaluatePain(data) {
    const { painScore, painType, ageGroup } = data;
    if (painScore === undefined || painScore === null) return null;

    // Pediatric: no central/peripheral distinction
    if (ageGroup === 'pediatric') {
      if (painScore >= 8) return { level: LEVEL.LEVEL_2, reason: `重度疼痛 (${painScore}/10)` };
      if (painScore >= 4) return { level: LEVEL.LEVEL_3, reason: `中度疼痛 (${painScore}/10)` };
      if (painScore >= 1) return { level: LEVEL.LEVEL_4, reason: `輕度疼痛 (${painScore}/10)` };
      return null;
    }

    // Adult: central vs peripheral
    const isCentral = painType === 'central'; // 頭、胸、腹、骨盆

    if (painScore >= 8) {
      // Heavy pain
      if (isCentral) return { level: LEVEL.LEVEL_2, reason: `重度中樞型疼痛 (${painScore}/10)` };
      return { level: LEVEL.LEVEL_3, reason: `重度周邊型疼痛 (${painScore}/10)` };
    }

    if (painScore >= 4) {
      // Moderate pain
      if (isCentral) return { level: LEVEL.LEVEL_3, reason: `中度中樞型疼痛 (${painScore}/10)` };
      return { level: LEVEL.LEVEL_4, reason: `中度周邊型疼痛 (${painScore}/10)` };
    }

    if (painScore >= 1) {
      // Mild pain
      if (isCentral) return { level: LEVEL.LEVEL_4, reason: `輕度中樞型疼痛 (${painScore}/10)` };
      return { level: LEVEL.LEVEL_5, reason: `輕度周邊型疼痛 (${painScore}/10)` };
    }

    return null;
  }

  // ──────────────────────────────────────────────
  // 6. HIGH-RISK MECHANISM — Tables 6 (adult) & 11 (peds)
  // ──────────────────────────────────────────────
  function evaluateMechanism(data) {
    const { mechanism, pregnancy, ageGroup, childHeight } = data;
    if (!mechanism) return null;

    // General trauma high-risk mechanisms → Level 2
    const generalMechanisms = [
      'car_ejected', 'car_rollover', 'car_trapped_20min',
      'car_seat_destroyed', 'car_passenger_died',
      'car_nobelt_40kph', 'car_belt_60kph',
      'motorcycle_hit_30kph', 'motorcycle_separated',
      'pedestrian_hit_30kph', 'bicycle_hit_30kph',
      'fall_6m', 'penetrating_head_neck_torso',
      'penetrating_upper_limb', 'gunshot',
    ];

    // Head trauma mechanisms → Level 2
    const headMechanisms = [
      'head_car_ejected', 'head_car_windshield',
      'head_pedestrian_hit', 'head_fall_1m',
      'head_blunt_attack',
    ];

    // Neck trauma mechanisms → Level 2
    const neckMechanisms = [
      'neck_car_ejected', 'neck_car_rollover',
      'neck_motorcycle_30kph', 'neck_fall_1m',
      'neck_vertical_impact',
    ];

    // Pediatric-specific fall threshold: > 2x child height
    if (ageGroup === 'pediatric' && mechanism === 'fall_height' && data.fallHeight && childHeight) {
      if (data.fallHeight > childHeight * 2)
        return { level: LEVEL.LEVEL_2, reason: '高處墜落（大於兒童身高 2 倍以上）' };
    }

    if (generalMechanisms.includes(mechanism) || headMechanisms.includes(mechanism) || neckMechanisms.includes(mechanism)) {
      const result = { level: LEVEL.LEVEL_2, reason: '高危險性受傷機轉' };
      // Pregnancy uptriage by 1 level
      if (pregnancy) {
        result.level = LEVEL.LEVEL_1;
        result.reason += '（懷孕者外傷上調一級）';
      }
      return result;
    }

    return null;
  }

  // ──────────────────────────────────────────────
  // 7. HYPERTENSION EMERGENCY — Table 7
  // ──────────────────────────────────────────────
  function evaluateHypertension(data) {
    const { sbp, dbp, hypertensiveSymptoms } = data;
    if (sbp === undefined && dbp === undefined) return null;

    const highSBP = sbp !== undefined && sbp >= 200;
    const highDBP = dbp !== undefined && dbp >= 110;

    if (!highSBP && !highDBP) return null;

    const severeSBP = sbp !== undefined && sbp >= 220;
    const severeDBP = dbp !== undefined && dbp >= 130;
    const severe = severeSBP || severeDBP;

    if (hypertensiveSymptoms) {
      // Symptomatic: Level 2 (severe) or Level 3 (moderate)
      return {
        level: severe ? LEVEL.LEVEL_2 : LEVEL.LEVEL_3,
        reason: `高血壓急症（有症狀）: SBP ${sbp}/${dbp}mmHg`,
      };
    } else {
      // Asymptomatic: Level 3 (severe) or Level 4 (moderate)
      return {
        level: severe ? LEVEL.LEVEL_3 : LEVEL.LEVEL_4,
        reason: `高血壓（無症狀）: SBP ${sbp}/${dbp}mmHg`,
      };
    }
  }

  // ──────────────────────────────────────────────
  // 8. BLEEDING / COAGULOPATHY — Table 12
  // ──────────────────────────────────────────────
  function evaluateBleeding(data) {
    const { bleedingType, bleedingSeverity } = data;

    if (bleedingType === 'life_threatening') {
      // Life-threatening or limb-threatening hemorrhage → Level 2
      return { level: LEVEL.LEVEL_2, reason: '危及生命或肢體的出血' };
    }

    if (bleedingType === 'moderate' || bleedingType === 'mild') {
      // Moderate/mild bleeding → Level 3
      return { level: LEVEL.LEVEL_3, reason: '中度或輕度出血' };
    }

    return null;
  }

  // ──────────────────────────────────────────────
  // 9. MENTAL HEALTH — Table 13
  // ──────────────────────────────────────────────
  function evaluateMentalHealth(data) {
    const { mentalHealthCategory, mentalHealthSeverity } = data;

    if (!mentalHealthCategory) return null;

    // Suicide attempt → Level 1/2
    if (mentalHealthCategory === 'suicide_attempt')
      return { level: LEVEL.LEVEL_1, reason: '企圖自殺（有明確尋死證據）' };

    // Active suicidal ideation with plan → Level 2
    if (mentalHealthCategory === 'suicidal_ideation' && mentalHealthSeverity === 'with_plan')
      return { level: LEVEL.LEVEL_2, reason: '自殺意念伴隨計畫' };

    // Suicidal ideation without plan → Level 2
    if (mentalHealthCategory === 'suicidal_ideation')
      return { level: LEVEL.LEVEL_2, reason: '自殺意念' };

    // Unstable behavior threatening self/others → Level 2
    if (mentalHealthCategory === 'unstable_behavior')
      return { level: LEVEL.LEVEL_2, reason: '不穩定行為，威脅自身或他人安全' };

    // Acute psychosis → Level 2
    if (mentalHealthCategory === 'acute_psychosis')
      return { level: LEVEL.LEVEL_2, reason: '急性精神病：失去現實感或病識感' };

    // Severe anxiety/agitation → Level 2
    if (mentalHealthCategory === 'severe_anxiety')
      return { level: LEVEL.LEVEL_2, reason: '重度焦慮/激動，危險情緒，無法配合' };

    // Uncontrollable behavior → Level 2
    if (mentalHealthCategory === 'uncontrollable_behavior')
      return { level: LEVEL.LEVEL_2, reason: '無法控制的怪異行為，可能造成危險' };

    // Controllable threatening behavior → Level 3
    if (mentalHealthCategory === 'controllable_behavior')
      return { level: LEVEL.LEVEL_3, reason: '具威脅性但可言語控制的行為' };

    // Moderate anxiety → Level 3
    if (mentalHealthCategory === 'moderate_anxiety')
      return { level: LEVEL.LEVEL_3, reason: '中度焦慮/激動，無法持續遵守指令' };

    // Chronic hallucinations, no change → Level 4/5
    if (mentalHealthCategory === 'chronic_hallucination')
      return { level: LEVEL.LEVEL_5, reason: '慢性幻覺/妄想，無新改變' };

    // Chronic non-urgent, frequent visitor → Level 5
    if (mentalHealthCategory === 'chronic_nonurgent')
      return { level: LEVEL.LEVEL_5, reason: '慢性非緊急狀況' };

    // Mild anxiety → Level 4
    if (mentalHealthCategory === 'mild_anxiety')
      return { level: LEVEL.LEVEL_4, reason: '輕度焦慮/激動，可接受安撫' };

    // Harmless behavior → Level 5
    if (mentalHealthCategory === 'harmless_behavior')
      return { level: LEVEL.LEVEL_5, reason: '無害的怪異行為' };

    return null;
  }

  // ──────────────────────────────────────────────
  // MAIN EVALUATION — Combine all assessments
  // ──────────────────────────────────────────────
  function evaluate(patientData) {
    const results = [];
    let worst = null;

    // Run all assessments
    const assessments = [
      { name: '呼吸', fn: evaluateRespiratory, data: patientData },
      { name: '血行動力', fn: evaluateHemodynamic, data: patientData },
      { name: '意識', fn: evaluateConsciousness, data: patientData },
      { name: '體溫', fn: evaluateTemperature, data: patientData },
      { name: '疼痛程度', fn: evaluatePain, data: patientData },
      { name: '受傷機轉', fn: evaluateMechanism, data: patientData },
      { name: '高血壓急症', fn: evaluateHypertension, data: patientData },
      { name: '出血', fn: evaluateBleeding, data: patientData },
      { name: '心理精神系統', fn: evaluateMentalHealth, data: patientData },
    ];

    for (const { name, fn, data } of assessments) {
      const result = fn(data);
      if (result) {
        results.push({ category: name, ...result });
        if (worst === null || result.level < worst.level) {
          worst = { category: name, ...result };
        }
      }
    }

    // Pregnancy uptriage for trauma (handled in evaluateMechanism)
    // General pregnancy uptriage: if pregnant and any Level 3+ finding, uptriage by 1
    if (patientData.pregnancy && worst && worst.level >= 3) {
      const uptriaged = { ...worst, level: Math.max(1, worst.level - 1) };
      uptriaged.reason += '（懷孕上調一級）';
      results.push({ category: '懷孕上調', ...uptriaged });
      worst = uptriaged;
    }

    // If no specific findings, default to Level 5 (non-urgent)
    if (!worst) {
      worst = { level: LEVEL.LEVEL_5, reason: '未發現首要調節變數之急迫性變化', category: '預設' };
      results.push(worst);
    }

    return {
      level: worst.level,
      levelName: LEVEL_NAMES[worst.level],
      levelLabel: LEVEL_LABELS[worst.level],
      levelColor: LEVEL_COLORS[worst.level],
      levelEmoji: LEVEL_EMOJI[worst.level],
      primaryReason: worst.reason,
      primaryCategory: worst.category,
      allFindings: results,
      recommendations: getRecommendation(worst.level),
      safetyNet: getSafetyNet(patientData, worst.level),
    };
  }

  // ──────────────────────────────────────────────
  // RECOMMENDATIONS
  // ──────────────────────────────────────────────
  function getRecommendation(level) {
    const recs = {
      1: {
        title: '🚨 紅色警示 — 立即叫 119 救護車或直奔最近急診',
        color: 'red',
        text: '您目前的狀況屬於第一級（復甦急救），需要立即的醫療處置。請立即撥打 119 或由家屬陪同直奔最近醫院急診處。',
        action: 'call_119',
        diversion: false,
      },
      2: {
        title: '🔴 紅色警示 — 立即就醫',
        color: 'red',
        text: '您目前的狀況屬於第二級（危急），需要緊急醫療評估。請立即至最近急診就醫，或撥打 119 尋求協助。',
        action: 'call_119',
        diversion: false,
      },
      3: {
        title: '🟡 黃色警示 — 急診評估 / 次高優先順位',
        color: 'amber',
        text: '您目前的狀況屬於第三級（緊急），非立即致命，但需專業醫療評估。急診候診時間可能超過 1~3 小時。若附近診所有對應處置能力（如局部外傷縫合），可評估轉介前往。',
        action: 'er_or_clinic',
        diversion: false,
      },
      4: {
        title: '🟢 綠色導流 — 建議前往基層診所 / 門診',
        color: 'green',
        text: '依分級標準為次緊急，不建議前往醫學中心急診。急診將排至最後順位（候診時間可能達 3-5 小時以上）並需自付最高額掛號與部分負擔費用。建議至鄰近基層診所或門診就醫。',
        action: 'clinic_diversion',
        diversion: true,
      },
      5: {
        title: '🔵 藍色導流 — 建議門診 / 居家照護',
        color: 'blue',
        text: '依分級標準為非緊急，不需要急診醫療資源。急診將排至最後順位（候診時間可能達 3-5 小時以上）並需自付最高額掛號與部分負擔費用。建議至基層診所看診或居家照護。',
        action: 'clinic_diversion',
        diversion: true,
      },
    };
    return recs[level] || recs[5];
  }

  // ──────────────────────────────────────────────
  // SAFETY NET — Context-aware red-flag warnings
  // ──────────────────────────────────────────────
  function getSafetyNet(data, level) {
    const nets = [];

    // Universal emergency signs
    nets.push({
      title: '⚠️ 病情急轉直下警訊',
      text: '若出現以下任何症狀，請立即無視本評估結果，直接撥打 119 或前往急診：',
      signs: [
        '意識突然改變或喪失',
        '呼吸困難或停止',
        '胸口持續劇痛',
        '大量出血無法止住',
        '突然單側肢體無力或言語困難',
        '嚴重過敏反應（呼吸困難、全身腫脹）',
      ],
    });

    // Chief-complaint-specific safety nets
    const chief = data.chiefComplaint;

    if (chief === 'chest') {
      nets.push({
        title: '🫀 胸痛特別注意',
        text: '若出現以下症狀，請立即前往急診：',
        signs: [
          '胸痛加劇且伴隨冒冷汗、呼吸困難',
          '疼痛轉移至下巴或左臂',
          '感覺心悸且脈搏極不規則',
          '突發性撕裂般劇痛',
        ],
      });
    }

    if (chief === 'abdomen') {
      nets.push({
        title: '🩺 腹痛特別注意',
        text: '若出現以下症狀，請立即前往急診：',
        signs: [
          '腹部突然變如木板般僵硬',
          '痛到無法挺身或彎腰',
          '嘔吐物帶血或呈咖啡色',
          '解黑便或血便',
          '劇烈腹痛伴隨高燒與發抖',
        ],
      });
    }

    if (chief === 'trauma') {
      nets.push({
        title: '🦴 外傷特別注意',
        text: '若出現以下症狀，請立即前往急診：',
        signs: [
          '頭部撞擊後出現嘔吐或意識改變',
          '頸部或背部疼痛加劇',
          '四肢變形、無法活動或感覺異常',
          '傷口持續大量出血',
        ],
      });
    }

    if (chief === 'neuro') {
      nets.push({
        title: '🧠 神經系統特別注意',
        text: '若出現以下症狀，請立即前往急診：',
        signs: [
          '突然劇烈頭痛（前所未有的程度）',
          '單側肢體突然無力或麻木',
          '說話困難或聽不懂別人說話',
          '視線模糊或複視',
          '突然行走困難或失去平衡',
        ],
      });
    }

    if (chief === 'fever') {
      nets.push({
        title: '🌡️ 發燒特別注意',
        text: '若出現以下症狀，請立即前往急診：',
        signs: [
          '持續高燒不退（> 39.5°C）',
          '出現皮疹合併高燒',
          '頸部僵硬',
          '意識模糊或躁動不安',
          '呼吸急促或困難',
        ],
      });
    }

    if (chief === 'mental') {
      nets.push({
        title: '🧠 精神急症特別注意',
        text: '若出現以下症狀，請立即撥打 119 或 110：',
        signs: [
          '有明確自殺計畫或已採取行動',
          '威脅要傷害自己或他人',
          '完全無法控制的攻擊行為',
          '出現幻覺並對幻覺做出危險反應',
        ],
      });
    }

    if (chief === 'minor') {
      nets.push({
        title: '💊 輕症特別注意',
        text: '若出現以下症狀，請重新評估或前往急診：',
        signs: [
          '症狀突然加劇或出現新症狀',
          '發燒 > 38.5°C',
          '出現新的全身性症狀',
        ],
      });
    }

    return nets;
  }

  // ── Public API ──
  return {
    LEVEL,
    LEVEL_NAMES,
    LEVEL_LABELS,
    LEVEL_COLORS,
    LEVEL_EMOJI,
    evaluate,
    worstLevel,
    // Expose individual evaluators for testing
    evaluateRespiratory,
    evaluateHemodynamic,
    evaluateConsciousness,
    evaluateTemperature,
    evaluatePain,
    evaluateMechanism,
    evaluateHypertension,
    evaluateBleeding,
    evaluateMentalHealth,
    getRecommendation,
    getSafetyNet,
  };
})();

// Node.js export for testing (in browsers this is a no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TTAS;
}
