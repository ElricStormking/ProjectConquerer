import Phaser from 'phaser';
import { DataManager } from './DataManager';
import { IFactionConfig, IFortressConfig, IFortressCell, IFortressGridConfig, ResourceType } from '../types/ironwars';

// Default fortress grid builder
function buildDefaultFortressCells(width: number, height: number): IFortressCell[] {
    const cells: IFortressCell[] = [];
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const isCore = x === centerX && y === centerY;
            const isCorner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
            cells.push({
                x,
                y,
                type: isCore ? 'core' : isCorner ? 'blocked' : 'buildable',
                enhancementLevel: 0
            });
        }
    }
    return cells;
}

// Fortress templates for each faction
const FORTRESS_TEMPLATES: Record<string, Omit<IFortressConfig, 'cells'>> = {
    iron_citadel: {
        id: 'iron_citadel',
        name: 'Iron Citadel',
        factionId: 'cog_dominion',
        gridWidth: 5,
        gridHeight: 5,
        maxHp: 500,
        abilities: ['overclock_generators', 'shield_pulse']
    },
    jade_palace: {
        id: 'jade_palace',
        name: 'Jade Palace',
        factionId: 'jade_dynasty',
        gridWidth: 5,
        gridHeight: 5,
        maxHp: 450,
        abilities: ['chi_barrier', 'inner_peace']
    },
    virel_bastion: {
        id: 'virel_bastion',
        name: 'Virel Bastion',
        factionId: 'republic_virel',
        gridWidth: 6,
        gridHeight: 5,
        maxHp: 550,
        abilities: ['tactical_regroup', 'fortified_position']
    },
    grove_heart: {
        id: 'grove_heart',
        name: 'Grove Heart',
        factionId: 'verdant_covenant',
        gridWidth: 5,
        gridHeight: 6,
        maxHp: 600,
        abilities: ['regeneration', 'root_bind']
    },
    frost_citadel: {
        id: 'frost_citadel',
        name: 'Frost Citadel',
        factionId: 'frost_clan',
        gridWidth: 5,
        gridHeight: 5,
        maxHp: 530,
        abilities: ['frost_armor', 'blizzard']
    },
    war_fortress: {
        id: 'war_fortress',
        name: 'War Fortress',
        factionId: 'bloodfang_warborn',
        gridWidth: 6,
        gridHeight: 4,
        maxHp: 580,
        abilities: ['war_drums', 'blood_rage']
    },
    fortress_triarch_dominion_01: {
        id: 'fortress_triarch_dominion_01',
        name: 'Triarch Bastion',
        factionId: 'triarch_dominion',
        gridWidth: 5,
        gridHeight: 5,
        maxHp: 520,
        abilities: ['triarch_command', 'triarch_resolve']
    }
};

export class FactionRegistry extends Phaser.Events.EventEmitter {
    private static instance: FactionRegistry;
    private readonly dataManager = DataManager.getInstance();

    private constructor() {
        super();
    }

    public static getInstance(): FactionRegistry {
        if (!FactionRegistry.instance) {
            FactionRegistry.instance = new FactionRegistry();
        }
        return FactionRegistry.instance;
    }

    public getAllFactions(): IFactionConfig[] {
        return this.dataManager.getAllFactions();
    }

    public getFaction(factionId: string): IFactionConfig | undefined {
        return this.dataManager.getFaction(factionId);
    }

    public getFortressConfig(fortressId: string): IFortressConfig | undefined {
        // First, try to get fortress grid from DataManager (loaded from CSV)
        const gridConfig = this.dataManager.getFortressGrid(fortressId);
        if (gridConfig) {
            return this.convertGridConfigToFortressConfig(gridConfig);
        }
        
        // Fallback to hardcoded template with procedural cells
        const template = FORTRESS_TEMPLATES[fortressId];
        if (!template) return undefined;
        
        return {
            ...template,
            cells: buildDefaultFortressCells(template.gridWidth, template.gridHeight)
        };
    }

    /**
     * Convert IFortressGridConfig (from CSV) to IFortressConfig (used by FortressSystem)
     */
    private convertGridConfigToFortressConfig(gridConfig: IFortressGridConfig): IFortressConfig {
        // Must deep copy the cells array to prevent one FortressSystem instance's state
        // (like occupancy or enhancement levels) from polluting the cached source of truth.
        const cellsCopy = gridConfig.cells.map(cell => ({ ...cell }));
        
        return {
            id: gridConfig.fortressId,
            name: gridConfig.name,
            factionId: gridConfig.factionId,
            gridWidth: gridConfig.gridWidth,
            gridHeight: gridConfig.gridHeight,
            cells: cellsCopy,
            maxHp: gridConfig.maxHp,
            abilities: [] // Can be extended later via CSV
        };
    }

    /**
     * Get fortress grid config directly (for systems that need the extended info like cell sizes)
     */
    public getFortressGridConfig(fortressId: string): IFortressGridConfig | undefined {
        return this.dataManager.getFortressGrid(fortressId);
    }

    public getFortressForFaction(factionId: string): IFortressConfig | undefined {
        const faction = this.getFaction(factionId);
        if (!faction) return undefined;
        return this.getFortressConfig(faction.fortressId);
    }

    public getResourceType(factionId: string): ResourceType {
        const faction = this.getFaction(factionId);
        return faction?.resourceType ?? ResourceType.GOLD;
    }

    public getFactionColor(factionId: string): number {
        const colors: Record<string, number> = {
            cog_dominion: 0xd4a017,      // Gold/brass
            jade_dynasty: 0x2ecc71,       // Jade green
            republic_virel: 0x3498db,     // Steel blue
            verdant_covenant: 0x27ae60,   // Forest green
            frost_clan: 0x74b9ff,         // Ice blue
            bloodfang_warborn: 0xc0392b,  // Blood red
            triarch_dominion: 0xd6c58b    // Gold-white holy brass
        };
        return colors[factionId] ?? 0x888888;
    }
}

