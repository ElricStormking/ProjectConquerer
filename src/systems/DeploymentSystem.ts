import { UnitManager } from './UnitManager';
import { UnitConfig } from '../entities/Unit';
import { UnitType } from '../data/UnitTypes';

export interface DeploymentSlot {
    size: 'small' | 'normal' | 'large';
    position: { x: number; y: number };
    occupied: boolean;
    unitId?: string;
    section: 'front' | 'middle' | 'back';
}

export interface DeploymentZone {
    team: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    slots: DeploymentSlot[];
}

export class DeploymentSystem {
    private unitManager: UnitManager;
    private deploymentZones: Map<number, DeploymentZone>;
    private deploymentQueue: Map<number, UnitConfig[]>;
    
    constructor(unitManager: UnitManager) {
        this.unitManager = unitManager;
        this.deploymentZones = new Map();
        this.deploymentQueue = new Map();
    }
    
    public createDeploymentZone(team: number, centerX: number, centerY: number, width: number, height: number): void {
        const slots: DeploymentSlot[] = [];
        // Grid for three column sections (front/middle/back)
        const rows = 8; // increase vertical capacity so back column can fit mages/support (>= 8 slots)
        const cols = 6;
        const slotWidth = width / cols;
        const slotHeight = height / rows;
        const frontCols = 3; // higher demand for melee
        const middleCols = 2; // ranged
        const backCols = 1;   // mage/support
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = centerX - width/2 + col * slotWidth + slotWidth/2;
                const y = centerY - height/2 + row * slotHeight + slotHeight/2;
                
                let size: 'small' | 'normal' | 'large' = 'normal';
                if (row === 0) size = 'large';
                else if (row === rows - 1 || row === rows - 2) size = 'small';

                // Determine section based on team orientation and column index
                // Team 1 zone is on the left; "front" is toward the enemy (higher x => larger col)
                // Team 2 zone is on the right; "front" is toward the enemy (lower x => smaller col)
                let section: 'front' | 'middle' | 'back' = 'middle';
                if (team === 1) {
                    // left->right: back | middle | front
                    if (col < backCols) section = 'back';
                    else if (col < backCols + middleCols) section = 'middle';
                    else section = 'front';
                } else {
                    // left->right: front | middle | back
                    if (col < frontCols) section = 'front';
                    else if (col < frontCols + middleCols) section = 'middle';
                    else section = 'back';
                }
                
                slots.push({
                    size,
                    position: { x, y },
                    occupied: false,
                    section
                });
            }
        }
        
        this.deploymentZones.set(team, {
            team,
            centerX,
            centerY,
            width,
            height,
            slots
        });
        
        this.deploymentQueue.set(team, []);
    }
    
    public queueUnit(team: number, unitConfig: UnitConfig): boolean {
        const queue = this.deploymentQueue.get(team);
        if (!queue) return false;
        
        const zone = this.deploymentZones.get(team);
        if (!zone) return false;
        
        // Quick capacity check; actual slot choice happens during deploy respecting sections
        const availableSlot = this.findAvailableSlot(zone, unitConfig.size);
        if (!availableSlot) return false;
        
        queue.push(unitConfig);
        return true;
    }
    
    private findAvailableSlot(zone: DeploymentZone, unitSize: 'small' | 'normal' | 'large', preferredSection?: 'front' | 'middle' | 'back'): DeploymentSlot | null {
        // Prefer section if provided
        if (preferredSection) {
            for (const slot of zone.slots) {
                if (!slot.occupied && slot.section === preferredSection && this.canFitUnit(slot, unitSize)) {
                    return slot;
                }
            }
        }
        // Fallback to any available slot
        for (const slot of zone.slots) {
            if (!slot.occupied && this.canFitUnit(slot, unitSize)) {
                return slot;
            }
        }
        
        return null;
    }
    
    
    private canFitUnit(slot: DeploymentSlot, unitSize: 'small' | 'normal' | 'large'): boolean {
        const slotValue = { small: 1, normal: 2, large: 4 };
        const unitValue = { small: 1, normal: 2, large: 4 };
        return slotValue[slot.size] >= unitValue[unitSize];
    }
    
    public deployUnits(team: number): void {
        const queue = this.deploymentQueue.get(team);
        const zone = this.deploymentZones.get(team);
        
        if (!queue || !zone) return;
        
        while (queue.length > 0) {
            const unitConfig = queue[0];
            const preferredSection = this.getPreferredSection(unitConfig.unitType);
            const slot = this.findAvailableSlot(zone, unitConfig.size, preferredSection);
            
            if (!slot) break;
            
            unitConfig.x = slot.position.x;
            unitConfig.y = slot.position.y;
            
            const unit = this.unitManager.spawnUnit(unitConfig);
            if (unit) {
                slot.occupied = true;
                slot.unitId = unit.getId();
                queue.shift();
            } else {
                break;
            }
        }
    }

    private getPreferredSection(unitType: UnitType): 'front' | 'middle' | 'back' {
        switch (unitType) {
            case UnitType.WARRIOR:
            case UnitType.NINJA:
                return 'front';
            case UnitType.SNIPER:
            case UnitType.SHOTGUNNER:
                return 'middle';
            case UnitType.DARK_MAGE:
            case UnitType.CHRONOTEMPORAL:
                return 'back';
            default:
                return 'middle';
        }
    }
    
    public clearSlot(team: number, unitId: string): void {
        const zone = this.deploymentZones.get(team);
        if (!zone) return;
        
        const slot = zone.slots.find(s => s.unitId === unitId);
        if (slot) {
            slot.occupied = false;
            slot.unitId = undefined;
        }
    }
    
    public getDeploymentZone(team: number): DeploymentZone | undefined {
        return this.deploymentZones.get(team);
    }
}