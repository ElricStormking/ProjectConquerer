import Phaser from 'phaser';
import { UnitManager } from './UnitManager';
import { Unit } from '../entities/Unit';

export enum DamageType {
    PHYSICAL = 'physical',
    EXPLOSIVE = 'explosive',
    MAGIC = 'magic'
}

export enum StatusEffect {
    SUPPRESSED = 'suppressed',
    SNARED = 'snared',
    GREASED = 'greased',
    BURNING = 'burning',
    DAZED = 'dazed',
    STUNNED = 'stunned',
    SLOWED = 'slowed',
    DOT = 'dot',
    HOT = 'hot'
}

export interface DamageEvent {
    attacker: Unit;
    target: Unit;
    damage: number;
    type: DamageType;
    isCritical: boolean;
    armorFacing: 'front' | 'side' | 'rear';
}

export class CombatSystem {
    private scene: Phaser.Scene;
    private unitManager: UnitManager;
    private damageNumbers: Phaser.GameObjects.Group;
    
    constructor(scene: Phaser.Scene, unitManager: UnitManager) {
        this.scene = scene;
        this.unitManager = unitManager;
        this.damageNumbers = scene.add.group();
    }
    
    public dealDamage(
        attacker: Unit, 
        target: Unit, 
        baseDamage: number, 
        type: DamageType = DamageType.PHYSICAL
    ): void {
        if (target.isDead()) return;
        
        const armorFacing = this.calculateArmorFacing(attacker, target);
        const armorModifier = this.getArmorModifier(armorFacing);
        const criticalRoll = Math.random();
        const isCritical = criticalRoll < attacker.getCritChance();
        
        let finalDamage = baseDamage * armorModifier;
        if (isCritical) {
            finalDamage *= attacker.getCritMultiplier();
        }
        
        finalDamage = Math.max(1, Math.round(finalDamage - target.getArmor()));
        
        target.takeDamage(finalDamage);
        
        this.createDamageNumber(target.getPosition(), finalDamage, isCritical);
        
        const damageImpulse = this.calculateDamageImpulse(attacker, target, finalDamage);
        target.applyImpulse(damageImpulse);
        
        this.scene.events.emit('damage-dealt', {
            attacker,
            target,
            damage: finalDamage,
            type,
            isCritical,
            armorFacing
        } as DamageEvent);
    }
    
    private calculateArmorFacing(attacker: Unit, target: Unit): 'front' | 'side' | 'rear' {
        const attackerPos = attacker.getPosition();
        const targetPos = target.getPosition();
        const targetFacing = target.getFacing();
        
        const angleToAttacker = Math.atan2(
            attackerPos.y - targetPos.y,
            attackerPos.x - targetPos.x
        );
        
        let angleDiff = angleToAttacker - targetFacing;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const absAngle = Math.abs(angleDiff);
        
        if (absAngle < Math.PI / 4) {
            return 'front';
        } else if (absAngle > 3 * Math.PI / 4) {
            return 'rear';
        } else {
            return 'side';
        }
    }
    
    private getArmorModifier(facing: 'front' | 'side' | 'rear'): number {
        switch (facing) {
            case 'front': return 0.7;
            case 'side': return 1.0;
            case 'rear': return 1.5;
        }
    }
    
    private calculateDamageImpulse(
        attacker: Unit, 
        target: Unit, 
        damage: number
    ): { x: number; y: number } {
        const attackerPos = attacker.getPosition();
        const targetPos = target.getPosition();
        
        const angle = Math.atan2(
            targetPos.y - attackerPos.y,
            targetPos.x - attackerPos.x
        );
        
        // Softer knockback: scale force down so units don't fly unrealistically far
        const baseForce = damage * 0.05; // was 0.5 – 10x weaker
        const massRatio = attacker.getMass() / target.getMass();
        const finalForce = baseForce * Math.min(1, massRatio); // cap ratio at 1
        
        return {
            x: Math.cos(angle) * finalForce,
            y: Math.sin(angle) * finalForce
        };
    }
    
    public applyStatusEffect(target: Unit, effect: StatusEffect, duration: number): void {
        target.addStatusEffect(effect, duration);
        
        switch (effect) {
            case StatusEffect.SUPPRESSED:
                target.setAttackSpeedMultiplier(0.5);
                break;
            case StatusEffect.SNARED:
                target.setMoveSpeedMultiplier(0.3);
                break;
            case StatusEffect.GREASED:
                target.setFriction(0.01);
                break;
            case StatusEffect.BURNING:
                this.startBurningEffect(target);
                break;
            case StatusEffect.DAZED:
                target.setAccuracy(0.2);
                break;
            case StatusEffect.STUNNED:
                target.setStunned(true);
                break;
            case StatusEffect.SLOWED:
                target.setMoveSpeedMultiplier(0.6);
                break;
            case StatusEffect.DOT:
            case StatusEffect.HOT:
                // DOT/HOT are handled by target's status tick; no immediate action here.
                break;
        }
    }
    
    private startBurningEffect(target: Unit): void {
        const burnEvent = this.scene.time.addEvent({
            delay: 500,
            repeat: 5,
            callback: () => {
                if (!target.isDead()) {
                    target.takeDamage(5);
                    this.createDamageNumber(target.getPosition(), 5, false, 0xffaa00);
                }
            }
        });
        
        target.on('death', () => burnEvent.destroy());
    }
    
    private createDamageNumber(
        position: { x: number; y: number }, 
        damage: number, 
        isCritical: boolean,
        color: number = 0xffffff
    ): void {
        const text = this.scene.add.text(
            position.x, 
            position.y - 20,
            damage.toString(),
            {
                font: isCritical ? 'bold 24px sans-serif' : '18px sans-serif',
                color: `#${color.toString(16).padStart(6, '0')}`
            }
        );
        
        this.damageNumbers.add(text);
        
        this.scene.tweens.add({
            targets: text,
            y: position.y - 60,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                this.damageNumbers.remove(text);
                text.destroy();
            }
        });
    }
    
    public update(_deltaTime: number): void {
        const units = this.unitManager.getAllUnits();
        
        units.forEach(unit => {
            unit.updateStatusEffects(_deltaTime);
        });
    }
}