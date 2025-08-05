export const MESSAGE_TEMPLATES: readonly string[] = [
  "Merhaba! Nasılsın?",
  "Bugün nasıl geçiyor?",
  "Selam, ne yapıyorsun?",
  "İyi günler! Keyifler nasıl?",
  "Hadi biraz sohbet edelim!",
  "Bugün güzel bir gün değil mi?",
  "Nasıl gidiyor işler?",
  "Selam! Uzun zamandır konuşmuyoruz."
] as const;
export function getRandomMessageTemplate(): string {
  const randomIndex = Math.floor(Math.random() * MESSAGE_TEMPLATES.length);
  return MESSAGE_TEMPLATES[randomIndex];
}
export function getRandomMessageTemplates(count: number): string[] {
  if (count <= 0) return [];
  if (count >= MESSAGE_TEMPLATES.length) {
    return [...MESSAGE_TEMPLATES].sort(() => Math.random() - 0.5);
  }
  const shuffled = [...MESSAGE_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
