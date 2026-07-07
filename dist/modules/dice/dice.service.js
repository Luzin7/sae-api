import { rollAttribute } from '../character/character.stats.js';
export class DiceService {
    roll(body) {
        const { rolls, result, kind } = rollAttribute(body.attrValue);
        const total = result + body.skillBonus + body.bExp;
        return {
            attribute: body.attribute,
            rolls,
            result,
            kind,
            skillBonus: body.skillBonus,
            bExp: body.bExp,
            total,
        };
    }
}
//# sourceMappingURL=dice.service.js.map