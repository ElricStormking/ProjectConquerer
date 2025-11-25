import Papa from 'papaparse';
import { UnitType, UnitTemplate } from '../data/UnitTypes';
import { SkillType, Skill, SkillEffect } from '../data/Skills';
import {
    CardType,
    ResourceType,
    ICard,
    IWaveConfig,
    IEnemySpawn,
    EnemyLane,
    NodeType,
    IMapNode,
    IStageConfig,
    IEventConfig,
    IEventOption,
    IRelicConfig,
    IRelicEffect
} from '../types/ironwars';

export class DataManager {
    private static instance: DataManager;
    
    private units: Map<string, UnitTemplate> = new Map();
    private cards: Map<string, ICard> = new Map();
    private waves: Map<number, IWaveConfig> = new Map();
    private skills: Map<string, Omit<Skill, 'currentRank'>> = new Map();
    
    // Placeholders for future data
    private buildings: Map<string, any> = new Map();
    private stagesById: Map<string, IStageConfig> = new Map();
    private stagesByIndex: Map<number, IStageConfig> = new Map();
    private events: Map<string, IEventConfig> = new Map();
    private relics: Map<string, IRelicConfig> = new Map();
    private mapNodes: Map<string, IMapNode> = new Map();

    private constructor() {}

    public static getInstance(): DataManager {
        if (!DataManager.instance) {
            DataManager.instance = new DataManager();
        }
        return DataManager.instance;
    }

    public parse(cache: Phaser.Cache.CacheManager): void {
        this.parseUnits(cache.text.get('units_data'));
        this.parseCards(cache.text.get('cards_data'));
        this.parseWaves(cache.text.get('waves_data'));
        this.parseSkills(cache.text.get('skills_data'));
        
        // Optional future data
        if (cache.text.exists('buildings_data')) this.parseBuildings(cache.text.get('buildings_data'));
        if (cache.text.exists('stages_data')) this.parseStages(cache.text.get('stages_data'));
        if (cache.text.exists('relics_data')) this.parseRelics(cache.text.get('relics_data'));
        if (cache.text.exists('events_data')) this.parseEvents(cache.text.get('events_data'));
        if (cache.text.exists('map_nodes_data')) this.parseMapNodes(cache.text.get('map_nodes_data'));
        
        console.log('DataManager: Parsing complete.');
        console.log(`Loaded ${this.units.size} units, ${this.cards.size} cards, ${this.waves.size} waves, ${this.skills.size} skills.`);
    }

    private parseUnits(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        
        result.data.forEach((row: any) => {
            const template: UnitTemplate = {
                type: row.id as UnitType, // Casting to UnitType, assuming CSV IDs match enum
                name: row.name,
                description: row.description,
                unitClass: row.role, // 'frontline' | 'ranged' | 'support' | 'siege' | 'summoner'
                size: row.size, // 'small' | 'normal' | 'large'
                rarity: row.rarity,
                baseStats: {
                    maxHealth: row.max_hp,
                    damage: row.damage,
                    armor: row.armor,
                    moveSpeed: row.move_speed,
                    attackSpeed: row.attack_speed,
                    range: row.range,
                    mass: row.mass
                }
            };
            this.units.set(row.id, template);
        });
    }

    private parseCards(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        
        result.data.forEach((row: any) => {
            const card: ICard = {
                id: row.id,
                name: row.name,
                type: row.type as CardType,
                cost: row.cost,
                resourceType: row.resource_type as ResourceType,
                portraitKey: row.portrait_key,
                description: row.description,
                rarity: row.rarity
            };

            if (card.type === CardType.UNIT) card.unitId = row.target_id;
            else if (card.type === CardType.SPELL) card.spellEffectId = row.target_id;
            else if (card.type === CardType.STRUCTURE) card.structureId = row.target_id;
            else if (card.type === CardType.MODULE) card.moduleId = row.target_id;

            this.cards.set(card.id, card);
        });
    }

    private parseWaves(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        
        // Group by wave_index (or wave_id)
        const waveMap = new Map<number, IWaveConfig>();

        result.data.forEach((row: any) => {
            const waveIndex = row.wave_index;
            
            if (!waveMap.has(waveIndex)) {
                waveMap.set(waveIndex, {
                    id: row.wave_id,
                    index: waveIndex,
                    spawns: []
                });
            }

            const wave = waveMap.get(waveIndex)!;
            const spawn: IEnemySpawn = {
                unitId: row.spawn_unit_id,
                count: row.count,
                spawnTime: row.spawn_time,
                lane: row.lane as EnemyLane
            };
            wave.spawns.push(spawn);
        });

        this.waves = waveMap;
    }

    private parseSkills(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        
        result.data.forEach((row: any) => {
            let effects: SkillEffect[] = [];
            try {
                effects = JSON.parse(row.effects_json);
            } catch (e) {
                console.error(`Failed to parse effects_json for skill ${row.id}`, e);
            }

            const skill: Omit<Skill, 'currentRank'> = {
                type: row.id as SkillType,
                name: row.name,
                description: row.description,
                maxRank: row.max_rank,
                icon: row.icon,
                rarity: row.rarity,
                effects: effects
            };
            this.skills.set(row.id, skill);
        });
    }
    
    private parseBuildings(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        result.data.forEach((row: any) => {
            this.buildings.set(row.id, row);
        });
    }

    private parseStages(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        result.data.forEach((row: any) => {
            const stage: IStageConfig = {
                id: row.id,
                index: Number(row.index ?? this.stagesByIndex.size),
                name: row.name,
                theme: row.theme,
                musicKey: row.music_key,
                nodes: [],
                backgroundKey: row.background_key,
                bossNodeId: row.boss_node_id,
                nextStageId: row.next_stage_id || undefined
            };

            this.stagesById.set(stage.id, stage);
            this.stagesByIndex.set(stage.index, stage);
        });
    }

    private parseRelics(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        result.data.forEach((row: any) => {
            let effect: IRelicEffect = { type: 'custom' };
            if (row.effect_json) {
                try {
                    effect = JSON.parse(row.effect_json);
                } catch (e) {
                    console.error(`Failed to parse effect_json for relic ${row.id}`, e);
                }
            } else if (row.effect_id) {
                effect = { type: row.effect_id };
            }

            const relic: IRelicConfig = {
                id: row.id,
                name: row.name,
                description: row.description,
                rarity: row.rarity,
                effect: effect,
                isCursed: row.is_cursed === true || row.is_cursed === 'true' || row.rarity === 'cursed',
                iconKey: row.icon_key,
                cost: typeof row.cost === 'number' ? row.cost : Number(row.cost) || 0
            };

            this.relics.set(relic.id, relic);
        });
    }

    private parseEvents(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        result.data.forEach((row: any) => {
            let options: IEventOption[] = [];
            if (row.options_json) {
                try {
                    options = JSON.parse(row.options_json) as IEventOption[];
                } catch (e) {
                    console.error(`Failed to parse options_json for event ${row.id}`, e);
                }
            }

            const eventConfig: IEventConfig = {
                id: row.id,
                name: row.name,
                description: row.description,
                options,
                iconKey: row.icon_key
            };

            this.events.set(eventConfig.id, eventConfig);
        });
    }

    private parseMapNodes(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        result.data.forEach((row: any) => {
            const edgesField = row.next_node_ids_json || row.next_nodes_json || '[]';
            let nextNodeIds: string[] = [];
            if (edgesField) {
                try {
                    nextNodeIds = JSON.parse(edgesField);
                } catch (e) {
                    console.error(`Failed to parse next_node_ids_json for node ${row.id}`, e);
                }
            }

            const node: IMapNode = {
                id: row.id,
                type: (row.type as NodeType) || NodeType.BATTLE,
                stageIndex: Number(row.stage_index ?? 0),
                tier: Number(row.tier ?? 1),
                encounterId: row.encounter_id || undefined,
                nextNodeIds,
                posX: Number(row.pos_x ?? 0),
                posY: Number(row.pos_y ?? 0),
                iconKey: row.icon_key || 'node_battle',
                rewardTier: Number(row.reward_tier ?? row.tier ?? 1),
                isCompleted: false,
                isAccessible: false
            };

            this.mapNodes.set(node.id, node);

            let stage = this.stagesByIndex.get(node.stageIndex);
            if (!stage) {
                stage = {
                    id: `stage_${node.stageIndex}`,
                    index: node.stageIndex,
                    name: `Stage ${node.stageIndex + 1}`,
                    nodes: [],
                    backgroundKey: row.background_key || 'stage_default',
                    bossNodeId: node.type === NodeType.BOSS ? node.id : '',
                    theme: row.theme,
                    musicKey: row.music_key,
                    nextStageId: undefined
                };
                this.stagesByIndex.set(stage.index, stage);
                this.stagesById.set(stage.id, stage);
            }
            stage.nodes.push(node);
        });
    }

    // Accessors
    public getUnitTemplate(id: string): UnitTemplate | undefined {
        return this.units.get(id);
    }

    public getAllUnitTemplates(): UnitTemplate[] {
        return Array.from(this.units.values());
    }

    public getCard(id: string): ICard | undefined {
        return this.cards.get(id);
    }
    
    public getAllCards(): ICard[] {
        return Array.from(this.cards.values());
    }

    public getWave(index: number): IWaveConfig | undefined {
        return this.waves.get(index);
    }
    
    public getAllWaves(): IWaveConfig[] {
        return Array.from(this.waves.values()).sort((a, b) => a.index - b.index);
    }

    public getSkillTemplate(id: string): Omit<Skill, 'currentRank'> | undefined {
        return this.skills.get(id);
    }

    public getStageByIndex(index: number): IStageConfig | undefined {
        return this.stagesByIndex.get(index);
    }

    public getStageById(id: string): IStageConfig | undefined {
        return this.stagesById.get(id);
    }

    public getAllStages(): IStageConfig[] {
        return Array.from(this.stagesByIndex.values()).sort((a, b) => a.index - b.index);
    }

    public getMapNode(id: string): IMapNode | undefined {
        return this.mapNodes.get(id);
    }

    public getNodesForStage(stageIndex: number): IMapNode[] {
        const stage = this.stagesByIndex.get(stageIndex);
        return stage ? stage.nodes : [];
    }

    public getEventConfig(id: string): IEventConfig | undefined {
        return this.events.get(id);
    }

    public getAllEvents(): IEventConfig[] {
        return Array.from(this.events.values());
    }

    public getRelicConfig(id: string): IRelicConfig | undefined {
        return this.relics.get(id);
    }

    public getAllRelics(): IRelicConfig[] {
        return Array.from(this.relics.values());
    }
}
