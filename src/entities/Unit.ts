import Phaser from 'phaser';
import { PhysicsManager } from '../systems/PhysicsManager';
import { StatusEffect } from '../systems/CombatSystem';
import type { UnitManager } from '../systems/UnitManager';
import type { CombatSystem } from '../systems/CombatSystem';
import { UnitType, UNIT_TEMPLATES } from '../data/UnitTypes';
import { RelicManager } from '../systems/RelicManager';
import { GameStateManager } from '../systems/GameStateManager';
import { IRelicContext, NodeType } from '../types/ironwars';

export interface UnitConfig {
    x: number;
    y: number;
    team: number;
    unitType: UnitType;
    type: 'frontline' | 'ranged' | 'support' | 'siege' | 'summoner';
    size: 'small' | 'normal' | 'large';
    stats: {
        maxHealth: number;
        damage: number;
        armor: number;
        moveSpeed: number;
        attackSpeed: number;
        range: number;
        mass: number;
    };
}

export class Unit extends Phaser.Events.EventEmitter {
    private scene: Phaser.Scene;
    private id: string;
    private config: UnitConfig;
    private physicsManager: PhysicsManager;
    private body!: MatterJS.BodyType;
    private sprite!: Phaser.GameObjects.Sprite;
    private healthBar!: Phaser.GameObjects.Graphics;
    private healthBarBg!: Phaser.GameObjects.Graphics;
    private teamFlag!: Phaser.GameObjects.Graphics;
    private classLabel!: Phaser.GameObjects.Text;
    private trailPoints: Array<{x: number, y: number, alpha: number}> = [];
    private trailGraphics!: Phaser.GameObjects.Graphics;
    private attackSwingGraphics!: Phaser.GameObjects.Graphics;
    private isAttacking: boolean = false;
    private lastMeleeAttackTime: number = 0;
    private lastJumpTime: number = 0;
    
    private health: number;
    private maxHealth: number;
    private team: number;
    private facing: number = 0;
    private dead: boolean = false;
    private deathTimer: number = 0;
    
    private damage: number;
    private armor: number;
    private moveSpeed: number;
    private attackSpeed: number;
    private range: number;
    private mass: number;
    
    private critChance: number = 0.1;
    private critMultiplier: number = 2;
    private accuracy: number = 1;
    private moveSpeedMultiplier: number = 1;
    private attackSpeedMultiplier: number = 1;
    private friction: number = 0.2;
    
    private statusEffects: Map<StatusEffect, number> = new Map();
    private lastAttackTime: number = 0;

    // Visual indicator for building-based buffs (Armor Shop / Overclock
    // Stable) shown as a yellow square next to the unit name.
    private buildingBuffActive: boolean = false;
    private buffSquare?: Phaser.GameObjects.Rectangle;
    
    // Animation state
    private lastMoveDirection: 'down' | 'up' | 'left' | 'right' = 'down';
    private idleFrameByDirection: Record<'down' | 'up' | 'left' | 'right', number> = {
        down: 0,
        up: 0,
        left: 0,
        right: 0
    };
    
    constructor(scene: Phaser.Scene, id: string, config: UnitConfig, physicsManager: PhysicsManager) {
        super();
        
        this.scene = scene;
        this.id = id;
        this.config = config;
        this.physicsManager = physicsManager;
        this.team = config.team;
        
        const stats = config.stats;
        this.maxHealth = stats.maxHealth;
        this.health = this.maxHealth;
        this.damage = stats.damage;
        this.armor = stats.armor;
        this.moveSpeed = stats.moveSpeed;
        this.attackSpeed = stats.attackSpeed;
        this.range = stats.range;
        this.mass = stats.mass;
        
        this.createPhysicsBody();
        this.createSprite();
        this.createTrailGraphics();
        this.createAnimations();
    }
    
    private createPhysicsBody(): void {
        const radius = this.getSizeRadius();
        
        this.body = this.physicsManager.createCircleBody(
            this.config.x,
            this.config.y,
            radius,
            {
                label: `unit_${this.id}`,
                mass: this.mass,
                frictionAir: 0.05,
                friction: this.friction,
                restitution: 0.3
            }
        );
        
        (this.body as any).gameObject = this;
    }
    
    private createSprite(): void {
        const spriteKey = this.getSpriteKey();
        
        // Check if the texture exists, if not create a fallback
        if (!this.scene.textures.exists(spriteKey)) {
            console.warn(`Sprite texture '${spriteKey}' not found, creating fallback`);
            this.createFallbackSprite();
            return;
        }
        
        this.sprite = this.scene.add.sprite(this.config.x, this.config.y, spriteKey);
        this.sprite.setData('unit', this);
        
        // Set origin to center-bottom for proper positioning (feet at position)
        this.sprite.setOrigin(0.5, 0.8);
        
        // 96x96 sprites; render at half scale for normal units. Bosses like
        // the Raider Boss are visually scaled up to be three times larger
        // than a normal enemy.
        // Aegis Tank uses 64x64 sprites, so scale up to match visual size
        let scale = 0.5;
        if (this.config.unitType === UnitType.RAIDER_BOSS) {
            scale *= 3;
        } else if (this.config.unitType === UnitType.COG_AEGIS_TANK || this.config.unitType === UnitType.COG_THUNDER_CANNON || this.config.unitType === UnitType.COG_RAILGUNNER) {
            // 64x64 sprites need larger scale to match 96x96 visual size
            scale = 0.75; // 0.5 * (96/64) = 0.75
        }
        this.sprite.setScale(scale);
        
        // Set depth for proper layering
        this.sprite.setDepth(this.config.y);
        
        // Set team color tint (lighter tints to preserve sprite visibility)
        if (this.team === 1) {
            this.sprite.setTint(0xaaccff); // Light blue team tint
        } else {
            this.sprite.setTint(0xffaaaa); // Light red team tint
        }
        
        // Create health bar and team flag
        this.healthBarBg = this.scene.add.graphics();
        this.healthBar = this.scene.add.graphics();
        this.teamFlag = this.scene.add.graphics();
        this.attackSwingGraphics = this.scene.add.graphics();
        // Class label above unit
        const className = UNIT_TEMPLATES[this.config.unitType]?.name ?? this.config.unitType;
        this.classLabel = this.scene.add.text(this.config.x, this.config.y - 110, className, {
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        this.updateHealthBar();
        this.createTeamFlag();
    }
    
    private createFallbackSprite(): void {
        const radius = this.getSizeRadius();
        const color = this.team === 1 ? 0x4444ff : 0xff4444;
        
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillCircle(0, 0, radius);
        graphics.generateTexture(`fallback_${this.id}`, radius * 2, radius * 2);
        graphics.destroy();
        
        this.sprite = this.scene.add.sprite(this.config.x, this.config.y, `fallback_${this.id}`);
        this.sprite.setData('unit', this);
        this.sprite.setOrigin(0.5, 0.5);
        let scale = 0.5;
        if (this.config.unitType === UnitType.RAIDER_BOSS) {
            scale *= 3;
        }
        this.sprite.setScale(scale);
        
        // Create health bar and team flag
        this.healthBarBg = this.scene.add.graphics();
        this.healthBar = this.scene.add.graphics();
        this.teamFlag = this.scene.add.graphics();
        this.attackSwingGraphics = this.scene.add.graphics();
        this.updateHealthBar();
        this.createTeamFlag();
    }
    
    private updateHealthBar(): void {
        const spriteHeight = this.sprite ? this.sprite.displayHeight : 96;
        const barWidth = 50; // Width to match sprite size
        const barHeight = 4;
        const barY = -spriteHeight - 10; // Position above sprite with margin
        
        // Background
        this.healthBarBg.clear();
        this.healthBarBg.fillStyle(0x000000, 0.5);
        this.healthBarBg.fillRect(-barWidth/2, barY, barWidth, barHeight);
        
        // Health fill
        this.healthBar.clear();
        const healthPercent = this.health / this.maxHealth;
        const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffaa00 : 0xff0000;
        this.healthBar.fillStyle(healthColor, 1);
        this.healthBar.fillRect(-barWidth/2, barY, barWidth * healthPercent, barHeight);
    }
    
    private createTeamFlag(): void {
        const spriteHeight = this.sprite ? this.sprite.displayHeight : 96;
        const flagSize = 8;
        const barY = -spriteHeight - 10;
        const flagX = 30; // Position flag to the right of health bar
        const flagY = barY - 2; // Slightly above health bar
        
        this.teamFlag.clear();
        
        // Draw flag pole
        this.teamFlag.lineStyle(1, 0x444444, 1);
        this.teamFlag.lineBetween(flagX, flagY, flagX, flagY + flagSize + 2);
        
        // Draw flag based on team
        const flagColor = this.team === 1 ? 0x4444ff : 0xff4444; // Blue for team 1, red for team 2
        this.teamFlag.fillStyle(flagColor, 1);
        
        // Draw triangular flag shape
        this.teamFlag.beginPath();
        this.teamFlag.moveTo(flagX, flagY);
        this.teamFlag.lineTo(flagX + flagSize, flagY + flagSize/2);
        this.teamFlag.lineTo(flagX, flagY + flagSize);
        this.teamFlag.closePath();
        this.teamFlag.fillPath();
        
        // Add small white border for visibility
        this.teamFlag.lineStyle(1, 0xffffff, 0.8);
        this.teamFlag.strokePath();
    }
    
    private createTrailGraphics(): void {
        this.trailGraphics = this.scene.add.graphics();
        this.trailGraphics.setDepth(this.config.y - 10); // Behind the unit
    }
    
    private updateTrail(): void {
        this.trailGraphics.clear();
        
        if (this.trailPoints.length < 2) return;
        
        // Fade trail points over time
        for (let i = 0; i < this.trailPoints.length; i++) {
            this.trailPoints[i].alpha = (i + 1) / this.trailPoints.length * 0.8;
        }
        
        // Draw trail as connected circles
        const teamColor = this.team === 1 ? 0x4444ff : 0xff4444;
        
        for (let i = 0; i < this.trailPoints.length; i++) {
            const point = this.trailPoints[i];
            const size = (i + 1) / this.trailPoints.length * 3; // Size increases towards unit
            
            this.trailGraphics.fillStyle(teamColor, point.alpha);
            this.trailGraphics.fillCircle(point.x, point.y, size);
        }
    }
    
    private isMeleeUnit(): boolean {
        switch (this.config.unitType) {
            case UnitType.WARRIOR:
            case UnitType.NINJA:
            case UnitType.COG_SOLDIER:
            case UnitType.COG_AEGIS_TANK:
            case UnitType.RAIDER_GRUNT:
                return true;
            default:
                return false;
        }
    }
    
    public performMeleeAttack(targetUnit: any, currentTime: number, unitManager?: UnitManager, combatSystem?: CombatSystem): void {
        if (!this.isMeleeUnit() || this.dead || this.isAttacking) return;
        
        // Check if enough time has passed since last attack (1 second cooldown)
        if (currentTime - this.lastMeleeAttackTime < 1000) return;
        
        this.isAttacking = true;
        this.lastMeleeAttackTime = currentTime;
        
        // Create attack swing visual: always face directly toward the
        // target, regardless of any pushback forces.
        const directionToTarget = Math.atan2(
            targetUnit.getPosition().y - this.getPosition().y,
            targetUnit.getPosition().x - this.getPosition().x
        );
        this.facing = directionToTarget;
        this.createAttackSwing(this.facing);
        
        // Deal damage after short delay (to match visual)
        this.scene.time.delayedCall(200, () => {
            // Area damage in 160-degree sector in front of unit
            if (unitManager && combatSystem) {
                const center = this.getPosition();
                const swingAngle = Phaser.Math.DegToRad(120); // narrower cone so it feels forward
                const radius = Math.max(this.getRange(), 60);
                const enemies = unitManager.getUnitsByTeam(this.getTeam() === 1 ? 2 : 1);
                enemies.forEach(enemy => {
                    if (enemy.isDead()) return;
                    const pos = enemy.getPosition();
                    const dx = pos.x - center.x;
                    const dy = pos.y - center.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance > radius) return;
                    const angleToEnemy = Math.atan2(dy, dx);
                    const diff = Phaser.Math.Angle.Wrap(angleToEnemy - this.facing);
                    if (Math.abs(diff) <= swingAngle / 2) {
                        combatSystem.dealDamage(this as any, enemy as any, this.getDamage());
                    }
                });
            } else if (!targetUnit.isDead()) {
                // Fallback: single target damage
                const damage = this.getDamage();
                targetUnit.takeDamage(damage);
            }
            this.isAttacking = false;
        });
    }
    
    private createAttackSwing(directionAngle: number): void {
        const myPos = this.getPosition();
        
        // Create swing arc visual using modern Phaser 3 API
        // Ensure visibility in case a previous fade-out tween left alpha at 0
        this.scene.tweens.killTweensOf(this.attackSwingGraphics);
        this.attackSwingGraphics.setAlpha(1);
        this.attackSwingGraphics.setVisible(true);
        this.attackSwingGraphics.clear();
        this.attackSwingGraphics.setPosition(myPos.x, myPos.y);
        this.attackSwingGraphics.setDepth(5000); // Ensure it's visible on top of sprites
        this.attackSwingGraphics.setBlendMode(Phaser.BlendModes.ADD);
        
        // Choose swing color based on unit type
        let swingColor = 0xffffff;
        switch (this.config.unitType) {
            case UnitType.WARRIOR:
                swingColor = 0xffff00; // Bright yellow sword swing
                break;
            case UnitType.NINJA:
                swingColor = 0xff0000; // Bright red blade swing
                break;
            case UnitType.SHOTGUNNER:
                swingColor = 0xff8800; // Orange muzzle flash
                break;
        }
        
        // Draw 160-degree filled sector (fan) using Shapes Arc for reliability
        const swingRadius = Math.max(this.getRange(), 60);
        const swingArc = Phaser.Math.DegToRad(120);
        const startDeg = Phaser.Math.RadToDeg(directionAngle - swingArc / 2);
        const endDeg = Phaser.Math.RadToDeg(directionAngle + swingArc / 2);
        
        // Render on UI scene to guarantee top-most display (in case display list order conflicts)
        const uiScene = (this.scene.scene.get('UIScene') as Phaser.Scene) || this.scene;
        const sector = uiScene.add.arc(myPos.x, myPos.y, swingRadius, startDeg, endDeg, false, swingColor, 0.6);
        sector.setDepth(5000);
        sector.setBlendMode(Phaser.BlendModes.ADD);
        sector.setStrokeStyle(2, 0xffffff, 0.5);
        
        // Keep a reference lifespan short and independent of unit updates
        uiScene.tweens.add({
            targets: sector,
            alpha: 0,
            duration: 250,
            onComplete: () => sector.destroy()
        });
        
        console.log(`Attack swing sector at ${myPos.x},${myPos.y} angle=${directionAngle.toFixed(2)} radius=${swingRadius}`);
        
        // Animate swing fade out
        this.scene.tweens.add({
            targets: this.attackSwingGraphics,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.attackSwingGraphics.clear();
                this.attackSwingGraphics.setAlpha(1);
                this.attackSwingGraphics.setBlendMode(Phaser.BlendModes.NORMAL);
            }
        });
    }
    
    private getSizeRadius(): number {
        if (this.config.unitType === UnitType.RAIDER_BOSS) {
            // Triple the footprint of a normal large unit
            return 52.5;
        }
        switch (this.config.size) {
            case 'small': return 10;      // was 20
            case 'normal': return 12.5;   // was 25
            case 'large': return 17.5;    // was 35
        }
    }
    
    public update(deltaTime: number): void {
        if (this.dead) {
            this.deathTimer += deltaTime;
            return;
        }
        
        this.sprite.x = this.body.position.x;
        this.sprite.y = this.body.position.y;
        
        // Update health bar and team flag positions
        this.healthBarBg.x = this.body.position.x;
        this.healthBarBg.y = this.body.position.y;
        this.healthBar.x = this.body.position.x;
        this.healthBar.y = this.body.position.y;
        this.teamFlag.x = this.body.position.x;
        this.teamFlag.y = this.body.position.y;
        if (this.classLabel) {
            this.classLabel.x = this.body.position.x;
            this.classLabel.y = this.body.position.y - 110;
            this.classLabel.setDepth(this.body.position.y + 2000);
        }

        if (this.buffSquare && this.buildingBuffActive) {
            const labelWidth = this.classLabel ? this.classLabel.displayWidth : 40;
            const labelX = this.classLabel ? this.classLabel.x : this.body.position.x;
            const labelY = this.classLabel ? this.classLabel.y : this.body.position.y - 110;
            const size = this.buffSquare.width;
            this.buffSquare.x = labelX - labelWidth / 2 - size - 4;
            this.buffSquare.y = labelY;
            this.buffSquare.setDepth(this.classLabel ? this.classLabel.depth : this.body.position.y + 2001);
        }
        
        // Update trail graphics
        const velocity = this.body.velocity;
        const isMoving = Math.abs(velocity.x) > 0.3 || Math.abs(velocity.y) > 0.3;
        
        if (isMoving) {
            // Add new trail point
            this.trailPoints.push({
                x: this.body.position.x,
                y: this.body.position.y + 15, // Slightly below unit
                alpha: 1.0
            });
            
            // Limit trail length
            if (this.trailPoints.length > 15) {
                this.trailPoints.shift();
            }
        }
        
        // Update and draw trail
        this.updateTrail();

        // Update animations based on intended facing/movement; do not let
        // knockback velocity flip unit facing away from enemies.
        this.updateAnimation();
    }
    
    public move(direction: { x: number; y: number }): void {
        if (this.dead) return;

        const dx = direction.x;
        const dy = direction.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag === 0) return;

        const nx = dx / mag;
        const ny = dy / mag;

        // For melee units, lock facing to the intentional movement
        // direction (toward enemies), so pushback does not turn them
        // around.
        if (this.isMeleeUnit()) {
            this.facing = Math.atan2(ny, nx);
        }

        const moveSpeed = this.getMoveSpeed();
        const speed = moveSpeed * this.moveSpeedMultiplier;
        const force = {
            x: nx * speed * 0.002, // Reduced to 20% of original speed
            y: ny * speed * 0.002
        };
        
        this.physicsManager.applyImpulse(this.body, force);
    }

    public markBuildingBuff(): void {
        if (this.buildingBuffActive) {
            return;
        }
        this.buildingBuffActive = true;

        const size = 10;
        const labelWidth = this.classLabel ? this.classLabel.displayWidth : 40;
        const labelX = this.classLabel ? this.classLabel.x : this.body.position.x;
        const labelY = this.classLabel ? this.classLabel.y : this.body.position.y - 110;

        this.buffSquare = this.scene.add.rectangle(
            labelX - labelWidth / 2 - size - 4,
            labelY,
            size,
            size,
            0xffdd33,
            1
        );
        this.buffSquare.setStrokeStyle(1, 0xffffff, 0.9);
    }

    // Quick jump for Ninja: medium range dash with 4s cooldown
    public attemptNinjaJump(target: { x: number; y: number }, currentTime: number): boolean {
        if (this.dead) return false;
        if (this.config.unitType !== UnitType.NINJA) return false;
        const cooldownMs = 8000; // 8s cooldown
        const jumpRange = 600;   // mid-longrange
        if (currentTime - this.lastJumpTime < cooldownMs) return false;
        const myPos = this.getPosition();
        const dx = target.x - myPos.x;
        const dy = target.y - myPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 40 || dist > jumpRange) return false;
        const nx = dx / dist;
        const ny = dy / dist;
        // Dash by setting a high velocity briefly (mass-independent)
        const dashSpeed = 18; // tuned for heavy masses
        (this.scene.matter.body as any).setVelocity(this.body, { x: nx * dashSpeed, y: ny * dashSpeed });
        const prevFrictionAir = (this.body as any).frictionAir;
        const prevFriction = this.friction;
        (this.body as any).frictionAir = 0.01;
        this.friction = 0.05;
        this.lastJumpTime = currentTime;
        this.scene.time.delayedCall(220, () => {
            (this.body as any).frictionAir = prevFrictionAir;
            this.friction = prevFriction;
        });
        return true;
    }
    
    public takeDamage(amount: number): void {
        if (this.dead) return;
        
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        if (this.health === 0) {
            this.die();
        }
        
        this.emit('damage-taken', amount);
    }

    public heal(amount: number): void {
        if (this.dead || amount <= 0) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.updateHealthBar();
    }
    
    private die(): void {
        this.dead = true;
        this.deathTimer = 0;
        
        this.sprite.setAlpha(0.5);
        this.sprite.setTint(0x666666);
        
        this.healthBar.setVisible(false);
        this.healthBarBg.setVisible(false);
        this.teamFlag.setVisible(false);
        this.trailGraphics.clear(); // Clear trail on death
        this.trailPoints = []; // Clear trail points
        
        (this.body as any).isSensor = true;
        
        this.emit('death');
        
        // Emit to scene for XP orb spawning
        this.scene.events.emit('unit-death', this);
    }
    
    public applyImpulse(force: { x: number; y: number }): void {
        this.physicsManager.applyImpulse(this.body, force);
    }
    
    // Instantly move unit to a position (used for out-of-bounds recovery)
    public teleportTo(x: number, y: number): void {
        if (!this.body) return;
        (this.scene.matter.body as any).setPosition(this.body, { x, y });
        (this.scene.matter.body as any).setVelocity(this.body, { x: 0, y: 0 });
        // Immediately sync visuals to avoid one-frame delay
        this.sprite.x = x;
        this.sprite.y = y;
        if (this.healthBarBg) { this.healthBarBg.x = x; this.healthBarBg.y = y; }
        if (this.healthBar) { this.healthBar.x = x; this.healthBar.y = y; }
        if (this.teamFlag) { this.teamFlag.x = x; this.teamFlag.y = y; }
        if (this.classLabel) { this.classLabel.x = x; this.classLabel.y = y - 110; }
    }
    
    public addStatusEffect(effect: StatusEffect, duration: number): void {
        this.statusEffects.set(effect, duration);
    }
    
    public updateStatusEffects(deltaTime: number): void {
        this.statusEffects.forEach((duration, effect) => {
            const newDuration = duration - deltaTime;
            
            if (newDuration <= 0) {
                this.removeStatusEffect(effect);
            } else {
                this.statusEffects.set(effect, newDuration);
            }
        });
    }
    
    private removeStatusEffect(effect: StatusEffect): void {
        this.statusEffects.delete(effect);
        
        switch (effect) {
            case StatusEffect.SUPPRESSED:
                this.attackSpeedMultiplier = 1;
                break;
            case StatusEffect.SNARED:
                this.moveSpeedMultiplier = 1;
                break;
            case StatusEffect.GREASED:
                this.friction = 0.2;
                break;
            case StatusEffect.DAZED:
                this.accuracy = 1;
                break;
        }
    }
    
    public destroy(): void {
        if (this.body) {
            this.physicsManager.removeBody(this.body);
        }
        if (this.sprite) {
            this.sprite.destroy();
        }
        if (this.healthBar) {
            this.healthBar.destroy();
        }
        if (this.healthBarBg) {
            this.healthBarBg.destroy();
        }
        if (this.teamFlag) {
            this.teamFlag.destroy();
        }
        if (this.trailGraphics) {
            this.trailGraphics.destroy();
        }
        if (this.attackSwingGraphics) {
            this.attackSwingGraphics.destroy();
        }
        if (this.classLabel) {
            this.classLabel.destroy();
        }
        if (this.buffSquare) {
            this.buffSquare.destroy();
        }
        this.removeAllListeners();
    }
    
    public getId(): string { return this.id; }
    public getTeam(): number { return this.team; }
    public getPosition(): { x: number; y: number } { 
        if (!this.body || !this.body.position) {
            return { x: this.config.x, y: this.config.y };
        }
        return { x: this.body.position.x, y: this.body.position.y }; 
    }
    public getFacing(): number { return this.facing; }
    public isDead(): boolean { return this.dead; }
    public getDeathTimer(): number { return this.deathTimer; }
    public getHealth(): number { return this.health; }
    public getMaxHealth(): number { return this.maxHealth; }
    
    public getDamage(): number { 
        const baseDamage = this.damage;
        return RelicManager.getInstance().applyDamageModifier(baseDamage, this.getRelicContext());
    }
    
    public getArmor(): number { 
        const baseArmor = this.armor;
        return RelicManager.getInstance().applyArmorModifier(baseArmor, this.getRelicContext());
    }
    
    public getMass(): number { return this.mass; }
    public getCritChance(): number { return this.critChance; }
    public getCritMultiplier(): number { return this.critMultiplier; }
    public getAccuracy(): number { return this.accuracy; }
    
    public getRange(): number { 
        const baseRange = this.range;
        return RelicManager.getInstance().applyRangeModifier(baseRange, this.getRelicContext());
    }
    
    public getMoveSpeed(): number {
        const baseSpeed = this.moveSpeed;
        return RelicManager.getInstance().applyMoveSpeedModifier(baseSpeed, this.getRelicContext());
    }

    public getAttackSpeed(): number { 
        const baseSpeed = this.attackSpeed;
        const relicMod = RelicManager.getInstance().applyAttackSpeedModifier(baseSpeed, this.getRelicContext());
        return relicMod * this.attackSpeedMultiplier; 
    }
    
    public canAttack(currentTime: number): boolean {
        const cooldown = 1000 / this.getAttackSpeed();
        return currentTime - this.lastAttackTime >= cooldown;
    }
    public setLastAttackTime(time: number): void { this.lastAttackTime = time; }
    
    public setMoveSpeedMultiplier(value: number): void { this.moveSpeedMultiplier = value; }
    public setAttackSpeedMultiplier(value: number): void { this.attackSpeedMultiplier = value; }
    public setFriction(value: number): void { this.friction = value; }
    public setAccuracy(value: number): void { this.accuracy = value; }
    public getConfig(): UnitConfig { return this.config; }
    
    private getRelicContext(): IRelicContext {
        const gameState = GameStateManager.getInstance().getState();
        return {
            unitType: this.config.type,
            unitHpPercent: (this.health / this.maxHealth) * 100,
            fortressHpPercent: gameState.fortressMaxHp > 0 ? (gameState.fortressHp / gameState.fortressMaxHp) * 100 : 0,
            nodeType: NodeType.BATTLE,
            team: this.team
        };
    }

    private getSpriteKey(): string {
        switch (this.config.unitType) {
            case UnitType.CHRONOTEMPORAL: return 'chronotemporal';
            case UnitType.SNIPER: return 'sniper';
            case UnitType.DARK_MAGE: return 'dark_mage';
            case UnitType.WARRIOR: return 'warrior';
            case UnitType.NINJA: return 'ninja';
            case UnitType.SHOTGUNNER: return 'shotgunner';
            case UnitType.COG_SOLDIER: return 'warrior';
            case UnitType.COG_RAILGUNNER: return 'camp1_soldier3';
            case UnitType.COG_AEGIS_TANK: return 'camp1_soldier1';
            case UnitType.COG_MEDIC_DRONE: return 'chronotemporal';
            case UnitType.COG_THUNDER_CANNON: return 'camp1_soldier2';
            case UnitType.RAIDER_GRUNT: return 'warrior';
            case UnitType.RAIDER_BOMBER: return 'shotgunner';
            case UnitType.RAIDER_BOSS: return 'shotgunner';
            case UnitType.RAIDER_ROGUE: return 'ninja';
            case UnitType.RAIDER_ARCHER: return 'sniper';
            default: return 'warrior';
        }
    }
    
    private createAnimations(): void {
        const spriteKey = this.getSpriteKey();
        const animKey = spriteKey + '_anim';
        
        // Load animation data if it exists
        if (this.scene.cache.json.exists(animKey)) {
            const animData = this.scene.cache.json.get(animKey);
            
            // Create animations from loaded data
            if (animData.anims) {
                animData.anims.forEach((anim: any) => {
                    if (!this.scene.anims.exists(spriteKey + '_' + anim.key)) {
                        this.scene.anims.create({
                            key: spriteKey + '_' + anim.key,
                            frames: this.scene.anims.generateFrameNumbers(spriteKey, { 
                                frames: anim.frames.map((f: any) => f.frame) 
                            }),
                            frameRate: anim.frameRate || 6,
                            repeat: anim.repeat
                        });
                    }
                    // Remember the first frame of each walk animation as the idle frame
                    if (typeof anim.key === 'string' && anim.key.startsWith('walk_') && anim.frames && anim.frames.length > 0) {
                        const dir = anim.key.replace('walk_', '') as 'down' | 'up' | 'left' | 'right';
                        const firstFrame = anim.frames[0].frame;
                        if (dir === 'down' || dir === 'up' || dir === 'left' || dir === 'right') {
                            this.idleFrameByDirection[dir] = firstFrame;
                        }
                    }
                });
            }
        }
    }
    
    private updateAnimation(): void {
        const spriteKey = this.getSpriteKey();
        const velocity = this.body.velocity;
        const moving = Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1;
        
        // Determine facing/direction. For melee units, derive this from the
        // intended facing (toward enemies) instead of raw physics velocity so
        // knockback does not cause them to turn their backs.
        let direction: 'down' | 'up' | 'left' | 'right' = this.lastMoveDirection;

        if (this.isMeleeUnit()) {
            const angle = this.facing;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy < 0 ? 'up' : 'down';
            }
        } else {
            if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
                direction = velocity.x > 0 ? 'right' : 'left';
            } else if (velocity.y < 0) {
                direction = 'up';
            } else {
                direction = 'down';
            }
        }

        // If moving, ensure the correct walk animation is playing and can switch mid-play
        if (moving) {
            const desiredKey = spriteKey + '_walk_' + direction;
            const currentKey = this.sprite.anims.currentAnim ? this.sprite.anims.currentAnim.key : '';
            if (this.scene.anims.exists(desiredKey) && currentKey !== desiredKey) {
                this.sprite.play(desiredKey, true);
            } else if (!this.sprite.anims.isPlaying) {
                // Start playing if previously idle
                this.sprite.play(desiredKey, true);
            }
            this.lastMoveDirection = direction;
            return;
        }

        // If idle, stop animation and set the idle frame for the last direction
        if (this.sprite.anims.isPlaying) {
            this.sprite.anims.stop();
        }
        const idleFrame = this.idleFrameByDirection[this.lastMoveDirection] ?? 0;
        this.sprite.setFrame(idleFrame);
    }
}