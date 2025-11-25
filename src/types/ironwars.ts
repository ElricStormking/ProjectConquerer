export enum ResourceType {
    GOLD = 'gold',
    PROFIT = 'profit',
    CHI_FLOW = 'chi_flow',
    HEAT = 'heat',
    TACTICAL_ORDERS = 'tactical_orders',
    FAITH = 'faith',
    LIFEFORCE = 'lifeforce',
    AETHERSTORM = 'aetherstorm',
    SOULFROST = 'soulfrost',
    BLOOD_FRENZY = 'blood_frenzy'
}

export enum CardType {
    UNIT = 'unit',
    STRUCTURE = 'structure',
    SPELL = 'spell',
    MODULE = 'module'
}

export interface ICard {
    id: string;
    name: string;
    type: CardType;
    cost: number;
    resourceType: ResourceType;
    factionId?: string;
    unitId?: string;
    structureId?: string;
    spellEffectId?: string;
    moduleId?: string;
    portraitKey: string;
    description: string;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export type FortressCellType = 'buildable' | 'core' | 'blocked';

export interface IFortressCell {
    x: number;
    y: number;
    type: FortressCellType;
    occupantId?: string;
}

export interface IFortressConfig {
    id: string;
    name: string;
    factionId: string;
    gridWidth: number;
    gridHeight: number;
    cells: IFortressCell[];
    maxHp: number;
    abilities: string[];
}

export type UnitRole = 'melee' | 'ranged' | 'support' | 'tank' | 'siege';

export interface IUnitConfig {
    id: string;
    name: string;
    role: UnitRole;
    factionId: string;
    maxHp: number;
    attack: number;
    attackRange: number;
    attackSpeed: number;
    moveSpeed: number;
    armor: number;
    spriteKey: string;
    scale: number;
}

export type EnemyLane = 'north' | 'center' | 'south';

export interface IEnemySpawn {
    unitId: string;
    count: number;
    spawnTime: number;
    lane: EnemyLane;
}

export interface IWaveConfig {
    id: string;
    index: number;
    spawns: IEnemySpawn[];
}

export type BattlePhase = 'PREPARATION' | 'BATTLE' | 'WAVE_COMPLETE';

export interface IGameState {
    fortressHp: number;
    fortressMaxHp: number;
    currentWave: number;
    phase: BattlePhase;
    gold: number;
    factionResource: number;
    drawPile: ICard[];
    hand: ICard[];
    discardPile: ICard[];
}

export interface ICommanderConfig {
    id: string;
    name: string;
    factionId: string;
    passiveId: string;
    activeSkillId: string;
    cooldown: number;
    portraitKey: string;
}

export interface IStarterData {
    factionId: string;
    commander: ICommanderConfig;
    fortress: IFortressConfig;
    units: Record<string, IUnitConfig>;
    deck: ICard[];
    waves: IWaveConfig[];
}

export interface IDeckState {
    drawPile: ICard[];
    discardPile: ICard[];
    hand: ICard[];
    maxHandSize: number;
}

export interface IHandUpdatePayload {
    hand: ICard[];
}

export interface ICardPlacementPayload {
    card: ICard;
    gridX: number;
    gridY: number;
}

export interface IFortressCellSelection {
    gridX: number;
    gridY: number;
    cell: IFortressCell;
}

export interface IDeckSystem {
    getState(): IDeckState;
    shuffle(): void;
    draw(count?: number): ICard[];
    discard(cardId: string): void;
    reset(deck: ICard[]): void;
}

export interface ICardSystem {
    resolveCardPlacement(payload: ICardPlacementPayload): void;
}

export enum NodeType {
    BATTLE = 'battle',
    ELITE = 'elite',
    BOSS = 'boss',
    EVENT = 'event',
    SHOP = 'shop',
    RECRUITMENT = 'recruitment',
    REST = 'rest'
}

export interface IMapNode {
    id: string;
    type: NodeType;
    stageIndex: number;
    tier: number;
    encounterId?: string;
    nextNodeIds: string[];
    posX: number;
    posY: number;
    iconKey: string;
    rewardTier: number;
    isCompleted: boolean;
    isAccessible: boolean;
}

export interface IStageConfig {
    id: string;
    index: number;
    name: string;
    theme?: string;
    musicKey?: string;
    nodes: IMapNode[];
    backgroundKey: string;
    bossNodeId: string;
    nextStageId?: string;
}

export interface IEventOption {
    id: string;
    label: string;
    effectId: string;
    successChance?: number;
    description?: string;
}

export interface IEventConfig {
    id: string;
    name: string;
    description: string;
    options: IEventOption[];
    iconKey?: string;
}

export interface IRelicEffect {
    type: string;
    value?: number;
    [key: string]: string | number | boolean | undefined;
}

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'cursed';

export interface IRelicConfig {
    id: string;
    name: string;
    description: string;
    rarity: RelicRarity;
    effect: IRelicEffect;
    isCursed?: boolean;
    iconKey?: string;
    cost?: number;
}

export interface IRunState {
    currentStageIndex: number;
    currentNodeId: string;
    completedNodeIds: string[];
    fortressHp: number;
    fortressMaxHp: number;
    gold: number;
    deck: ICard[];
    relics: string[];
    curses: string[];
    commanderRoster: string[];
}
