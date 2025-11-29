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
    IRelicEffect,
    IFactionConfig,
    ICommanderFullConfig,
    IFortressGridConfig,
    IFortressCell,
    FortressCellType
} from '../types/ironwars';

export class DataManager {
    private static instance: DataManager;
    
    private units: Map<string, UnitTemplate> = new Map();
    private cards: Map<string, ICard> = new Map();
    // Waves grouped by encounter_id, then by wave index
    private wavesByEncounter: Map<string, Map<number, IWaveConfig>> = new Map();
    private skills: Map<string, Omit<Skill, 'currentRank'>> = new Map();
    
    // Placeholders for future data
    private buildings: Map<string, any> = new Map();
    private stagesById: Map<string, IStageConfig> = new Map();
    private stagesByIndex: Map<number, IStageConfig> = new Map();
    private events: Map<string, IEventConfig> = new Map();
    private relics: Map<string, IRelicConfig> = new Map();
    private mapNodes: Map<string, IMapNode> = new Map();
    
    // Faction and commander data
    private factions: Map<string, IFactionConfig> = new Map();
    private commanders: Map<string, ICommanderFullConfig> = new Map();
    
    // Fortress grid data
    private fortressGrids: Map<string, IFortressGridConfig> = new Map();

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
        
        // Faction and commander data
        if (cache.text.exists('factions_data')) this.parseFactions(cache.text.get('factions_data'));
        if (cache.text.exists('commanders_data')) this.parseCommanders(cache.text.get('commanders_data'));
        
        // Fortress grid data - load all fortress grids
        this.parseFortressGridsFromCache(cache);
        
        console.log('DataManager: Parsing complete.');
        const totalWaves = Array.from(this.wavesByEncounter.values()).reduce((sum, m) => sum + m.size, 0);
        console.log(`Loaded ${this.units.size} units, ${this.cards.size} cards, ${totalWaves} waves (${this.wavesByEncounter.size} encounters), ${this.skills.size} skills, ${this.factions.size} factions, ${this.commanders.size} commanders, ${this.fortressGrids.size} fortress grids.`);
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
        
        // Group by encounter_id, then by wave_index
        this.wavesByEncounter.clear();

        result.data.forEach((row: any) => {
            const encounterId = row.encounter_id || 'default';
            const waveIndex = row.wave_index;
            
            if (!this.wavesByEncounter.has(encounterId)) {
                this.wavesByEncounter.set(encounterId, new Map());
            }
            
            const encounterWaves = this.wavesByEncounter.get(encounterId)!;
            
            if (!encounterWaves.has(waveIndex)) {
                encounterWaves.set(waveIndex, {
                    id: row.wave_id,
                    encounterId: encounterId,
                    index: waveIndex,
                    spawns: []
                });
            }

            const wave = encounterWaves.get(waveIndex)!;
            const spawn: IEnemySpawn = {
                unitId: row.spawn_unit_id,
                count: row.count,
                spawnTime: row.spawn_time,
                lane: row.lane as EnemyLane
            };
            wave.spawns.push(spawn);
        });
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

    private parseFactions(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        
        result.data.forEach((row: any) => {
            const faction: IFactionConfig = {
                id: row.id,
                name: row.name,
                resourceType: row.resource_type as ResourceType,
                fortressId: row.fortress_id,
                startingCommanderId: row.starting_commander_id,
                emblemKey: row.emblem_key,
                description: row.description || ''
            };
            this.factions.set(faction.id, faction);
        });
    }

    private parseCommanders(csv: string): void {
        if (!csv) return;
        const result = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        
        result.data.forEach((row: any) => {
            const cardIds = row.card_ids ? String(row.card_ids).split('|').filter(Boolean) : [];
            
            const commander: ICommanderFullConfig = {
                id: row.id,
                name: row.name,
                factionId: row.faction_id,
                passiveId: row.passive_id || '',
                activeSkillId: row.active_skill_id || '',
                cooldown: Number(row.cooldown) || 2000,
                portraitKey: row.portrait_key || row.id,
                isStarter: row.is_starter === true || row.is_starter === 'true',
                cardIds: cardIds
            };
            this.commanders.set(commander.id, commander);
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

    public getWave(encounterId: string, index: number): IWaveConfig | undefined {
        const encounterWaves = this.wavesByEncounter.get(encounterId);
        return encounterWaves?.get(index);
    }
    
    /**
     * Get all waves for a specific encounter (battle/elite/boss node).
     * Falls back to 'default' encounter if the specified one doesn't exist.
     */
    public getWavesForEncounter(encounterId: string): IWaveConfig[] {
        let encounterWaves = this.wavesByEncounter.get(encounterId);
        
        // Fallback to 'default' if encounter not found
        if (!encounterWaves) {
            encounterWaves = this.wavesByEncounter.get('default');
        }
        
        if (!encounterWaves) {
            return [];
        }
        
        return Array.from(encounterWaves.values()).sort((a, b) => a.index - b.index);
    }
    
    /**
     * Get all waves across all encounters (for debugging/legacy support).
     */
    public getAllWaves(): IWaveConfig[] {
        const allWaves: IWaveConfig[] = [];
        this.wavesByEncounter.forEach(encounterWaves => {
            allWaves.push(...encounterWaves.values());
        });
        return allWaves.sort((a, b) => a.index - b.index);
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

    // Faction accessors
    public getFaction(id: string): IFactionConfig | undefined {
        return this.factions.get(id);
    }

    public getAllFactions(): IFactionConfig[] {
        return Array.from(this.factions.values());
    }

    // Commander accessors
    public getCommander(id: string): ICommanderFullConfig | undefined {
        return this.commanders.get(id);
    }

    public getAllCommanders(): ICommanderFullConfig[] {
        return Array.from(this.commanders.values());
    }

    public getCommandersByFaction(factionId: string): ICommanderFullConfig[] {
        return Array.from(this.commanders.values()).filter(c => c.factionId === factionId);
    }

    public getStarterCommander(factionId: string): ICommanderFullConfig | undefined {
        return Array.from(this.commanders.values()).find(
            c => c.factionId === factionId && c.isStarter
        );
    }

    public getCardsForCommander(commanderId: string): ICard[] {
        const commander = this.commanders.get(commanderId);
        if (!commander) return [];
        
        return commander.cardIds
            .map(cardId => this.cards.get(cardId))
            .filter((card): card is ICard => card !== undefined);
    }

    // Fortress grid parsing and accessors
    
    /**
     * Parse fortress grids from cache. Looks for fortress grid files by convention:
     * - fortress_grid_{id}_meta for metadata CSV
     * - fortress_grid_{id}_tilemap for 2D grid CSV
     */
    private parseFortressGridsFromCache(cache: Phaser.Cache.CacheManager): void {
        // Known fortress grid IDs - add more here as they're created
        const fortressIds = ['sanctum_order_01'];
        
        for (const id of fortressIds) {
            const metaKey = `fortress_grid_${id}_meta`;
            const tilemapKey = `fortress_grid_${id}_tilemap`;
            
            if (cache.text.exists(metaKey) && cache.text.exists(tilemapKey)) {
                const metaCsv = cache.text.get(metaKey);
                const tilemapCsv = cache.text.get(tilemapKey);
                this.parseFortressGrid(metaCsv, tilemapCsv);
            }
        }
    }

    /**
     * Parse a single fortress grid from metadata CSV and tilemap CSV.
     * @param metaCsv - CSV with fortress metadata (id, faction_id, name, etc.)
     * @param tilemapCsv - 2D array CSV where 0=blocked, 1=buildable, 2=core
     */
    private parseFortressGrid(metaCsv: string, tilemapCsv: string): void {
        if (!metaCsv || !tilemapCsv) return;
        
        // Parse metadata
        const metaResult = Papa.parse(metaCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        if (metaResult.data.length === 0) return;
        
        const meta = metaResult.data[0] as any;
        
        // Parse tilemap as 2D array (no header)
        const tilemapResult = Papa.parse(tilemapCsv, { header: false, dynamicTyping: true, skipEmptyLines: true });
        const grid = tilemapResult.data as number[][];
        
        if (grid.length === 0) return;
        
        // Convert 2D array to IFortressCell[]
        const cells: IFortressCell[] = [];
        const gridHeight = grid.length;
        const gridWidth = grid[0]?.length ?? 0;
        
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellValue = grid[row][col];
                if (cellValue > 0) {
                    let cellType: FortressCellType = 'buildable';
                    if (cellValue === 2) cellType = 'core';
                    else if (cellValue === 0) cellType = 'blocked';
                    
                    cells.push({
                        x: col,
                        y: row,
                        type: cellType
                    });
                }
            }
        }
        
        const fortressGrid: IFortressGridConfig = {
            fortressId: meta.id,
            factionId: meta.faction_id,
            name: meta.name,
            imageKey: meta.image_key,
            maxHp: Number(meta.max_hp) || 1000,
            cellSizeWidth: Number(meta.cell_size_width) || 64,
            cellSizeHeight: Number(meta.cell_size_height) || 32,
            gridWidth,
            gridHeight,
            cells
        };
        
        this.fortressGrids.set(fortressGrid.fortressId, fortressGrid);
        console.log(`[DataManager] Loaded fortress grid: ${fortressGrid.fortressId} (${gridWidth}x${gridHeight}, ${cells.length} cells)`);
    }

    /**
     * Get a fortress grid configuration by fortress ID.
     */
    public getFortressGrid(fortressId: string): IFortressGridConfig | undefined {
        return this.fortressGrids.get(fortressId);
    }

    /**
     * Get all loaded fortress grids.
     */
    public getAllFortressGrids(): IFortressGridConfig[] {
        return Array.from(this.fortressGrids.values());
    }
}
