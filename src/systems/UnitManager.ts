import Phaser from 'phaser';
import { PhysicsManager } from './PhysicsManager';
import { Unit, UnitConfig } from '../entities/Unit';
import { UnitType, UnitFactory } from '../data/UnitTypes';

export class UnitManager {
    private scene: Phaser.Scene;
    private physicsManager: PhysicsManager;
    private units: Map<string, Unit>;
    private unitIdCounter: number;
    
    constructor(scene: Phaser.Scene, physicsManager: PhysicsManager) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.units = new Map();
        this.unitIdCounter = 0;
    }
    
    public createUnitConfig(type: UnitType, team: number, x: number, y: number, starRank: number = 1): UnitConfig {
        return UnitFactory.createUnit(type, team, x, y, starRank);
    }

    public spawnUnit(config: UnitConfig): Unit | null {
        const unitCount = this.units.size;
        if (unitCount >= 160) {
            console.warn('Maximum unit limit reached');
            return null;
        }
        
        const unitId = `unit_${this.unitIdCounter++}`;
        const unit = new Unit(this.scene, unitId, config, this.physicsManager);
        
        this.units.set(unitId, unit);
        this.scene.events.emit('unit-spawned', unit);
        return unit;
    }
    
    public removeUnit(unitId: string): void {
        const unit = this.units.get(unitId);
        if (unit) {
            unit.destroy();
            this.units.delete(unitId);
        }
    }
    
    public getUnit(unitId: string): Unit | undefined {
        return this.units.get(unitId);
    }
    
    public getAllUnits(): Unit[] {
        return Array.from(this.units.values());
    }
    
    public getUnitCount(): number {
        return this.units.size;
    }
    
    public getUnitsInRadius(position: { x: number; y: number }, radius: number): Unit[] {
        const unitsInRadius: Unit[] = [];
        
        this.units.forEach(unit => {
            const distance = Phaser.Math.Distance.Between(
                position.x, position.y,
                unit.getPosition().x, unit.getPosition().y
            );
            
            if (distance <= radius) {
                unitsInRadius.push(unit);
            }
        });
        
        return unitsInRadius;
    }
    
    public getUnitsByTeam(team: number): Unit[] {
        return Array.from(this.units.values()).filter(unit => unit.getTeam() === team);
    }
    
    public update(deltaTime: number): void {
        const cameraView = this.scene.cameras.main.worldView;
        
        this.units.forEach(unit => {
            const pos = unit.getPosition();
            const isVisible = cameraView.contains(pos.x, pos.y);
            
            if (isVisible) {
                unit.update(deltaTime);
            } else {
                unit.update(deltaTime * 0.25);
            }
            
            if (unit.isDead() && unit.getDeathTimer() > 3) {
                this.removeUnit(unit.getId());
            }
        });
    }
}