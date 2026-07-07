const HIT_DIE_MAX = {
    d6: 6,
    d8: 8,
    d10: 10,
    d12: 12,
    d20: 20,
};
const BEXP_TABLE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10];
export function calcHitDie(constitution) {
    let die;
    if (constitution <= -4)
        die = 'd6';
    else if (constitution <= 0)
        die = 'd8';
    else if (constitution <= 2)
        die = 'd10';
    else if (constitution <= 4)
        die = 'd12';
    else
        die = 'd20';
    return { die, max: HIT_DIE_MAX[die] };
}
export function calcMaxHp(level, constitution, profVitality) {
    const { max } = calcHitDie(constitution);
    return 20 + level * max + profVitality;
}
export function calcMaxEffort(constitution, profWillpower) {
    return constitution * 5 + profWillpower;
}
export function calcBExp(level) {
    return BEXP_TABLE[level] ?? 0;
}
export function rollAttribute(attrValue) {
    const qty = Math.abs(attrValue) + 1;
    const rolls = Array.from({ length: qty }, () => Math.ceil(Math.random() * 20));
    if (attrValue > 0)
        return { rolls, result: Math.max(...rolls), kind: 'best' };
    if (attrValue < 0)
        return { rolls, result: Math.min(...rolls), kind: 'worst' };
    return { rolls, result: rolls[0], kind: 'single' };
}
//# sourceMappingURL=character.stats.js.map