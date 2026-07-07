import { describe, it, expect } from 'vitest';
import { DiceService } from './dice.service.js';
const service = new DiceService();
describe('DiceService.roll', () => {
    it('total equals result + skillBonus + bExp', () => {
        const result = service.roll({
            attribute: 'COG',
            attrValue: 0,
            skillBonus: 3,
            bExp: 2,
        });
        expect(result.total).toBe(result.result + 3 + 2);
    });
    it('includes attribute in the response', () => {
        const result = service.roll({ attribute: 'PSI', attrValue: 1, skillBonus: 0, bExp: 0 });
        expect(result.attribute).toBe('PSI');
    });
    it('passes through the roll result from rollAttribute', () => {
        const result = service.roll({ attribute: 'CON', attrValue: 2, skillBonus: 0, bExp: 0 });
        expect(result.rolls).toHaveLength(3);
        expect(result.kind).toBe('best');
    });
    it('total is correct for negative attribute', () => {
        const result = service.roll({ attribute: 'MOT', attrValue: -1, skillBonus: 1, bExp: 3 });
        expect(result.total).toBe(result.result + 1 + 3);
        expect(result.kind).toBe('worst');
    });
});
//# sourceMappingURL=dice.service.test.js.map