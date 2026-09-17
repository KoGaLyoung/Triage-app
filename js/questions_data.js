/**
 * Questions Data — Symptom-driven question bank
 * Maps chief complaints to dynamic question flows
 * Each question collects data needed by the TTAS engine
 */

const QuestionsData = (() => {
  'use strict';

  // ── Chief Complaint definitions ──
  const CHIEF_COMPLAINTS = [
    {
      id: 'trauma',
      icon: '🩹',
      title: '外傷 / 跌倒 / 撞擊事故',
      description: '車禍、跌倒、撞擊、穿刺傷等',
      color: 'var(--rose)',
    },
    {
      id: 'chest',
      icon: '🫀',
      title: '胸悶 / 胸痛 / 呼吸喘促 / 心悸',
      description: '胸部不適、呼吸困難、心跳異常',
      color: 'var(--red)',
    },
    {
      id: 'abdomen',
      icon: '🩺',
      title: '腹痛 / 嘔吐 / 腸胃異常',
      description: '肚子痛、噁心嘔吐、腹瀉等',
      color: 'var(--amber)',
    },
    {
      id: 'neuro',
      icon: '🧠',
      title: '頭痛 / 意識變化 / 突發性肢體無力',
      description: '頭暈頭痛、意識改變、中風徵兆',
      color: 'var(--violet)',
    },
    {
      id: 'fever',
      icon: '🌡️',
      title: '發燒 / 畏寒 / 感染徵候',
      description: '發冷發熱、身體痠痛、感染',
      color: 'var(--indigo)',
    },
    {
      id: 'mental',
      icon: '💭',
      title: '情緒激動 / 自傷意向 / 精神急症',
      description: '情緒失控、自傷念頭、幻覺妄想',
      color: 'var(--sky)',
    },
    {
      id: 'minor',
      icon: '💊',
      title: '其他局部輕微不適',
      description: '皮膚、換藥、感冒輕症、慢性病',
      color: 'var(--emerald)',
    },
  ];

  // ── Question definitions per chief complaint ──
  // Each question has: id, type, prompt, options, next logic, and which TTAS fields it populates
  const QUESTION_FLOWS = {

    // ━━━ TRAUMA ━━━
    trauma: [
      // Q1: Mechanism of injury
      {
        id: 'trauma_mechanism',
        type: 'single',
        prompt: '受傷的機轉為何？',
        hint: '選擇最接近的受傷情形',
        options: [
          { label: '一般跌倒', value: 'simple_fall' },
          { label: '車禍', value: 'car_accident' },
          { label: '機車事故', value: 'motorcycle' },
          { label: '行人被撞', value: 'pedestrian_hit' },
          { label: '高處墜落', value: 'fall_height' },
          { label: '穿刺傷/割傷', value: 'penetrating' },
          { label: '鈍器攻擊', value: 'blunt_attack' },
          { label: '槍傷', value: 'gunshot' },
        ],
        mapsTo: 'trauma_mechanism',
      },
      // Q2: High-risk mechanism details (conditional)
      {
        id: 'trauma_high_risk',
        type: 'multi',
        prompt: '是否有以下高危險性受傷機轉？',
        hint: '可複選',
        condition: (answers) => {
          const mg = answers.trauma_mechanism;
          return ['car_accident', 'motorcycle', 'pedestrian_hit', 'fall_height', 'penetrating', 'blunt_attack', 'gunshot'].includes(mg);
        },
        options: [
          { label: '從車內被彈出', value: 'car_ejected' },
          { label: '車體翻轉', value: 'car_rollover' },
          { label: '受困 > 20 分鐘', value: 'car_trapped_20min' },
          { label: '乘客座位明顯凹陷', value: 'car_seat_destroyed' },
          { label: '同車有人死亡', value: 'car_passenger_died' },
          { label: '撞擊速度 > 40km/h（未繫安全帶）', value: 'car_nobelt_40kph' },
          { label: '撞擊速度 > 60km/h（已繫安全帶）', value: 'car_belt_60kph' },
          { label: '被 > 30km/h 汽車撞擊', value: 'motorcycle_hit_30kph' },
          { label: '撞擊後人車分離', value: 'motorcycle_separated' },
          { label: '行人被 > 30km/h 撞擊', value: 'pedestrian_hit_30kph' },
          { label: '高處墜落 > 6m（成人）', value: 'fall_6m' },
          { label: '頭、頸、軀幹穿刺傷', value: 'penetrating_head_neck_torso' },
          { label: '近端肢體穿刺傷', value: 'penetrating_upper_limb' },
          { label: '頸部被垂直撞擊', value: 'neck_vertical_impact' },
        ],
        mapsTo: 'mechanism',
      },
      // Q2b: Fall height (if applicable)
      // For pediatric, we need the child's height to apply the "> 2x height" rule
      {
        id: 'trauma_child_height',
        type: 'stepper',
        prompt: '兒童身高？（單位：公尺）',
        hint: '約 2 歲 0.9m、5 歲 1.1m、10 歲 1.4m。用於判斷墜落高度是否超過身高 2 倍',
        condition: (answers) => answers.isPediatric === true && answers.trauma_mechanism === 'fall_height',
        min: 0.4,
        max: 2.0,
        step: 0.05,
        unit: 'm',
        default: 1.2,
        mapsTo: 'childHeight',
      },
      {
        id: 'trauma_fall_height',
        type: 'stepper',
        prompt: '從多高處墜落？（單位：公尺）',
        hint: '成人 > 6m 為高危險；兒童超過身高 2 倍為高危險',
        condition: (answers) => answers.trauma_mechanism === 'fall_height',
        min: 0.5,
        max: 30,
        step: 0.5,
        unit: 'm',
        default: 2,
        mapsTo: 'fallHeight',
      },
      // Q3: Pain
      {
        id: 'trauma_pain',
        type: 'stepper',
        prompt: '目前疼痛程度？',
        hint: '0 = 無痛，10 = 極度疼痛',
        min: 0,
        max: 10,
        step: 1,
        default: 3,
        mapsTo: 'painScore',
      },
      // Q3b: Pain type (central vs peripheral)
      {
        id: 'trauma_pain_type',
        type: 'single',
        prompt: '疼痛部位屬於哪種類型？',
        condition: (answers) => answers.painScore >= 1,
        options: [
          { label: '中樞型（頭、胸、腹、骨盆）', value: 'central' },
          { label: '周邊型（皮膚、四肢手腳）', value: 'peripheral' },
        ],
        mapsTo: 'painType',
      },
      // Q4: Vital signs
      {
        id: 'trauma_spo2',
        type: 'stepper',
        prompt: '血氧飽和度 SpO2？',
        hint: '正常值 95-100%',
        min: 70,
        max: 100,
        step: 1,
        unit: '%',
        default: 98,
        mapsTo: 'spo2',
      },
      {
        id: 'trauma_rr',
        type: 'stepper',
        prompt: '呼吸次數？',
        hint: '正常成人 12-20 次/分',
        min: 5,
        max: 60,
        step: 1,
        unit: '次/分',
        default: 16,
        mapsTo: 'rr',
      },
      {
        id: 'trauma_hr',
        type: 'stepper',
        prompt: '心跳速率？',
        hint: '正常成人 60-100 次/分',
        min: 30,
        max: 220,
        step: 1,
        unit: 'bpm',
        default: 80,
        mapsTo: 'hr',
      },
      {
        id: 'trauma_sbp',
        type: 'stepper',
        prompt: '收縮壓 (SBP)？',
        hint: '正常 90-140 mmHg',
        min: 40,
        max: 300,
        step: 1,
        unit: 'mmHg',
        default: 120,
        mapsTo: 'sbp',
      },
      {
        id: 'trauma_dbp',
        type: 'stepper',
        prompt: '舒張壓 (DBP)？',
        hint: '正常 60-90 mmHg',
        min: 20,
        max: 200,
        step: 1,
        unit: 'mmHg',
        default: 80,
        mapsTo: 'dbp',
      },
      {
        id: 'trauma_temp',
        type: 'wheel',
        prompt: '體溫？',
        hint: '正常 36.0-37.5°C',
        min: 32,
        max: 42,
        step: 0.1,
        unit: '°C',
        default: 36.5,
        mapsTo: 'temp',
      },
      // Q5: Consciousness
      {
        id: 'trauma_gcs',
        type: 'single',
        prompt: '意識狀態？',
        options: [
          { label: '完全清醒，能正常對答', value: 'alert' },
          { label: '嗜睡，但可被叫醒', value: 'drowsy' },
          { label: '意識模糊，定向感差', value: 'confused' },
          { label: '對聲音有反應但無法言語', value: 'verbal' },
          { label: '僅對疼痛有反應', value: 'pain' },
          { label: '完全無反應', value: 'none' },
        ],
        mapsTo: 'consciousnessRaw',
      },
      // Q6: Spontaneous breathing
      {
        id: 'trauma_resp_distress',
        type: 'single',
        prompt: '呼吸窘迫程度？',
        condition: (answers) => answers.spo2 < 95 || answers.rr > 20,
        options: [
          { label: '重度呼吸窘迫（衰竭、發紺）', value: 'severe' },
          { label: '中度呼吸窘迫（費力、用輔助肌）', value: 'moderate' },
          { label: '輕度呼吸窘迫', value: 'mild' },
          { label: '無明顯窘迫', value: 'none' },
        ],
        mapsTo: 'respiratoryDistress',
      },
    ],

    // ━━━ CHEST ━━━
    chest: [
      {
        id: 'chest_symptom',
        type: 'single',
        prompt: '主要胸部症狀？',
        options: [
          { label: '胸痛', value: 'chest_pain' },
          { label: '胸悶', value: 'chest_tightness' },
          { label: '呼吸喘促', value: 'dyspnea' },
          { label: '心悸', value: 'palpitation' },
          { label: '合併多項', value: 'combined' },
        ],
        mapsTo: 'chestSubtype',
      },
      // Chest pain specifics
      {
        id: 'chest_pain_type',
        type: 'single',
        prompt: '胸痛性質？',
        condition: (answers) => ['chest_pain', 'combined'].includes(answers.chestSubtype),
        options: [
          { label: '壓迫性/緊縮性', value: 'pressure' },
          { label: '刺痛/銳痛', value: 'sharp' },
          { label: '撕裂般劇痛', value: 'tearing' },
          { label: '燒灼感', value: 'burning' },
        ],
        mapsTo: 'chestPainType',
      },
      {
        id: 'chest_pain_radiation',
        type: 'multi',
        prompt: '疼痛是否有轉移？',
        condition: (answers) => answers.chestPainType === 'pressure' || answers.chestPainType === 'tearing',
        options: [
          { label: '轉移至左臂', value: 'left_arm' },
          { label: '轉移至下巴', value: 'jaw' },
          { label: '轉移至背部', value: 'back' },
          { label: '冒冷汗', value: 'cold_sweat' },
          { label: '噁心/嘔吐', value: 'nausea' },
          { label: '無轉移', value: 'none' },
        ],
        mapsTo: 'chestRadiation',
      },
      {
        id: 'chest_pain',
        type: 'stepper',
        prompt: '目前疼痛程度？',
        hint: '0 = 無痛，10 = 極度疼痛',
        min: 0,
        max: 10,
        step: 1,
        default: 5,
        mapsTo: 'painScore',
      },
      {
        id: 'chest_pain_type_choice',
        type: 'single',
        prompt: '胸部疼痛屬於？',
        condition: (answers) => answers.painScore >= 1,
        options: [
          { label: '中樞型（胸腔內）', value: 'central' },
          { label: '周邊型（胸壁、肌肉）', value: 'peripheral' },
        ],
        mapsTo: 'painType',
      },
      {
        id: 'chest_spo2',
        type: 'stepper',
        prompt: '血氧飽和度 SpO2？',
        min: 70,
        max: 100,
        step: 1,
        unit: '%',
        default: 97,
        mapsTo: 'spo2',
      },
      {
        id: 'chest_rr',
        type: 'stepper',
        prompt: '呼吸次數？',
        min: 5,
        max: 60,
        step: 1,
        unit: '次/分',
        default: 16,
        mapsTo: 'rr',
      },
      {
        id: 'chest_resp_distress',
        type: 'single',
        prompt: '呼吸窘迫程度？',
        condition: (answers) => answers.spo2 < 95 || answers.rr > 20,
        options: [
          { label: '重度呼吸窘迫（衰竭、發紺）', value: 'severe' },
          { label: '中度呼吸窘迫（費力、用輔助肌）', value: 'moderate' },
          { label: '輕度呼吸窘迫', value: 'mild' },
          { label: '無明顯窘迫', value: 'none' },
        ],
        mapsTo: 'respiratoryDistress',
      },
      {
        id: 'chest_hr',
        type: 'stepper',
        prompt: '心跳速率？',
        min: 30,
        max: 220,
        step: 1,
        unit: 'bpm',
        default: 80,
        mapsTo: 'hr',
      },
      {
        id: 'chest_sbp',
        type: 'stepper',
        prompt: '收縮壓 (SBP)？',
        min: 40,
        max: 300,
        step: 1,
        unit: 'mmHg',
        default: 120,
        mapsTo: 'sbp',
      },
      {
        id: 'chest_dbp',
        type: 'stepper',
        prompt: '舒張壓 (DBP)？',
        min: 20,
        max: 200,
        step: 1,
        unit: 'mmHg',
        default: 80,
        mapsTo: 'dbp',
      },
      {
        id: 'chest_temp',
        type: 'wheel',
        prompt: '體溫？',
        min: 32,
        max: 42,
        step: 0.1,
        unit: '°C',
        default: 36.5,
        mapsTo: 'temp',
      },
      {
        id: 'chest_gcs',
        type: 'single',
        prompt: '意識狀態？',
        options: [
          { label: '完全清醒', value: 'alert' },
          { label: '嗜睡但可叫醒', value: 'drowsy' },
          { label: '意識模糊', value: 'confused' },
          { label: '對疼痛有反應', value: 'pain' },
          { label: '完全無反應', value: 'none' },
        ],
        mapsTo: 'consciousnessRaw',
      },
    ],

    // ━━━ ABDOMEN ━━━
    abdomen: [
      {
        id: 'abd_location',
        type: 'single',
        prompt: '腹痛位置？',
        options: [
          { label: '上腹（心窩）', value: 'epigastric' },
          { label: '右上腹', value: 'ruq' },
          { label: '左上腹', value: 'luq' },
          { label: '肚臍周圍', value: 'periumbilical' },
          { label: '右下腹', value: 'rlq' },
          { label: '左下腹', value: 'llq' },
          { label: '下腹（耻骨上方）', value: 'suprapubic' },
          { label: '全腹', value: 'diffuse' },
        ],
        mapsTo: 'abdLocation',
      },
      {
        id: 'abd_symptoms',
        type: 'multi',
        prompt: '伴隨哪些症狀？',
        options: [
          { label: '嘔吐', value: 'vomiting' },
          { label: '腹瀉', value: 'diarrhea' },
          { label: '血便/黑便', value: 'bloody_stool' },
          { label: '嘔血/咖啡色嘔吐物', value: 'hematemesis' },
          { label: '發燒', value: 'fever' },
          { label: '無法排氣', value: 'no_flatus' },
          { label: '腹脹', value: 'distension' },
        ],
        mapsTo: 'abdSymptoms',
      },
      {
        id: 'abd_pain',
        type: 'stepper',
        prompt: '目前疼痛程度？',
        hint: '0 = 無痛，10 = 極度疼痛',
        min: 0,
        max: 10,
        step: 1,
        default: 4,
        mapsTo: 'painScore',
      },
      {
        id: 'abd_pain_type',
        type: 'single',
        prompt: '腹痛屬於？',
        condition: (answers) => answers.painScore >= 1,
        options: [
          { label: '中樞型（腹腔內深層）', value: 'central' },
          { label: '周邊型（腹壁表層）', value: 'peripheral' },
        ],
        mapsTo: 'painType',
      },
      {
        id: 'abd_temp',
        type: 'wheel',
        prompt: '體溫？',
        min: 32,
        max: 42,
        step: 0.1,
        unit: '°C',
        default: 36.5,
        mapsTo: 'temp',
      },
      {
        id: 'abd_spo2',
        type: 'stepper',
        prompt: '血氧飽和度 SpO2？',
        min: 70,
        max: 100,
        step: 1,
        unit: '%',
        default: 98,
        mapsTo: 'spo2',
      },
      {
        id: 'abd_hr',
        type: 'stepper',
        prompt: '心跳速率？',
        min: 30,
        max: 220,
        step: 1,
        unit: 'bpm',
        default: 80,
        mapsTo: 'hr',
      },
      {
        id: 'abd_sbp',
        type: 'stepper',
        prompt: '收縮壓 (SBP)？',
        min: 40,
        max: 300,
        step: 1,
        unit: 'mmHg',
        default: 120,
        mapsTo: 'sbp',
      },
      {
        id: 'abd_dbp',
        type: 'stepper',
        prompt: '舒張壓 (DBP)？',
        min: 20,
        max: 200,
        step: 1,
        unit: 'mmHg',
        default: 80,
        mapsTo: 'dbp',
      },
      {
        id: 'abd_gcs',
        type: 'single',
        prompt: '意識狀態？',
        options: [
          { label: '完全清醒', value: 'alert' },
          { label: '嗜睡但可叫醒', value: 'drowsy' },
          { label: '意識模糊', value: 'confused' },
          { label: '對疼痛有反應', value: 'pain' },
          { label: '完全無反應', value: 'none' },
        ],
        mapsTo: 'consciousnessRaw',
      },
    ],

    // ━━━ NEURO ━━━
    neuro: [
      {
        id: 'neuro_symptom',
        type: 'single',
        prompt: '主要神經系統症狀？',
        options: [
          { label: '頭痛', value: 'headache' },
          { label: '頭暈/眩暈', value: 'dizziness' },
          { label: '意識改變', value: 'consciousness_change' },
          { label: '突發性肢體無力', value: 'weakness' },
          { label: '抽搐/癲癇', value: 'seizure' },
          { label: '說話困難', value: 'speech_difficulty' },
          { label: '視覺異常', value: 'visual' },
        ],
        mapsTo: 'neuroSubtype',
      },
      {
        id: 'neuro_headache_severity',
        type: 'single',
        prompt: '頭痛性質？',
        condition: (answers) => answers.neuroSubtype === 'headache',
        options: [
          { label: '劇烈頭痛（前所未有的程度）', value: 'thunderclap' },
          { label: '嚴重頭痛', value: 'severe' },
          { label: '中度頭痛', value: 'moderate' },
          { label: '輕微頭痛', value: 'mild' },
        ],
        mapsTo: 'headacheSeverity',
      },
      {
        id: 'neuro_weakness_pattern',
        type: 'single',
        prompt: '無力部位？',
        condition: (answers) => answers.neuroSubtype === 'weakness',
        options: [
          { label: '單側（左或右）', value: 'unilateral' },
          { label: '雙側', value: 'bilateral' },
          { label: '局部', value: 'focal' },
        ],
        mapsTo: 'weaknessPattern',
      },
      {
        id: 'neuro_pain',
        type: 'stepper',
        prompt: '疼痛程度？',
        min: 0,
        max: 10,
        step: 1,
        default: 3,
        mapsTo: 'painScore',
      },
      {
        id: 'neuro_pain_type',
        type: 'single',
        prompt: '疼痛部位屬於？',
        condition: (answers) => answers.painScore >= 1,
        options: [
          { label: '中樞型（頭部）', value: 'central' },
          { label: '周邊型（頭皮、顏面）', value: 'peripheral' },
        ],
        mapsTo: 'painType',
      },
      {
        id: 'neuro_spo2',
        type: 'stepper',
        prompt: '血氧飽和度 SpO2？',
        min: 70,
        max: 100,
        step: 1,
        unit: '%',
        default: 98,
        mapsTo: 'spo2',
      },
      {
        id: 'neuro_hr',
        type: 'stepper',
        prompt: '心跳速率？',
        min: 30,
        max: 220,
        step: 1,
        unit: 'bpm',
        default: 80,
        mapsTo: 'hr',
      },
      {
        id: 'neuro_sbp',
        type: 'stepper',
        prompt: '收縮壓 (SBP)？',
        min: 40,
        max: 300,
        step: 1,
        unit: 'mmHg',
        default: 120,
        mapsTo: 'sbp',
      },
      {
        id: 'neuro_dbp',
        type: 'stepper',
        prompt: '舒張壓 (DBP)？',
        min: 20,
        max: 200,
        step: 1,
        unit: 'mmHg',
        default: 80,
        mapsTo: 'dbp',
      },
      {
        id: 'neuro_temp',
        type: 'wheel',
        prompt: '體溫？',
        min: 32,
        max: 42,
        step: 0.1,
        unit: '°C',
        default: 36.5,
        mapsTo: 'temp',
      },
      {
        id: 'neuro_gcs',
        type: 'single',
        prompt: '意識狀態？',
        options: [
          { label: '完全清醒', value: 'alert' },
          { label: '嗜睡但可叫醒', value: 'drowsy' },
          { label: '意識模糊', value: 'confused' },
          { label: '對疼痛有反應', value: 'pain' },
          { label: '完全無反應', value: 'none' },
        ],
        mapsTo: 'consciousnessRaw',
      },
    ],

    // ━━━ FEVER ━━━
    fever: [
      {
        id: 'fever_temp',
        type: 'wheel',
        prompt: '目前體溫？（耳溫/肛溫）',
        hint: '發燒定義：中樞體溫 > 38°C',
        min: 32,
        max: 42,
        step: 0.1,
        unit: '°C',
        default: 38.0,
        mapsTo: 'temp',
      },
      {
        id: 'fever_duration',
        type: 'single',
        prompt: '發燒持續時間？',
        options: [
          { label: '< 1 天', value: 'under_1d' },
          { label: '1-3 天', value: '1_3d' },
          { label: '3-7 天', value: '3_7d' },
          { label: '> 7 天', value: 'over_7d' },
        ],
        mapsTo: 'feverDuration',
      },
      {
        id: 'fever_symptoms',
        type: 'multi',
        prompt: '伴隨哪些症狀？',
        options: [
          { label: '畏寒/發抖', value: 'chills' },
          { label: '全身痠痛', value: 'body_ache' },
          { label: '咳嗽', value: 'cough' },
          { label: '喉嚨痛', value: 'sore_throat' },
          { label: '皮疹', value: 'rash' },
          { label: '嘔吐/腹瀉', value: 'gi_symptoms' },
          { label: '排尿疼痛', value: 'dysuria' },
          { label: '頸部僵硬', value: 'neck_stiffness' },
        ],
        mapsTo: 'feverSymptoms',
      },
      {
        id: 'fever_immunocompromised',
        type: 'single',
        prompt: '是否有免疫功能缺陷狀態？',
        hint: '如：HIV、白血病、長期使用類固醇、器官移植、正在接受化療',
        options: [
          { label: '是', value: true },
          { label: '否', value: false },
        ],
        mapsTo: 'immunocompromised',
      },
      {
        id: 'fever_appearance',
        type: 'single',
        prompt: '看起來是否有病容？',
        hint: '病容：臉部潮紅、疲倦、焦躁不安',
        options: [
          { label: '看起來有病容', value: true },
          { label: '看起來無病容', value: false },
        ],
        mapsTo: 'looksIll',
      },
      {
        id: 'fever_spo2',
        type: 'stepper',
        prompt: '血氧飽和度 SpO2？',
        min: 70,
        max: 100,
        step: 1,
        unit: '%',
        default: 97,
        mapsTo: 'spo2',
      },
      {
        id: 'fever_rr',
        type: 'stepper',
        prompt: '呼吸次數？',
        min: 5,
        max: 60,
        step: 1,
        unit: '次/分',
        default: 16,
        mapsTo: 'rr',
      },
      {
        id: 'fever_hr',
        type: 'stepper',
        prompt: '心跳速率？',
        min: 30,
        max: 220,
        step: 1,
        unit: 'bpm',
        default: 80,
        mapsTo: 'hr',
      },
      {
        id: 'fever_sbp',
        type: 'stepper',
        prompt: '收縮壓 (SBP)？',
        min: 40,
        max: 300,
        step: 1,
        unit: 'mmHg',
        default: 120,
        mapsTo: 'sbp',
      },
      {
        id: 'fever_dbp',
        type: 'stepper',
        prompt: '舒張壓 (DBP)？',
        min: 20,
        max: 200,
        step: 1,
        unit: 'mmHg',
        default: 80,
        mapsTo: 'dbp',
      },
      {
        id: 'fever_gcs',
        type: 'single',
        prompt: '意識狀態？',
        options: [
          { label: '完全清醒', value: 'alert' },
          { label: '嗜睡但可叫醒', value: 'drowsy' },
          { label: '意識模糊', value: 'confused' },
          { label: '對疼痛有反應', value: 'pain' },
          { label: '完全無反應', value: 'none' },
        ],
        mapsTo: 'consciousnessRaw',
      },
    ],

    // ━━━ MENTAL HEALTH ━━━
    mental: [
      {
        id: 'mental_category',
        type: 'single',
        prompt: '主要精神相關問題？',
        options: [
          { label: '自傷/自殺念頭或行為', value: 'suicidal_ideation' },
          { label: '企圖自殺', value: 'suicide_attempt' },
          { label: '情緒激動/焦慮', value: 'anxiety_agitation' },
          { label: '幻覺/妄想', value: 'hallucination' },
          { label: '怪異/危險行為', value: 'bizarre_behavior' },
          { label: '不穩定/暴力行為', value: 'unstable_behavior' },
        ],
        mapsTo: 'mentalCategoryRaw',
      },
      {
        id: 'mental_severity',
        type: 'single',
        prompt: '嚴重程度？',
        condition: (answers) => answers.mentalCategoryRaw === 'suicidal_ideation',
        options: [
          { label: '有自殺計畫', value: 'with_plan' },
          { label: '有自殺想法但無計畫', value: 'without_plan' },
        ],
        mapsTo: 'mentalHealthSeverity',
      },
      {
        id: 'mental_anxiety_level',
        type: 'single',
        prompt: '焦慮/激動程度？',
        condition: (answers) => answers.mentalCategoryRaw === 'anxiety_agitation',
        options: [
          { label: '重度（極度不安、危險情緒）', value: 'severe_anxiety' },
          { label: '中度（明顯不安、無法遵守指令）', value: 'moderate_anxiety' },
          { label: '輕度（可安撫）', value: 'mild_anxiety' },
        ],
        mapsTo: 'mentalHealthCategory',
      },
      {
        id: 'mental_behavior_control',
        type: 'single',
        prompt: '行為控制能力？',
        condition: (answers) =>
          answers.mentalCategoryRaw === 'bizarre_behavior' || answers.mentalCategoryRaw === 'unstable_behavior',
        options: [
          { label: '無法控制（危險）', value: 'uncontrollable_behavior' },
          { label: '可以控制（有家人陪伴）', value: 'controllable_behavior' },
        ],
        mapsTo: 'mentalHealthCategory',
      },
      {
        id: 'mental_pain',
        type: 'stepper',
        prompt: '疼痛程度（如有）？',
        min: 0,
        max: 10,
        step: 1,
        default: 0,
        mapsTo: 'painScore',
      },
      {
        id: 'mental_spo2',
        type: 'stepper',
        prompt: '血氧飽和度 SpO2？',
        min: 70,
        max: 100,
        step: 1,
        unit: '%',
        default: 98,
        mapsTo: 'spo2',
      },
      {
        id: 'mental_hr',
        type: 'stepper',
        prompt: '心跳速率？',
        min: 30,
        max: 220,
        step: 1,
        unit: 'bpm',
        default: 80,
        mapsTo: 'hr',
      },
      {
        id: 'mental_sbp',
        type: 'stepper',
        prompt: '收縮壓 (SBP)？',
        min: 40,
        max: 300,
        step: 1,
        unit: 'mmHg',
        default: 120,
        mapsTo: 'sbp',
      },
      {
        id: 'mental_dbp',
        type: 'stepper',
        prompt: '舒張壓 (DBP)？',
        min: 20,
        max: 200,
        step: 1,
        unit: 'mmHg',
        default: 80,
        mapsTo: 'dbp',
      },
      {
        id: 'mental_gcs',
        type: 'single',
        prompt: '意識狀態？',
        options: [
          { label: '完全清醒', value: 'alert' },
          { label: '嗜睡但可叫醒', value: 'drowsy' },
          { label: '意識模糊', value: 'confused' },
          { label: '對疼痛有反應', value: 'pain' },
          { label: '完全無反應', value: 'none' },
        ],
        mapsTo: 'consciousnessRaw',
      },
    ],

    // ━━━ MINOR ━━━
    minor: [
      {
        id: 'minor_symptom',
        type: 'single',
        prompt: '主要不適症狀？',
        options: [
          { label: '皮膚問題（紅疹、傷口）', value: 'skin' },
          { label: '感冒/上呼吸道感染', value: 'cold' },
          { label: '慢性病回診/換藥', value: 'chronic' },
          { label: '輕微外傷', value: 'minor_trauma' },
          { label: '其他', value: 'other' },
        ],
        mapsTo: 'minorType',
      },
      {
        id: 'minor_pain',
        type: 'stepper',
        prompt: '不適程度？',
        hint: '0 = 無不適，10 = 極度不適',
        min: 0,
        max: 10,
        step: 1,
        default: 2,
        mapsTo: 'painScore',
      },
      {
        id: 'minor_temp',
        type: 'wheel',
        prompt: '體溫？',
        min: 32,
        max: 42,
        step: 0.1,
        unit: '°C',
        default: 36.5,
        mapsTo: 'temp',
      },
    ],
  };

  // ── Mental health category mapping ──
  function mapMentalCategory(raw) {
    const map = {
      'suicide_attempt': 'suicide_attempt',
      'suicidal_ideation': 'suicidal_ideation',
      'anxiety_agitation': null, // Will be set from mental_severity question
      'hallucination': 'acute_psychosis',
      'bizarre_behavior': null, // Will be set from mental_behavior_control
      'unstable_behavior': 'unstable_behavior',
    };
    return map[raw] || raw;
  }

  // ── Consciousness mapping ──
  function mapConsciousness(raw) {
    const map = {
      'alert': { gcs: 15, consciousnessChange: null },
      'drowsy': { gcs: 14, consciousnessChange: null },
      'confused': { gcs: 12, consciousnessChange: 'altered', orientation: false },
      'verbal': { gcs: 10, consciousnessChange: 'altered' },
      'pain': { gcs: 7, consciousnessChange: null, responseToStimulus: 'localize_pain' },
      'none': { gcs: 3, consciousnessChange: null, responseToStimulus: 'none' },
    };
    return map[raw] || { gcs: 15 };
  }

  // ── Build TTAS input from answers ──
  function buildTTASInput(answers, ageGroup, pregnancy) {
    const input = {
      ageGroup: ageGroup, // 'adult' or 'pediatric'
      pregnancy: pregnancy || false,
      chiefComplaint: answers._chiefComplaint,
    };

    // Respiratory
    if (answers.spo2 !== undefined) input.spo2 = answers.spo2;
    if (answers.rr !== undefined) input.rr = answers.rr;
    if (answers.respiratoryDistress) input.respiratoryDistress = answers.respiratoryDistress;
    if (answers.speechLevel) input.speechLevel = answers.speechLevel;

    // Hemodynamic
    if (answers.sbp !== undefined) input.sbp = answers.sbp;
    if (answers.dbp !== undefined) input.dbp = answers.dbp;
    if (answers.hr !== undefined) input.hr = answers.hr;
    if (answers.map !== undefined) input.map = answers.map;
    if (answers.shockSigns !== undefined) input.shockSigns = answers.shockSigns;

    // Consciousness
    if (answers.consciousnessRaw) {
      const mapped = mapConsciousness(answers.consciousnessRaw);
      Object.assign(input, mapped);
    }

    // Temperature
    if (answers.temp !== undefined) input.temp = answers.temp;
    if (answers.immunocompromised !== undefined) input.immunocompromised = answers.immunocompromised;
    if (answers.looksIll !== undefined) input.looksIll = answers.looksIll;

    // Pain
    if (answers.painScore !== undefined) input.painScore = answers.painScore;
    if (answers.painType) input.painType = answers.painType;

    // Mechanism
    if (answers.mechanism) input.mechanism = answers.mechanism;
    if (answers.fallHeight !== undefined) input.fallHeight = answers.fallHeight;
    if (answers.childHeight !== undefined) input.childHeight = answers.childHeight;

    // Reconcile fall-height mechanism by age group:
    // - Adult: > 6m is high-risk (表三)
    // - Pediatric: > 2x child height is high-risk (表八)
    if (answers.trauma_mechanism === 'fall_height' && answers.fallHeight !== undefined) {
      if (answers.isPediatric) {
        const h = answers.childHeight || 1.2;
        if (answers.fallHeight > h * 2) {
          input.mechanism = 'fall_height';
        } else {
          input.mechanism = null; // not high-risk
        }
      } else if (answers.fallHeight > 6) {
        input.mechanism = 'fall_6m';
      } else {
        input.mechanism = null; // not high-risk
      }
    }

    // Bleeding
    if (answers.bleedingType) input.bleedingType = answers.bleedingType;

    // Mental health
    if (answers.mentalHealthCategory) {
      input.mentalHealthCategory = answers.mentalHealthCategory;
    } else if (answers.mentalCategoryRaw) {
      input.mentalHealthCategory = mapMentalCategory(answers.mentalCategoryRaw);
    }
    if (answers.mentalHealthSeverity) input.mentalHealthSeverity = answers.mentalHealthSeverity;

    // Hypertension
    if (answers.hypertensiveSymptoms !== undefined) input.hypertensiveSymptoms = answers.hypertensiveSymptoms;

    // Capillary refill (pediatric)
    if (answers.capillaryRefill !== undefined) input.capillaryRefill = answers.capillaryRefill;
    if (answers.cyanosis) input.cyanosis = answers.cyanosis;

    // Pediatric age
    if (ageGroup === 'pediatric' && answers.infantAge) {
      input.infantAge = answers.infantAge;
    }

    return input;
  }

  return {
    CHIEF_COMPLAINTS,
    QUESTION_FLOWS,
    mapMentalCategory,
    mapConsciousness,
    buildTTASInput,
  };
})();

// Node.js export for testing (in browsers this is a no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuestionsData;
}
