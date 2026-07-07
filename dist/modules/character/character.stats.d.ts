export type HitDie = 'd6' | 'd8' | 'd10' | 'd12' | 'd20';
export declare function calcHitDie(constitution: number): {
    die: HitDie;
    max: number;
};
export declare function calcMaxHp(level: number, constitution: number, profVitality: number): number;
export declare function calcMaxEffort(constitution: number, profWillpower: number): number;
export declare function calcBExp(level: number): number;
export declare function rollAttribute(attrValue: number): {
    rolls: number[];
    result: number;
    kind: 'best' | 'worst' | 'single';
};
//# sourceMappingURL=character.stats.d.ts.map