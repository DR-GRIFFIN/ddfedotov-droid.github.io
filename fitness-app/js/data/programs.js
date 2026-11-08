// Program catalog. Each program has two full-body workouts, A and B, done in turn.
// Set: [exerciseId, sets, repsMin, repsMax, unit] where unit is 'reps' | 'sec' | 'side'.

const s = (id, sets, min, max, unit = 'reps') => ({ id, sets, min, max, unit });

export const PROGRAMS = [
  {
    id: 'start',
    name: { ru: 'Старт', en: 'Start' },
    about: { ru: 'Для первых 3–6 месяцев в зале', en: 'For your first 3–6 months in the gym' },
    perWeek: 3,
    minutes: 50,
    workouts: {
      A: [s('leg_press', 3, 10, 12), s('machine_chest_press', 3, 8, 12), s('lat_pulldown', 3, 8, 12),
        s('leg_curl', 2, 10, 12), s('lateral_raise', 2, 12, 15), s('plank', 3, 20, 40, 'sec')],
      B: [s('goblet_squat', 3, 8, 12), s('cable_row', 3, 8, 12), s('db_shoulder_press', 3, 8, 12),
        s('glute_bridge', 3, 10, 12), s('face_pull', 2, 12, 15), s('bird_dog', 3, 8, 8, 'side')],
    },
  },
  {
    id: 'short',
    name: { ru: 'Мало времени', en: 'Short on time' },
    about: { ru: '2 раза по 45 минут или 3 раза по 30', en: '2 × 45 min or 3 × 30 min a week' },
    perWeek: 2,
    minutes: 45,
    workouts: {
      A: [s('leg_press', 3, 8, 12), s('db_bench', 3, 8, 12), s('lat_pulldown', 3, 8, 12), s('plank', 2, 30, 40, 'sec')],
      B: [s('goblet_squat', 3, 8, 12), s('cable_row', 3, 8, 12), s('db_shoulder_press', 3, 8, 12), s('dead_bug', 2, 8, 8, 'side')],
    },
  },
  {
    id: 'comeback',
    name: { ru: 'Возвращение', en: 'Comeback' },
    about: { ru: 'После перерыва: 2 лёгкие недели, потом «Старт»', en: 'After a break: 2 easy weeks, then Start' },
    perWeek: 3,
    minutes: 35,
    weeks: 2,
    next: 'start',
    workouts: {
      A: [s('leg_press', 2, 10, 12), s('machine_chest_press', 2, 10, 12), s('lat_pulldown', 2, 10, 12), s('bird_dog', 2, 8, 8, 'side')],
      B: [s('goblet_squat', 2, 10, 12), s('cable_row', 2, 10, 12), s('machine_shoulder_press', 2, 10, 12), s('plank', 2, 20, 30, 'sec')],
    },
  },
  {
    id: 'machines',
    name: { ru: 'Только тренажёры', en: 'Machines only' },
    about: { ru: 'Максимум контроля, без свободных весов', en: 'Maximum control, no free weights' },
    perWeek: 3,
    minutes: 50,
    workouts: {
      A: [s('leg_press', 3, 10, 12), s('machine_chest_press', 3, 8, 12), s('lat_pulldown', 3, 8, 12),
        s('leg_curl', 2, 10, 12), s('machine_shoulder_press', 2, 8, 12), s('pallof_press', 2, 10, 10, 'side')],
      B: [s('leg_ext', 3, 10, 12), s('chest_supported_row', 3, 8, 12), s('assisted_pullup', 3, 6, 10),
        s('calf_raise', 2, 12, 15), s('triceps_pushdown', 2, 10, 15), s('face_pull', 2, 12, 15)],
    },
  },
  {
    id: 'back',
    name: { ru: 'Бережная к спине', en: 'Back-friendly' },
    about: { ru: 'Без нагрузки по оси позвоночника, упор на кор', en: 'No spinal loading, focus on the core' },
    perWeek: 3,
    minutes: 50,
    workouts: {
      A: [s('leg_press', 3, 10, 12), s('machine_chest_press', 3, 8, 12), s('lat_pulldown', 3, 8, 12),
        s('glute_bridge', 3, 10, 12), s('side_plank', 2, 15, 30, 'sec'), s('bird_dog', 3, 8, 8, 'side')],
      B: [s('split_squat', 2, 8, 12), s('chest_supported_row', 3, 8, 12), s('machine_shoulder_press', 3, 8, 12),
        s('leg_curl', 2, 10, 12), s('dead_bug', 3, 8, 8, 'side'), s('pallof_press', 2, 10, 10, 'side')],
    },
  },
  {
    id: 'dumbbells',
    name: { ru: 'Только гантели', en: 'Dumbbells only' },
    about: { ru: 'Отель, маленький зал или занятые тренажёры', en: 'Hotel, small gym or busy machines' },
    perWeek: 3,
    minutes: 45,
    workouts: {
      A: [s('goblet_squat', 3, 8, 12), s('db_bench', 3, 8, 12), s('db_row', 3, 8, 12),
        s('db_rdl', 2, 10, 12), s('lateral_raise', 2, 12, 15), s('plank', 3, 20, 40, 'sec')],
      B: [s('split_squat', 3, 8, 12), s('incline_db_press', 3, 8, 12), s('db_shoulder_press', 3, 8, 12),
        s('glute_bridge', 3, 10, 12), s('db_curl', 2, 10, 12), s('dead_bug', 3, 8, 8, 'side')],
    },
  },
];

export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));
