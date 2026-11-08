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

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
