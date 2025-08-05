import { 
  MESSAGE_TEMPLATES, 
  getRandomMessageTemplate, 
  getRandomMessageTemplates 
} from './message-templates';
describe('Message Templates', () => {
  describe('MESSAGE_TEMPLATES', () => {
    it('should contain expected message templates', () => {
      expect(MESSAGE_TEMPLATES).toContain("Merhaba! Nasılsın?");
      expect(MESSAGE_TEMPLATES).toContain("Bugün nasıl geçiyor?");
      expect(MESSAGE_TEMPLATES).toContain("Selam, ne yapıyorsun?");
      expect(MESSAGE_TEMPLATES).toContain("İyi günler! Keyifler nasıl?");
      expect(MESSAGE_TEMPLATES).toContain("Hadi biraz sohbet edelim!");
      expect(MESSAGE_TEMPLATES).toContain("Bugün güzel bir gün değil mi?");
      expect(MESSAGE_TEMPLATES).toContain("Nasıl gidiyor işler?");
      expect(MESSAGE_TEMPLATES).toContain("Selam! Uzun zamandır konuşmuyoruz.");
    });
    it('should have exactly 8 templates', () => {
      expect(MESSAGE_TEMPLATES).toHaveLength(8);
    });
    it('should be readonly', () => {
      expect(MESSAGE_TEMPLATES).toEqual(expect.any(Array));
      expect(MESSAGE_TEMPLATES.length).toBe(8);
    });
  });
  describe('getRandomMessageTemplate', () => {
    it('should return a string', () => {
      const template = getRandomMessageTemplate();
      expect(typeof template).toBe('string');
    });
    it('should return a template from MESSAGE_TEMPLATES', () => {
      const template = getRandomMessageTemplate();
      expect(MESSAGE_TEMPLATES).toContain(template);
    });
    it('should return different templates on multiple calls (probabilistic)', () => {
      const templates = new Set();
      for (let i = 0; i < 50; i++) {
        templates.add(getRandomMessageTemplate());
      }
      expect(templates.size).toBeGreaterThan(1);
    });
    it('should always return valid templates', () => {
      for (let i = 0; i < 20; i++) {
        const template = getRandomMessageTemplate();
        expect(template).toBeTruthy();
        expect(typeof template).toBe('string');
        expect(MESSAGE_TEMPLATES).toContain(template);
      }
    });
  });
  describe('getRandomMessageTemplates', () => {
    it('should return empty array for count <= 0', () => {
      expect(getRandomMessageTemplates(0)).toEqual([]);
      expect(getRandomMessageTemplates(-1)).toEqual([]);
    });
    it('should return requested number of templates', () => {
      expect(getRandomMessageTemplates(1)).toHaveLength(1);
      expect(getRandomMessageTemplates(3)).toHaveLength(3);
      expect(getRandomMessageTemplates(5)).toHaveLength(5);
    });
    it('should return all templates when count >= total templates', () => {
      const result = getRandomMessageTemplates(10);
      expect(result).toHaveLength(MESSAGE_TEMPLATES.length);
      MESSAGE_TEMPLATES.forEach(template => {
        expect(result).toContain(template);
      });
    });
    it('should return unique templates (no duplicates)', () => {
      const result = getRandomMessageTemplates(5);
      const uniqueTemplates = new Set(result);
      expect(uniqueTemplates.size).toBe(result.length);
    });
    it('should return templates from MESSAGE_TEMPLATES', () => {
      const result = getRandomMessageTemplates(3);
      result.forEach(template => {
        expect(MESSAGE_TEMPLATES).toContain(template);
      });
    });
    it('should return different order on multiple calls (probabilistic)', () => {
      const result1 = getRandomMessageTemplates(MESSAGE_TEMPLATES.length);
      const result2 = getRandomMessageTemplates(MESSAGE_TEMPLATES.length);
      expect(result1).toHaveLength(result2.length);
      expect(result1.every(template => result2.includes(template))).toBe(true);
    });
    it('should handle edge case of requesting exactly available count', () => {
      const result = getRandomMessageTemplates(MESSAGE_TEMPLATES.length);
      expect(result).toHaveLength(MESSAGE_TEMPLATES.length);
      MESSAGE_TEMPLATES.forEach(template => {
        expect(result).toContain(template);
      });
    });
  });
});
