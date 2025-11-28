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

/**
 * Fortress grid configuration loaded from CSV files.
 * Designers create a metadata CSV and a 2D tilemap CSV which get parsed into this structure.
 */
export interface IFortressGridConfig {
    fortressId: string;
    factionId: string;
    name: string;
    imageKey: string;
    maxHp: number;
    cellSizeWidth: number;
    cellSizeHeight: number;
    gridWidth: number;
    gridHeight: number;
    cells: IFortressCell[];
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

export enum RelicTrigger {
    ON_BATTLE_START = 'on_battle_start',
    ON_WAVE_START = 'on_wave_start',
    ON_WAVE_END = 'on_wave_end',
    ON_UNIT_SPAWN = 'on_unit_spawn',
    ON_UNIT_DEATH = 'on_unit_death',
    ON_DAMAGE_DEALT = 'on_damage_dealt',
    ON_DAMAGE_TAKEN = 'on_damage_taken',
    ON_CARD_DRAW = 'on_card_draw',
    ON_CARD_PLAY = 'on_card_play',
    ON_SHOP_ENTER = 'on_shop_enter',
    ON_REST = 'on_rest',
    ON_RUN_START = 'on_run_start',
    ON_NODE_COMPLETE = 'on_node_complete',
    ON_GOLD_GAIN = 'on_gold_gain',
    PASSIVE = 'passive'
}

export interface IRelicEffect {
    type: string;
    trigger?: RelicTrigger;
    value?: number;
    percentValue?: number;
    targetStat?: string;
    condition?: string;
    cost?: string;
    [key: string]: string | number | boolean | undefined;
}

export interface IRelicContext {
    amount?: number;
    unitId?: string;
    cardId?: string;
    nodeType?: NodeType;
    team?: number;
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
    /**
     * Set of card template ids (e.g. 'card_soldier_1', 'card_overclock') that
     * the player has acquired during this run from rewards/shops/events.
     * These cards appear in DeckBuilding \"Available Cards\" but are not
     * automatically included in the active deck.
     */
    cardCollection: string[];
    relics: string[];
    curses: string[];
    commanderRoster: string[];
    factionId: string;
}

// Faction configuration
export interface IFactionConfig {
    id: string;
    name: string;
    resourceType: ResourceType;
    fortressId: string;
    startingCommanderId: string;
    emblemKey: string;
    description?: string;
}

// Extended commander config with starter flag
export interface ICommanderFullConfig extends ICommanderConfig {
    isStarter: boolean;
    cardIds: string[];
}

// Meta progression - persists across runs
export interface IMetaProgression {
    unlockedCommanderIds: string[];
    unlockedRelicIds: string[];
    totalRunsCompleted: number;
    highestStageReached: number;
}

// Save data structure
export interface ISaveData {
    version: string;
    runState: IRunState | null;
    metaProgression: IMetaProgression;
    timestamp: number;
}
