import { UnitManager } from './UnitManager';
import { UnitConfig } from '../entities/Unit';

export interface DeploymentSlot {
    size: 'small' | 'normal' | 'large';
    position: { x: number; y: number };
    occupied: boolean;
    unitId?: string;
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
        const rows = 4;
        const cols = 6;
        const slotWidth = width / cols;
        const slotHeight = height / rows;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = centerX - width/2 + col * slotWidth + slotWidth/2;
                const y = centerY - height/2 + row * slotHeight + slotHeight/2;
                
                let size: 'small' | 'normal' | 'large' = 'normal';
                if (row === 0) size = 'large';
                else if (row === rows - 1) size = 'small';
                
                slots.push({
                    size,
                    position: { x, y },
                    occupied: false
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
        
        const availableSlot = this.findAvailableSlot(zone, unitConfig.size);
        if (!availableSlot) return false;
        
        queue.push(unitConfig);
        return true;
    }
    
    private findAvailableSlot(zone: DeploymentZone, unitSize: 'small' | 'normal' | 'large'): DeploymentSlot | null {
        const slotsNeeded = this.getSlotsNeeded(unitSize);
        
        for (const slot of zone.slots) {
            if (!slot.occupied && this.canFitUnit(slot, unitSize)) {
                return slot;
            }
        }
        
        return null;
    }
    
    private getSlotsNeeded(unitSize: 'small' | 'normal' | 'large'): number {
        switch (unitSize) {
            case 'small': return 1;
            case 'normal': return 2;
            case 'large': return 4;
        }
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
            const slot = this.findAvailableSlot(zone, unitConfig.size);
            
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