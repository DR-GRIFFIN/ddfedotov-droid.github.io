// Health screening from the questionnaire. Decides whether training must wait for a doctor's OK.
// Not a diagnosis: any "yes" or strong pain means "ask a doctor first".

export const HEALTH_QUESTIONS = ['heart', 'chestPain', 'dizzy', 'pressure', 'surgery', 'restricted'];

export const PAIN_ZONES = ['neck', 'shoulders', 'upperBack', 'lowerBack', 'elbows', 'wrists', 'hips', 'knees', 'ankles'];

export const STRONG_PAIN = 7;

// health: { heart: true/false, ... }, pain: { lowerBack: 0..10, ... }
export function screen({ health = {}, pain = {} }) {
  const reasons = [];
  for (const q of HEALTH_QUESTIONS) if (health[q]) reasons.push({ type: 'health', key: q });
  for (const [zone, level] of Object.entries(pain)) {
    if (level >= STRONG_PAIN) reasons.push({ type: 'pain', key: zone, level });
  }
  return { blocked: reasons.length > 0, reasons };
}
