// Rule-based program recommendation. The AI worker will refine this later;
// these rules stay as the fallback when the AI is unavailable.

export function recommend(answers) {
  const { where, experience, days = [], minutes, pain = {} } = answers;
  const reasons = [];
  let program = 'start';

  if (where === 'dumbbells') {
    program = 'dumbbells';
    reasons.push('rDumbbells');
  } else if ((pain.lowerBack ?? 0) > 0 || (pain.upperBack ?? 0) > 0) {
    program = 'back';
    reasons.push('rBack');
  } else if (experience === 'break') {
    program = 'comeback';
    reasons.push('rBreak');
  } else if (days.length <= 2 || minutes <= 30) {
    program = 'short';
    reasons.push('rShort');
  } else {
    reasons.push('rStart');
  }
  if (experience !== 'break') reasons.push('rTechnique');
  return { program, reasons };
}
