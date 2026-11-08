// Calorie and protein targets for men (Mifflin–St Jeor).

const ACTIVITY = { low: 1.375, mid: 1.55, high: 1.725 }; // includes 2–4 gym sessions a week
const GOAL_DELTA = { lose: -450, recomp: -250, gain: 250, maintain: 0 };
const PROTEIN_PER_KG = { lose: 2.0, recomp: 2.0, gain: 1.8, maintain: 1.6 };
const MIN_KCAL = 1500;

const roundTo = (x, step) => Math.round(x / step) * step;

export function bmr({ weight, height, age }) {
  return 10 * weight + 6.25 * height - 5 * age + 5;
}

export function targets({ weight, height, age, activity, goal }) {
  const tdee = bmr({ weight, height, age }) * (ACTIVITY[activity] ?? ACTIVITY.low);
  const kcal = Math.max(MIN_KCAL, roundTo(tdee + (GOAL_DELTA[goal] ?? 0), 50));
  const protein = roundTo(weight * (PROTEIN_PER_KG[goal] ?? 1.6), 5);
  return { kcal, protein };
}
