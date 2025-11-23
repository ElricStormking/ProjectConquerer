import { CardType, ResourceType, IStarterData } from '../../types/ironwars';

const GRID_WIDTH = 5;
const GRID_HEIGHT = 5;

const buildFortressCells = () => {
    const cells = [] as IStarterData['fortress']['cells'];
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const isCore = x === 2 && y === 2;
            const isBlocked = (x === 0 || x === GRID_WIDTH - 1) && (y === 0 || y === GRID_HEIGHT - 1);
            cells.push({
                x,
                y,
                type: isCore ? 'core' : isBlocked ? 'blocked' : 'buildable'
            });
        }
    }
    return cells;
};

export const COG_DOMINION_STARTER: IStarterData = {
    factionId: 'cog_dominion',
    commander: {
        id: 'commander_valen',
        name: 'Director Valen',
        factionId: 'cog_dominion',
        passiveId: 'profit_dividend',
        activeSkillId: 'orbital_strike',
        cooldown: 2000,
        portraitKey: 'commander_valen'
    },
    fortress: {
        id: 'iron_citadel',
        name: 'Iron Citadel',
        factionId: 'cog_dominion',
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
        cells: buildFortressCells(),
        maxHp: 500,
        abilities: ['overclock_generators', 'shield_pulse']
    },
    units: {
        cog_soldier: {
            id: 'cog_soldier',
            name: 'Feral Warrior',
            role: 'melee',
            factionId: 'cog_dominion',
            maxHp: 160,
            attack: 18,
            attackRange: 60,
            attackSpeed: 1.1,
            moveSpeed: 70,
            armor: 5,
            spriteKey: 'unit_cog_soldier',
            scale: 1
        },
        cog_railgunner: {
            id: 'cog_railgunner',
            name: 'Railgunner',
            role: 'ranged',
            factionId: 'cog_dominion',
            maxHp: 110,
            attack: 32,
            attackRange: 420,
            attackSpeed: 0.7,
            moveSpeed: 55,
            armor: 2,
            spriteKey: 'unit_cog_railgunner',
            scale: 1
        },
        cog_aegis_tank: {
            id: 'cog_aegis_tank',
            name: 'Aegis Tank',
            role: 'tank',
            factionId: 'cog_dominion',
            maxHp: 420,
            attack: 24,
            attackRange: 90,
            attackSpeed: 0.6,
            moveSpeed: 40,
            armor: 9,
            spriteKey: 'unit_cog_aegis_tank',
            scale: 1.1
        },
        cog_medic_drone: {
            id: 'cog_medic_drone',
            name: 'Medic Druid',
            role: 'support',
            factionId: 'cog_dominion',
            maxHp: 90,
            attack: 0,
            attackRange: 120,
            attackSpeed: 0.5,
            moveSpeed: 40,
            armor: 1,
            spriteKey: 'unit_cog_medic_drone',
            scale: 0.9
        },
        cog_thunder_cannon: {
            id: 'cog_thunder_cannon',
            name: 'Thunder Mage',
            role: 'siege',
            factionId: 'cog_dominion',
            maxHp: 260,
            attack: 55,
            attackRange: 520,
            attackSpeed: 0.45,
            moveSpeed: 30,
            armor: 4,
            spriteKey: 'unit_cog_thunder_cannon',
            scale: 1.15
        },
        raider_grunt: {
            id: 'raider_grunt',
            name: 'Iron Raider',
            role: 'melee',
            factionId: 'iron_raiders',
            maxHp: 130,
            attack: 16,
            attackRange: 50,
            attackSpeed: 0.9,
            moveSpeed: 65,
            armor: 3,
            spriteKey: 'unit_raider_grunt',
            scale: 1
        },
        raider_bomber: {
            id: 'raider_bomber',
            name: 'Siege Bomber',
            role: 'siege',
            factionId: 'iron_raiders',
            maxHp: 200,
            attack: 40,
            attackRange: 380,
            attackSpeed: 0.5,
            moveSpeed: 45,
            armor: 2,
            spriteKey: 'unit_raider_bomber',
            scale: 1.05
        },
        raider_rogue: {
            id: 'raider_rogue',
            name: 'Raider Cutthroat',
            role: 'melee',
            factionId: 'iron_raiders',
            maxHp: 90,
            attack: 22,
            attackRange: 45,
            attackSpeed: 1.6,
            moveSpeed: 80,
            armor: 2,
            spriteKey: 'unit_raider_rogue',
            scale: 1
        },
        raider_archer: {
            id: 'raider_archer',
            name: 'Raider Archer',
            role: 'ranged',
            factionId: 'iron_raiders',
            maxHp: 95,
            attack: 24,
            attackRange: 420,
            attackSpeed: 0.9,
            moveSpeed: 50,
            armor: 2,
            spriteKey: 'unit_raider_archer',
            scale: 1
        },
        raider_boss: {
            id: 'raider_boss',
            name: 'Iron Juggernaut',
            role: 'tank',
            factionId: 'iron_raiders',
            maxHp: 1260,   // 3x Aegis Tank HP
            attack: 72,    // 3x Aegis Tank damage
            attackRange: 120,
            attackSpeed: 0.33, // ~3s cooldown
            moveSpeed: 30,
            armor: 10,
            spriteKey: 'unit_raider_bomber',
            scale: 3
        }
    },
    deck: [
        { id: 'card_soldier_1', name: 'Feral Warrior', type: CardType.UNIT, cost: 2, resourceType: ResourceType.PROFIT, unitId: 'cog_soldier', portraitKey: 'card_soldier', description: 'Deploy a sturdy frontline soldier.' },
        { id: 'card_soldier_2', name: 'Feral Warrior', type: CardType.UNIT, cost: 2, resourceType: ResourceType.PROFIT, unitId: 'cog_soldier', portraitKey: 'card_soldier', description: 'Deploy a sturdy frontline soldier.' },
        { id: 'card_soldier_3', name: 'Feral Warrior', type: CardType.UNIT, cost: 2, resourceType: ResourceType.PROFIT, unitId: 'cog_soldier', portraitKey: 'card_soldier', description: 'Deploy a sturdy frontline soldier.' },
        { id: 'card_railgunner_1', name: 'Railgunner', type: CardType.UNIT, cost: 3, resourceType: ResourceType.PROFIT, unitId: 'cog_railgunner', portraitKey: 'card_railgunner', description: 'Deploy a long-range marksman.' },
        { id: 'card_railgunner_2', name: 'Railgunner', type: CardType.UNIT, cost: 3, resourceType: ResourceType.PROFIT, unitId: 'cog_railgunner', portraitKey: 'card_railgunner', description: 'Deploy a long-range marksman.' },
        { id: 'card_railgunner_3', name: 'Railgunner', type: CardType.UNIT, cost: 3, resourceType: ResourceType.PROFIT, unitId: 'cog_railgunner', portraitKey: 'card_railgunner', description: 'Deploy a long-range marksman.' },
        { id: 'card_aegis_tank_1', name: 'Aegis Tank', type: CardType.UNIT, cost: 4, resourceType: ResourceType.PROFIT, unitId: 'cog_aegis_tank', portraitKey: 'card_tank', description: 'Deploy a defensive tank.' },
        { id: 'card_aegis_tank_2', name: 'Aegis Tank', type: CardType.UNIT, cost: 4, resourceType: ResourceType.PROFIT, unitId: 'cog_aegis_tank', portraitKey: 'card_tank', description: 'Deploy a defensive tank.' },
        { id: 'card_medic_drone_1', name: 'Medic Druid', type: CardType.UNIT, cost: 2, resourceType: ResourceType.PROFIT, unitId: 'cog_medic_drone', portraitKey: 'card_medic', description: 'Deploy a drone that heals nearby allies.' },
        { id: 'card_medic_drone_2', name: 'Medic Druid', type: CardType.UNIT, cost: 2, resourceType: ResourceType.PROFIT, unitId: 'cog_medic_drone', portraitKey: 'card_medic', description: 'Deploy a drone that heals nearby allies.' },
        { id: 'card_medic_drone_3', name: 'Medic Druid', type: CardType.UNIT, cost: 2, resourceType: ResourceType.PROFIT, unitId: 'cog_medic_drone', portraitKey: 'card_medic', description: 'Deploy a drone that heals nearby allies.' },
        { id: 'card_thunder_cannon_1', name: 'Thunder Mage', type: CardType.UNIT, cost: 5, resourceType: ResourceType.PROFIT, unitId: 'cog_thunder_cannon', portraitKey: 'card_thunder_mage', description: 'Deploy a heavy artillery cannon.' },
        { id: 'card_thunder_cannon_2', name: 'Thunder Mage', type: CardType.UNIT, cost: 5, resourceType: ResourceType.PROFIT, unitId: 'cog_thunder_cannon', portraitKey: 'card_thunder_mage', description: 'Deploy a heavy artillery cannon.' },
        { id: 'card_cannon_tower_1', name: 'Cannon Tower', type: CardType.SPELL, cost: 4, resourceType: ResourceType.PROFIT, spellEffectId: 'cannon_tower', portraitKey: 'card_cannon_tower', description: 'Build a stationary cannon tower on the fortress grid.' },
        { id: 'card_barrier_field', name: 'Armor Shop', type: CardType.SPELL, cost: 3, resourceType: ResourceType.PROFIT, spellEffectId: 'barrier_field', portraitKey: 'card_spell_barrier', description: 'Construct an armor shop that grants shields to units on this tile.' },
        { id: 'card_overclock', name: 'Overclock', type: CardType.SPELL, cost: 2, resourceType: ResourceType.PROFIT, spellEffectId: 'overclock', portraitKey: 'card_spell_overclock', description: 'Increase attack speed briefly.' }
    ],
    waves: [
        {
            id: 'wave_1',
            index: 1,
            spawns: [
                { unitId: 'raider_grunt', count: 8, spawnTime: 0, lane: 'north' },
                { unitId: 'raider_grunt', count: 8, spawnTime: 10, lane: 'center' },
                { unitId: 'raider_bomber', count: 4, spawnTime: 18, lane: 'south' }
            ]
        },
        {
            id: 'wave_2',
            index: 2,
            spawns: [
                { unitId: 'raider_grunt', count: 10, spawnTime: 0, lane: 'north' },
                { unitId: 'raider_grunt', count: 10, spawnTime: 8, lane: 'center' },
                { unitId: 'raider_bomber', count: 6, spawnTime: 16, lane: 'south' }
            ]
        },
        {
            id: 'wave_3',
            index: 3,
            spawns: [
                { unitId: 'raider_boss',   count: 1, spawnTime: 0, lane: 'center' },
                { unitId: 'raider_rogue',  count: 6, spawnTime: 0, lane: 'north' },
                { unitId: 'raider_archer', count: 6, spawnTime: 0, lane: 'south' }
            ]
        }
    ]
};
