// Exercise library. The AI may only pick exercises from this list.
// equip: M = machine/cable, D = dumbbells, B = barbell, W = bodyweight
// backSafe: no axial spinal loading. alt: default substitute. video: YouTube id, chosen later.

const ex = (id, ru, en, group, equip, backSafe, alt) => ({ id, name: { ru, en }, group, equip, backSafe, alt, video: null });

export const EXERCISES = [
  // Legs
  ex('leg_press', 'Жим ногами', 'Leg press', 'legs', 'M', true, 'goblet_squat'),
  ex('goblet_squat', 'Гоблет-присед', 'Goblet squat', 'legs', 'D', false, 'leg_press'),
  ex('back_squat', 'Присед со штангой', 'Barbell back squat', 'legs', 'B', false, 'goblet_squat'),
  ex('db_rdl', 'Румынская тяга с гантелями', 'Dumbbell Romanian deadlift', 'legs', 'D', false, 'leg_curl'),
  ex('leg_curl', 'Сгибание ног', 'Leg curl', 'legs', 'M', true, 'glute_bridge'),
  ex('leg_ext', 'Разгибание ног', 'Leg extension', 'legs', 'M', true, 'split_squat'),
  ex('split_squat', 'Сплит-присед', 'Split squat', 'legs', 'D', true, 'leg_press'),
  ex('glute_bridge', 'Ягодичный мост', 'Glute bridge', 'legs', 'W', true, 'leg_curl'),
  ex('calf_raise', 'Подъём на носки', 'Calf raise', 'legs', 'M', true, 'split_squat'),
  // Chest
  ex('machine_chest_press', 'Жим в тренажёре сидя', 'Machine chest press', 'chest', 'M', true, 'db_bench'),
  ex('db_bench', 'Жим гантелей лёжа', 'Dumbbell bench press', 'chest', 'D', true, 'pushup'),
  ex('bb_bench', 'Жим штанги лёжа', 'Barbell bench press', 'chest', 'B', true, 'db_bench'),
  ex('incline_db_press', 'Жим гантелей на наклонной', 'Incline dumbbell press', 'chest', 'D', true, 'machine_chest_press'),
  ex('pushup', 'Отжимания', 'Push-up', 'chest', 'W', true, 'db_bench'),
  // Back
  ex('lat_pulldown', 'Тяга верхнего блока', 'Lat pulldown', 'back', 'M', true, 'assisted_pullup'),
  ex('cable_row', 'Тяга горизонтального блока', 'Seated cable row', 'back', 'M', true, 'db_row'),
  ex('db_row', 'Тяга гантели с упором', 'Supported dumbbell row', 'back', 'D', true, 'cable_row'),
  ex('assisted_pullup', 'Подтягивания в гравитроне', 'Assisted pull-up', 'back', 'M', true, 'lat_pulldown'),
  ex('chest_supported_row', 'Тяга с упором грудью', 'Chest-supported row', 'back', 'M', true, 'db_row'),
  ex('back_ext', 'Гиперэкстензия', 'Back extension', 'back', 'M', false, 'bird_dog'),
  // Shoulders and arms
  ex('db_shoulder_press', 'Жим гантелей сидя с опорой', 'Seated dumbbell press', 'shoulders', 'D', true, 'machine_shoulder_press'),
  ex('machine_shoulder_press', 'Жим в тренажёре на плечи', 'Machine shoulder press', 'shoulders', 'M', true, 'db_shoulder_press'),
  ex('lateral_raise', 'Разведения гантелей в стороны', 'Lateral raise', 'shoulders', 'D', true, 'face_pull'),
  ex('face_pull', 'Тяга каната к лицу', 'Face pull', 'shoulders', 'M', true, 'lateral_raise'),
  ex('db_curl', 'Сгибания на бицепс', 'Dumbbell curl', 'arms', 'D', true, 'triceps_pushdown'),
  ex('triceps_pushdown', 'Разгибания на трицепс на блоке', 'Triceps pushdown', 'arms', 'M', true, 'db_curl'),
  // Core
  ex('plank', 'Планка', 'Plank', 'core', 'W', true, 'dead_bug'),
  ex('side_plank', 'Боковая планка', 'Side plank', 'core', 'W', true, 'plank'),
  ex('bird_dog', 'Птица-собака', 'Bird dog', 'core', 'W', true, 'dead_bug'),
  ex('dead_bug', 'Мёртвый жук', 'Dead bug', 'core', 'W', true, 'bird_dog'),
  ex('pallof_press', 'Паллоф-пресс', 'Pallof press', 'core', 'M', true, 'side_plank'),
  ex('farmer_walk', 'Прогулка фермера', 'Farmer carry', 'core', 'D', true, 'plank'),
  // Cardio and warm-up
  ex('incline_walk', 'Ходьба в наклон', 'Incline walk', 'cardio', 'M', true, 'bike'),
  ex('bike', 'Велотренажёр', 'Stationary bike', 'cardio', 'M', true, 'incline_walk'),
  ex('rower', 'Гребной тренажёр', 'Rowing machine', 'cardio', 'M', false, 'bike'),
  ex('warmup', 'Суставная разминка', 'Joint warm-up', 'cardio', 'W', true, 'bike'),
];

// Technique videos: YouTube Shorts (vertical, phone format) picked per exercise.
// Chosen by title from search results ("how to", "proper form"); view counts were not available to check.
const VIDEOS = {
  leg_press: '5bIHppfq7vk', goblet_squat: '7-80HiXX1K8', back_squat: '04mcPy709P4', db_rdl: 'wqMYwk_-P14',
  leg_curl: 'd6sg829PgNs', leg_ext: 'Tae3aeJe5Ks', split_squat: 'g1l8Q0Ytvco', glute_bridge: 'X_IGw8U_e38',
  calf_raise: 'yQZDGjL-xT4', machine_chest_press: 'VHIlmOPMWWs', db_bench: 'QyuH_vFnQfI', bb_bench: '0cXAp6WhSj4',
  incline_db_press: '8fXfwG4ftaQ', pushup: 'cjSMg-tpMmY', lat_pulldown: 'oMJmAHRZXBk', cable_row: 'QuBdM2J1mAQ',
  db_row: 'H8jf3DwlIlo', assisted_pullup: 'JcGwiiGyYFA', chest_supported_row: 'rB-tcQGloqo', back_ext: 'RURd9mqp6A0',
  db_shoulder_press: 'JmJzqda_0XQ', machine_shoulder_press: 'Gkk-6q7Rq-s', lateral_raise: 'iK22GwXJji0', face_pull: 'AxXHmcTBFyE',
  db_curl: '0OA-DqdTyZA', triceps_pushdown: 'aHfbuBf1TJk', plank: 'hoeNgjheDHk', side_plank: 'sH5PiIUjDW8',
  bird_dog: '_1j_HWknGLg', dead_bug: 'XcYtWYMz39w', pallof_press: '6q2n6pxG7jE', farmer_walk: 'XPYXSwaXzCo',
  incline_walk: 'XBOX7qPKrIs', bike: '6Xp-d7daua0', rower: 'iBuUIBeN08k', warmup: 'Lp_20cikEoU',
};
for (const e of EXERCISES) e.video = VIDEOS[e.id] ?? null;

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
