// Content for the simple nutrition mode: habits, lessons, protein cheat sheet.
// Numbers are rounded, typical values; the goal is orientation, not precision.

const L = (ru, en) => ({ ru, en });

export const HABITS = [
  { id: 'protein_meal', name: L('Белок в каждом приёме пищи', 'Protein at every meal'),
    hint: L('Ладонь мяса, рыбы, творога или яиц — в завтрак, обед и ужин.', 'A palm of meat, fish, cottage cheese or eggs at breakfast, lunch and dinner.') },
  { id: 'veggies', name: L('Овощи 2 раза в день', 'Vegetables twice a day'),
    hint: L('Кулак овощей: салат, огурцы, помидоры, капуста, замороженная смесь.', 'A fist of veggies: salad, cucumbers, tomatoes, cabbage, a frozen mix.') },
  { id: 'water', name: L('Вода вместо сладких напитков', 'Water instead of sugary drinks'),
    hint: L('Газировка, соки, сладкий чай и кофе — заменить на воду или напитки без сахара.', 'Swap soda, juice, sweet tea and coffee for water or zero-sugar drinks.') },
  { id: 'plate', name: L('Одна тарелка по правилу в день', 'One “rule plate” a day'),
    hint: L('Половина — овощи, четверть — белок, четверть — гарнир.', 'Half veggies, a quarter protein, a quarter carbs.') },
  { id: 'slow', name: L('Есть медленно, 15+ минут', 'Eat slowly, 15+ minutes'),
    hint: L('Без телефона и телевизора. Сытость приходит через 15–20 минут.', 'No phone or TV. Fullness kicks in after 15–20 minutes.') },
  { id: 'snack', name: L('Полезный перекус с собой', 'Bring a healthy snack'),
    hint: L('Йогурт, творог, фрукт, горсть орехов — чтобы не брать печенье.', 'Yogurt, cottage cheese, fruit, a handful of nuts — instead of cookies.') },
  { id: 'dinner', name: L('Ужин за 2–3 часа до сна', 'Dinner 2–3 hours before bed'),
    hint: L('Меньше поздних перекусов «на автомате».', 'Fewer mindless late-night snacks.') },
];

export const HABIT_BY_ID = Object.fromEntries(HABITS.map((h) => [h.id, h]));

// Lessons: a line starting with "• " is a list item.
export const LESSONS = [
  {
    title: L('Калории — это энергия', 'Calories are energy'),
    body: L([
      'Калории — это энергия из еды. Тело тратит её на жизнь, работу и тренировки.',
      'Вес зависит от баланса:',
      '• ешь больше, чем тратишь → вес растёт;',
      '• ешь меньше, чем тратишь → вес уходит;',
      '• поровну → вес стоит.',
      'Считать калории не обязательно. Порции рукой из этого раздела дают примерно нужное количество — этого хватит для старта.',
      'Хороший темп похудения — 0,5–1% веса в неделю. Быстрее — уходят мышцы и силы.',
    ], [
      'Calories are the energy in food. Your body spends it on living, working and training.',
      'Weight depends on the balance:',
      '• eat more than you burn → weight goes up;',
      '• eat less than you burn → weight goes down;',
      '• equal → weight stays.',
      'You don’t have to count calories. The hand portions in this section give roughly the right amount — enough to start.',
      'A good pace for weight loss is 0.5–1% of body weight a week. Faster, and you lose muscle and energy.',
    ]),
  },
  {
    title: L('Белок: зачем он тебе', 'Protein: why you need it'),
    body: L([
      'Белок — строительный материал для мышц. Когда тренируешься, его нужно больше обычного.',
      '• На похудении белок помогает сохранить мышцы — уходит жир, а не сила.',
      '• Белок сытный: после него дольше не хочется есть.',
      '• Распредели его на 3–4 приёма пищи — так он лучше работает, чем всё за ужином.',
      'В простом режиме цель по белку — это ладони. Ладонь мяса, рыбы или творога — это примерно 25 г белка.',
      'Спортивное питание не обязательно. Протеин — просто удобный продукт, если не успеваешь добрать белок едой.',
    ], [
      'Protein is the building material for muscle. When you train, you need more than usual.',
      '• When losing weight, protein helps keep muscle — you lose fat, not strength.',
      '• Protein is filling: you stay full longer.',
      '• Spread it over 3–4 meals — that works better than all at dinner.',
      'In simple mode your protein goal is counted in palms. A palm of meat, fish or cottage cheese is about 25 g of protein.',
      'Supplements are optional. Protein powder is just a handy food if you can’t get enough from meals.',
    ]),
  },
  {
    title: L('Где брать белок', 'Where to get protein'),
    body: L([
      'Лучшие источники продаются в любом магазине:',
      '• курица, индейка, говядина;',
      '• рыба и консервированный тунец;',
      '• творог, греческий йогурт, кефир;',
      '• яйца;',
      '• фасоль, чечевица, нут.',
      'Осторожно: в колбасе, сосисках и пельменях белка меньше, чем кажется, а жира — больше.',
      'Подробные порции — в шпаргалке «Где белок» в этом разделе.',
    ], [
      'The best sources are in any store:',
      '• chicken, turkey, beef;',
      '• fish and canned tuna;',
      '• cottage cheese, Greek yogurt, kefir;',
      '• eggs;',
      '• beans, lentils, chickpeas.',
      'Careful: sausages, hot dogs and dumplings have less protein than you’d think — and more fat.',
      'Detailed portions are in the “Where’s the protein” cheat sheet in this section.',
    ]),
  },
  {
    title: L('Жидкие калории', 'Liquid calories'),
    body: L([
      'Напитки не насыщают, но калорий в них много:',
      '• 0,5 л сладкой газировки — около 200 ккал;',
      '• стакан сока — около 110 ккал;',
      '• 0,5 л пива — 200–250 ккал;',
      '• большой латте с сиропом — 250–350 ккал.',
      'Две газировки в день — это почти обед, который не заметил.',
      'Замена: вода, чай и кофе без сахара, напитки «без сахара» (zero). Это самый лёгкий шаг к похудению.',
    ], [
      'Drinks don’t fill you up, but they carry a lot of calories:',
      '• 0.5 L of soda — about 200 kcal;',
      '• a glass of juice — about 110 kcal;',
      '• 0.5 L of beer — 200–250 kcal;',
      '• a large flavored latte — 250–350 kcal.',
      'Two sodas a day is almost a lunch you didn’t notice.',
      'Swap for water, unsweetened tea and coffee, or zero-sugar drinks. It’s the easiest step toward losing weight.',
    ]),
  },
  {
    title: L('Перекусы без вреда', 'Smart snacks'),
    body: L([
      'Перекус нужен, если между едой больше 4–5 часов и ты сильно голоден. Главное — планировать его заранее.',
      'Хорошие варианты:',
      '• творог или греческий йогурт;',
      '• стакан кефира;',
      '• фрукт и горсть орехов;',
      '• 2 варёных яйца;',
      '• хлебец с сыром.',
      'Печенье, батончики и чипсы съедаются «на автомате» и почти не насыщают.',
    ], [
      'A snack makes sense if meals are more than 4–5 hours apart and you’re really hungry. The key is to plan it ahead.',
      'Good options:',
      '• cottage cheese or Greek yogurt;',
      '• a glass of kefir;',
      '• a piece of fruit and a handful of nuts;',
      '• 2 boiled eggs;',
      '• a crispbread with cheese.',
      'Cookies, bars and chips get eaten on autopilot and barely fill you up.',
    ]),
  },
  {
    title: L('Почему вес скачет', 'Why your weight jumps'),
    body: L([
      'Вес может меняться на 1–2 кг за день. Это не жир, а вода:',
      '• солёная еда задерживает воду;',
      '• много углеводов накануне — тоже;',
      '• после тяжёлой тренировки мышцы держат больше воды.',
      'Поэтому взвешивайся утром, после туалета, до еды — и смотри на среднее за неделю. Приложение показывает именно его.',
      'Если среднее за 2–3 недели не меняется, а ты хочешь похудеть — убери одну порцию гарнира или жиров в день.',
    ], [
      'Your weight can change by 1–2 kg in a day. That’s water, not fat:',
      '• salty food holds water;',
      '• lots of carbs the day before — too;',
      '• after a hard workout, muscles hold more water.',
      'So weigh yourself in the morning, after the toilet, before eating — and look at the weekly average. That’s what the app shows.',
      'If the average doesn’t move for 2–3 weeks and you want to lose weight, drop one carb or fat portion a day.',
    ]),
  },
  {
    title: L('Гости, праздники, выходные', 'Parties, holidays, weekends'),
    body: L([
      'Один ужин не испортит результат. Портит — когда «всё равно сорвался» превращается в неделю.',
      '• Начни с белка и овощей, потом остальное.',
      '• Ешь медленно, не стой у стола с закусками.',
      '• Алкоголь — это калории плюс аппетит. Чередуй с водой.',
      'На следующий день просто вернись к обычному. Без голодовки и «отработки» в зале.',
      'Возвращение — главное правило этого приложения. В еде оно работает так же, как в тренировках.',
    ], [
      'One dinner won’t ruin your progress. What does is when “I already blew it” turns into a whole week.',
      '• Start with protein and veggies, then the rest.',
      '• Eat slowly, don’t hang around the snack table.',
      '• Alcohol is calories plus appetite. Alternate with water.',
      'The next day, just go back to normal. No starving, no “burning it off” in the gym.',
      'Coming back is the main rule of this app. It works for food the same way it works for training.',
    ]),
  },
];

// Protein cheat sheet: portion, grams of protein, palms (1 palm ≈ 25 g of protein).
export const PROTEIN_SOURCES = [
  { name: L('Куриная грудка, готовая', 'Chicken breast, cooked'), portion: L('120 г (ладонь)', '120 g (a palm)'), protein: 35 },
  { name: L('Индейка, филе', 'Turkey breast'), portion: L('120 г (ладонь)', '120 g (a palm)'), protein: 30 },
  { name: L('Говядина постная', 'Lean beef'), portion: L('120 г (ладонь)', '120 g (a palm)'), protein: 30 },
  { name: L('Рыба (треска, минтай, лосось)', 'Fish (cod, pollock, salmon)'), portion: L('120 г (ладонь)', '120 g (a palm)'), protein: 25 },
  { name: L('Тунец консервированный', 'Canned tuna'), portion: L('банка, ~130 г без жидкости', 'a can, ~130 g drained'), protein: 30 },
  { name: L('Творог 5%', 'Cottage cheese 5%'), portion: L('пачка 200 г', '200 g pack'), protein: 34 },
  { name: L('Греческий йогурт', 'Greek yogurt'), portion: L('150 г', '150 g'), protein: 15 },
  { name: L('Яйца', 'Eggs'), portion: L('2 штуки', '2 eggs'), protein: 12 },
  { name: L('Кефир 1%', 'Kefir 1%'), portion: L('стакан 250 мл', 'a 250 ml glass'), protein: 8 },
  { name: L('Сыр твёрдый', 'Hard cheese'), portion: L('30 г (2 ломтика)', '30 g (2 slices)'), protein: 7 },
  { name: L('Фасоль, чечевица, нут — варёные', 'Beans, lentils, chickpeas — cooked'), portion: L('150 г', '150 g'), protein: 13 },
  { name: L('Протеин (по желанию)', 'Protein powder (optional)'), portion: L('1 мерная ложка, 30 г', '1 scoop, 30 g'), protein: 23 },
];

export const WEAK_PROTEIN = L(
  'Колбаса, сосиски, пельмени, наггетсы: белка меньше, чем кажется, жира и соли — больше. Не считай их ладонью белка.',
  'Sausages, hot dogs, dumplings, nuggets: less protein than you’d think, more fat and salt. Don’t count them as a palm of protein.',
);
