export interface UnitLevelScaling {
    level: number;
    healthMultiplier: number;
    damageMultiplier: number;
    armorBonus: number;
}

export interface ScalableUnitStats {
    maxHealth: number;
    damage: number;
    armor: number;
}

export const clampUnitLevel = (level?: number): number =>
    Math.max(1, Math.min(100, Math.round(Number(level) || 1)));

export const getUnitLevelScaling = (levelInput?: number): UnitLevelScaling => {
    const level = clampUnitLevel(levelInput);
    const levelOffset = level - 1;

    return {
        level,
        healthMultiplier: 1 + levelOffset * 0.055 + levelOffset * levelOffset * 0.00045,
        damageMultiplier: 1 + levelOffset * 0.04 + levelOffset * levelOffset * 0.00025,
        armorBonus: Math.floor(levelOffset / 8)
    };
};

export const applyUnitLevelScalingToStats = <T extends ScalableUnitStats>(
    stats: T,
    levelInput?: number
): T => {
    const scaling = getUnitLevelScaling(levelInput);
    return {
        ...stats,
        maxHealth: Math.max(1, Math.round(stats.maxHealth * scaling.healthMultiplier)),
        damage: Math.max(1, Math.round(stats.damage * scaling.damageMultiplier)),
        armor: Math.round(stats.armor + scaling.armorBonus)
    };
};
