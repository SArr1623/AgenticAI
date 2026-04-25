export const MANIFESTATIONS = [
  "You are capable of achieving everything you set your mind to.",
  "Every day is a fresh start. Make it count.",
  "Your focus determines your reality.",
  "Small steps taken consistently lead to extraordinary results.",
  "You have the power to create the life you envision.",
  "Today's efforts are tomorrow's achievements.",
  "Stay focused. Stay relentless. The results will come.",
  "Clarity of purpose brings mastery of action.",
  "Every distraction you overcome is a victory.",
  "The most productive person is the most intentional.",
  "You are building something great, one focused hour at a time.",
  "Believe in the process. Trust the work.",
];

export function getDailyManifestation() {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return MANIFESTATIONS[day % MANIFESTATIONS.length];
}
