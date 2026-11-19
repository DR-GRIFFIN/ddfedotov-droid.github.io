// Technique cues: 2–3 short points per exercise.
const c = (ru, en) => ({ ru, en });

export const CUES = {
  leg_press: c(
    ['Поясница прижата к спинке всё время', 'Колени смотрят туда же, куда носки', 'Не выпрямляй колени до щелчка'],
    ['Keep your lower back pressed into the pad', 'Knees track over your toes', 'Don’t lock your knees at the top']),
  goblet_squat: c(
    ['Гантель у груди, локти вниз', 'Садись между пяток, спина ровная', 'Колени разводи в стороны'],
    ['Hold the dumbbell at your chest, elbows down', 'Sit down between your heels, back straight', 'Push your knees out']),
  back_squat: c(
    ['Штанга на верхе трапеций, не на шее', 'Вдох и напряги пресс перед спуском', 'Вес на середине стопы'],
    ['Bar on your upper traps, not your neck', 'Breathe in and brace before going down', 'Weight on mid-foot']),
  db_rdl: c(
    ['Таз назад, колени чуть согнуты', 'Гантели скользят вдоль ног', 'Спина ровная, опускайся до натяжения сзади бедра'],
    ['Hips back, knees slightly bent', 'Dumbbells slide along your legs', 'Flat back, lower until you feel the hamstrings']),
  leg_curl: c(
    ['Таз прижат к скамье', 'Сгибай плавно, без рывка', 'Медленно опускай'],
    ['Keep your hips on the pad', 'Curl smoothly, no jerking', 'Lower slowly']),
  leg_ext: c(
    ['Колено на оси тренажёра', 'Наверху задержись на секунду', 'Опускай медленно'],
    ['Knee lined up with the machine’s pivot', 'Pause for a second at the top', 'Lower slowly']),
  split_squat: c(
    ['Корпус прямо, шаг широкий', 'Опускайся вертикально вниз', 'Толкайся передней ногой'],
    ['Torso upright, wide stance', 'Drop straight down', 'Drive through the front foot']),
  glute_bridge: c(
    ['Пятки ближе к тазу', 'Поднимай таз ягодицами, не поясницей', 'Наверху сожми ягодицы'],
    ['Heels close to your hips', 'Lift with your glutes, not your lower back', 'Squeeze at the top']),
  calf_raise: c(
    ['Полная амплитуда: вниз до растяжения', 'Наверху пауза', 'Без пружинящих рывков'],
    ['Full range: stretch at the bottom', 'Pause at the top', 'No bouncing']),
  machine_chest_press: c(
    ['Лопатки сведены и прижаты к спинке', 'Рукояти на уровне середины груди', 'Не выпрямляй локти до щелчка'],
    ['Shoulder blades back and on the pad', 'Handles at mid-chest height', 'Don’t lock your elbows']),
  db_bench: c(
    ['Лопатки сведены, стопы на полу', 'Локти под углом ~45° к корпусу', 'Опускай гантели до уровня груди'],
    ['Shoulder blades back, feet on the floor', 'Elbows about 45° from your body', 'Lower to chest level']),
  bb_bench: c(
    ['Лопатки сведены, лёгкий прогиб', 'Штанга касается низа груди', 'Работай со страхующим'],
    ['Shoulder blades back, slight arch', 'Bar touches the lower chest', 'Use a spotter']),
  incline_db_press: c(
    ['Наклон скамьи 30°', 'Лопатки сведены', 'Жми вверх и чуть внутрь'],
    ['Bench at 30°', 'Shoulder blades back', 'Press up and slightly in']),
  pushup: c(
    ['Тело прямое от головы до пяток', 'Локти под углом ~45°', 'Грудь почти касается пола'],
    ['Body straight from head to heels', 'Elbows about 45°', 'Chest almost touches the floor']),
  lat_pulldown: c(
    ['Тяни локтями вниз, к бокам', 'Гриф к верху груди, не за голову', 'Не раскачивайся'],
    ['Pull your elbows down to your sides', 'Bar to your upper chest, not behind the neck', 'Don’t swing']),
  cable_row: c(
    ['Спина ровная, грудь вперёд', 'Тяни локтями, не руками', 'Сведи лопатки в конце'],
    ['Flat back, chest up', 'Pull with your elbows, not your hands', 'Squeeze your shoulder blades']),
  db_row: c(
    ['Рука и колено на скамье, спина ровная', 'Тяни гантель к поясу', 'Не скручивай корпус'],
    ['Hand and knee on the bench, flat back', 'Pull the dumbbell to your hip', 'Don’t twist your torso']),
  assisted_pullup: c(
    ['Начинай с плеч: опусти их вниз', 'Подбородок над перекладиной', 'Опускайся плавно'],
    ['Start by pulling your shoulders down', 'Chin over the bar', 'Lower with control']),
  chest_supported_row: c(
    ['Грудь прижата к упору', 'Тяни локтями назад', 'Сведи лопатки'],
    ['Chest on the pad', 'Drive your elbows back', 'Squeeze your shoulder blades']),
  back_ext: c(
    ['Двигайся от таза, не от поясницы', 'Поднимайся до прямой линии, без прогиба', 'Медленно'],
    ['Move from the hips, not the lower back', 'Rise to a straight line, don’t overarch', 'Go slowly']),
  db_shoulder_press: c(
    ['Спина прижата к спинке', 'Гантели жми вверх над плечами', 'Не прогибай поясницу'],
    ['Back against the pad', 'Press straight up over your shoulders', 'Don’t arch your lower back']),
  machine_shoulder_press: c(
    ['Рукояти на уровне плеч', 'Спина прижата', 'Не выпрямляй локти до щелчка'],
    ['Handles at shoulder height', 'Back on the pad', 'Don’t lock your elbows']),
  lateral_raise: c(
    ['Лёгкий вес, локти чуть согнуты', 'Поднимай до уровня плеч', 'Опускай медленно, без рывков'],
    ['Light weight, slight bend in the elbows', 'Raise to shoulder height', 'Lower slowly, no swinging']),
  face_pull: c(
    ['Блок на уровне лица', 'Тяни канат к глазам, разводя концы', 'Локти выше кистей'],
    ['Cable at face height', 'Pull the rope to your eyes, hands apart', 'Elbows higher than hands']),
  db_curl: c(
    ['Локти прижаты к корпусу', 'Не раскачивайся', 'Опускай до прямых рук'],
    ['Elbows pinned to your sides', 'Don’t swing', 'Lower to straight arms']),
  triceps_pushdown: c(
    ['Локти прижаты и неподвижны', 'Разгибай до конца', 'Медленно возвращай'],
    ['Elbows pinned and still', 'Fully extend', 'Return slowly']),
  plank: c(
    ['Локти под плечами', 'Тело прямое, таз не проваливается', 'Дыши спокойно'],
    ['Elbows under your shoulders', 'Straight body, hips don’t sag', 'Keep breathing']),
  side_plank: c(
    ['Локоть под плечом', 'Таз поднят, тело в одну линию', 'Начни с колен, если тяжело'],
    ['Elbow under your shoulder', 'Hips up, body in a straight line', 'Start from your knees if needed']),
  bird_dog: c(
    ['Тянись рукой и противоположной ногой', 'Спина неподвижна, как стол', 'Задержись на 2 секунды'],
    ['Reach with the opposite arm and leg', 'Keep your back still like a table', 'Hold for 2 seconds']),
  dead_bug: c(
    ['Поясница прижата к полу', 'Опускай противоположные руку и ногу', 'Медленно, с выдохом'],
    ['Lower back pressed into the floor', 'Lower the opposite arm and leg', 'Slowly, breathing out']),
  pallof_press: c(
    ['Встань боком к блоку', 'Выжимай рукоять вперёд, не давая повернуть корпус', 'Пресс напряжён'],
    ['Stand side-on to the cable', 'Press forward without letting your torso rotate', 'Brace your abs']),
  farmer_walk: c(
    ['Плечи вниз и назад', 'Корпус прямой, не заваливайся', 'Короткие ровные шаги'],
    ['Shoulders down and back', 'Stay upright, don’t lean', 'Short, even steps']),
  incline_walk: c(
    ['Не держись за поручни', 'Темп — можно говорить, но с трудом', 'Наклон 6–10%'],
    ['Don’t hold the rails', 'Pace: you can talk, but with effort', 'Incline 6–10%']),
  bike: c(
    ['Колено чуть согнуто в нижней точке', 'Спокойный темп', 'Спина ровная'],
    ['Slight knee bend at the bottom', 'Easy pace', 'Back straight']),
  rower: c(
    ['Сначала ноги, потом корпус, потом руки', 'Спина ровная', 'Назад в обратном порядке'],
    ['Legs, then body, then arms', 'Flat back', 'Reverse the order on the way back']),
  warmup: c(
    ['Вращения: шея, плечи, таз, колени, голеностопы', 'По 10 раз в каждую сторону', 'Без боли'],
    ['Circles: neck, shoulders, hips, knees, ankles', '10 each way', 'Pain-free']),
};
