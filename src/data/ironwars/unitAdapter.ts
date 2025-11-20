import { IUnitConfig } from '../../types/ironwars';
import { UnitConfig } from '../../entities/Unit';
import { UnitType } from '../UnitTypes';

const ROLE_TO_CLASS: Record<string, UnitConfig['type']> = {
    melee: 'frontline',
    tank: 'frontline',
    ranged: 'ranged',
    support: 'support',
    siege: 'siege'
};

const ROLE_TO_SIZE: Record<string, UnitConfig['size']> = {
    melee: 'normal',
    tank: 'large',
    ranged: 'normal',
    support: 'small',
    siege: 'large'
};

const ROLE_TO_MASS: Record<string, number> = {
    melee: 80,
    // Tanks like the Aegis Tank should feel heavy but still responsive.
    tank: 100,
    ranged: 60,
    // Support units like the Medic Drone should feel weighty, not like
    // rogues, so give them tank-like mass so their movement matches.
    support: 140,
    siege: 120
};

export const toUnitConfig = (
    unit: IUnitConfig,
    team: number,
    worldX: number,
    worldY: number
): UnitConfig => {
    const type = ROLE_TO_CLASS[unit.role] ?? 'frontline';
    const size = ROLE_TO_SIZE[unit.role] ?? 'normal';
    const mass = ROLE_TO_MASS[unit.role] ?? 80;

    return {
        x: worldX,
        y: worldY,
        team,
        unitType: unit.id as UnitType,
        type,
        size,
        stats: {
            maxHealth: unit.maxHp,
            damage: unit.attack,
            armor: unit.armor,
            moveSpeed: unit.moveSpeed,
            attackSpeed: unit.attackSpeed,
            range: unit.attackRange,
            mass
        }
    };
};
