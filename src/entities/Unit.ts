import Phaser from 'phaser';
import { PhysicsManager } from '../systems/PhysicsManager';
import { StatusEffect } from '../systems/CombatSystem';
import type { UnitManager } from '../systems/UnitManager';
import type { CombatSystem } from '../systems/CombatSystem';
import { UnitType, UNIT_TEMPLATES, UnitTemplate } from '../data/UnitTypes';
import { RelicManager } from '../systems/RelicManager';
import { GameStateManager } from '../systems/GameStateManager';
import { DataManager } from '../systems/DataManager';
import { IRelicContext, NodeType, UnitSkillTemplate } from '../types/ironwars';

export interface UnitConfig {
    x: number;
    y: number;
    team: number;
    unitType: UnitType;
    type: 'frontline' | 'ranged' | 'support' | 'siege' | 'summoner';
    size: 'small' | 'normal' | 'large';
    spriteScale?: number;
    spriteOffsetY?: number;
    unitTemplate?: UnitTemplate;
    stats: {
        maxHealth: number;
        damage: number;
        armor: number;
        moveSpeed: number;
        attackSpeed: number;
        range: number;
        mass: number;
    };
    skillPrimaryId?: string;
    skillSecondaryId?: string;
    passiveSkillId?: string;
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
    private statusIcon?: Phaser.GameObjects.Text;
    private classLabel!: Phaser.GameObjects.Text;
    private damageMultiplier: number = 1;
    private damageBuffRemainingMs: number = 0;
    private rampageActive: boolean = false;
    private rampageBleedAccumulator: number = 0;
    private chiDragoonHitCount: number = 0;
    private halberdLastSlamTime: number = 0;
    private shadowbladeFirstHitTime: number = 0;
    private skillPrimary?: UnitSkillTemplate;
    private skillSecondary?: UnitSkillTemplate;
    private passiveSkill?: UnitSkillTemplate;
    private lastSkillUse: Map<string, number> = new Map();
    private lastPassiveTick: Map<string, number> = new Map();
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
    
    // Status effect timers are tracked in SECONDS (remaining, tickInterval, accumulator).
    private statusEffects: Map<StatusEffect, { remaining: number; magnitude?: number; tickInterval?: number; accumulator?: number }> = new Map();
    private stunned: boolean = false;
    
    // Commander skill effect state (prefixed with _ as they are set but not read in this class)
    private _shieldAmount: number = 0;
    private _shieldRemainingMs: number = 0;
    private healReversed: boolean = false;
    private _healReversedRemainingMs: number = 0;
    private _tauntTargetX: number = 0;
    private _tauntTargetY: number = 0;
    private _tauntRemainingMs: number = 0;
    private _damageSharePercent: number = 0;
    private _damageShareLinks: Unit[] = [];
    private _damageShareRemainingMs: number = 0;
    private isApplyingDamageShare: boolean = false;
    private lastAttackTime: number = 0;
    private lastAzureStunTime: number = 0;
    private lastStormComboTime: number = 0;
    private spriteOffsetY: number = 0;

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

        // Visual-only offset for aligning sprite to the isometric grid.
        // Positive moves sprite DOWN (larger y), negative moves sprite UP.
        const rawOffsetY = this.config.unitTemplate?.spriteOffsetY ?? this.config.spriteOffsetY ?? 0;
        this.spriteOffsetY = Number.isFinite(Number(rawOffsetY)) ? Number(rawOffsetY) : 0;

        // Resolve skills from DataManager
        const dm = DataManager.getInstance();
        this.skillPrimary = config.skillPrimaryId ? dm.getUnitSkill(config.skillPrimaryId) : undefined;
        this.skillSecondary = config.skillSecondaryId ? dm.getUnitSkill(config.skillSecondaryId) : undefined;
        this.passiveSkill = config.passiveSkillId ? dm.getUnitSkill(config.passiveSkillId) : undefined;
        
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
        
        // Scale: designer-controlled via spriteScale; fallback to legacy heuristics
        let scale: number | undefined;
        const templateScale = this.config.unitTemplate?.spriteScale ?? this.config.spriteScale;
        if (typeof templateScale === 'number' && Number.isFinite(templateScale) && templateScale > 0) {
            scale = templateScale;
        }
        if (scale === undefined) {
            // Legacy heuristic: normalize to ~96px baseline, then adjust known specials
            const frameWidth = Math.max(1, this.sprite.frame.width);
            let baseScale = 0.5 * (96 / frameWidth);
            if (
                this.config.unitType === UnitType.JADE_AZURE_SPEAR ||
                this.config.unitType === UnitType.JADE_SHRINE_ONI ||
                this.config.unitType === UnitType.JADE_HALBERD_GUARDIAN
            ) {
                baseScale *= 2.4; // Jade heavy units need larger presence
            }
            scale = baseScale;
            if (this.config.unitType === UnitType.RAIDER_BOSS) {
                scale *= 3;
            }
        }
        this.sprite.setScale(scale ?? 1);

        // Apply designer-provided vertical offset (pixels, positive moves sprite down)
        if (this.spriteOffsetY !== 0) {
            this.sprite.y += this.spriteOffsetY;
        }
        
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
        this.statusIcon = this.scene.add.text(this.config.x, this.config.y - 130, '', {
            fontSize: '18px',
            color: '#ffff66',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
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
            case UnitType.JADE_AZURE_SPEAR:
            case UnitType.JADE_STORM_MONKS:
            case UnitType.JADE_HALBERD_GUARDIAN:
            case UnitType.JADE_SHRINE_ONI:
            case UnitType.JADE_CHI_DRAGOON:
            case UnitType.JADE_BLUE_ONI:
            case UnitType.JADE_PAPER_DOLL:
            case UnitType.FROST_SHADE_SERVANT:
            case UnitType.FROST_BLOODLINE_NOBLE:
            case UnitType.FROST_ETERNAL_WATCHER:
            case UnitType.FROST_CURSED_WALKER:
            case UnitType.FROST_FLESH_WEAVER:
            case UnitType.FROST_BOUND_SPECTRE:
            case UnitType.FROST_ABOMINATION:
            case UnitType.FROST_FORBIDDEN_SCIENTIST:
            case UnitType.FROST_SCREAMING_COFFIN:
            case UnitType.FROST_FLESH_CRAWLER:
            case UnitType.FROST_FLESH_TITAN:
                return true;
            default:
                return false;
        }
    }

    private applySkillEffects(skill: UnitSkillTemplate, targets: Unit[], currentTime: number, combatSystem: any): void {
        if (!this.canUseSkill(skill, currentTime)) return;
        const statusDurationSec = (skill.statusDurationMs ?? 0) / 1000;
        const stunSec = (skill.stunDurationMs ?? skill.statusDurationMs ?? 0) / 1000;
        const slowSec = (skill.slowDurationMs ?? skill.statusDurationMs ?? 0) / 1000;
        const dotDurationSec = statusDurationSec;
        const hotDurationSec = statusDurationSec;
        targets.forEach(target => {
            if (skill.statusEffects) {
                skill.statusEffects.forEach(effect => {
                    if (effect === 'stun') {
                        combatSystem.applyStatusEffect(target as any, StatusEffect.STUNNED, Math.max(0.1, stunSec));
                    } else if (effect === 'slow') {
                        combatSystem.applyStatusEffect(target as any, StatusEffect.SLOWED, Math.max(0.1, slowSec));
                    } else if (effect === 'dot') {
                        const tick = (skill.dotTickMs ?? 1000) / 1000;
                        target.addStatusEffect(StatusEffect.DOT, Math.max(0.1, dotDurationSec || (tick * 3)), skill.dotAmount ?? 1, tick);
                    } else if (effect === 'hot') {
                        const tick = (skill.hotTickMs ?? 1000) / 1000;
                        target.addStatusEffect(StatusEffect.HOT, Math.max(0.1, hotDurationSec || (tick * 3)), skill.hotAmount ?? 1, tick);
                    } else if (effect === 'suppressed') {
                        combatSystem.applyStatusEffect(target as any, StatusEffect.SUPPRESSED, Math.max(0.1, statusDurationSec || 1));
                    } else if (effect === 'dazed') {
                        combatSystem.applyStatusEffect(target as any, StatusEffect.DAZED, Math.max(0.1, statusDurationSec || 1));
                    } else if (effect === 'snared') {
                        combatSystem.applyStatusEffect(target as any, StatusEffect.SNARED, Math.max(0.1, statusDurationSec || 1));
                    }
                });
            }
            if (skill.damageBuffMultiplier && skill.damageBuffMultiplier > 1) {
                target.addDamageBuff(skill.damageBuffMultiplier, (skill.statusDurationMs ?? 4000));
            }
            if (skill.hotAmount && !skill.statusEffects?.includes('hot') && skill.hotTickMs) {
                const tick = (skill.hotTickMs ?? 1000) / 1000;
                target.addStatusEffect(StatusEffect.HOT, Math.max(0.1, hotDurationSec || (tick * 3)), skill.hotAmount, tick);
            }
            if (skill.healAmount && (target as any).heal) {
                (target as any).heal(skill.healAmount);
            }
            if (skill.cleanse && (target as any).clearDebuffs) {
                (target as any).clearDebuffs();
            }
        });
        this.markSkillUsed(skill, currentTime);
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
                let appliedStormStun = false;
                const hitEnemies: Unit[] = [];
                const meleeSkill = this.skillPrimary && this.skillPrimary.trigger === 'on_attack' ? this.skillPrimary : undefined;

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
                        hitEnemies.push(enemy as any);

                        // Legacy hardcoded CC only if no data-driven skill
                        if (!meleeSkill) {
                            if (this.config.unitType === UnitType.JADE_AZURE_SPEAR) {
                                if (currentTime - this.lastAzureStunTime > 1500) {
                                    combatSystem.applyStatusEffect(enemy as any, StatusEffect.STUNNED, 0.9);
                                    this.lastAzureStunTime = currentTime;
                                }
                            } else if (this.config.unitType === UnitType.JADE_STORM_MONKS && !appliedStormStun) {
                                if (currentTime - this.lastStormComboTime <= 400) {
                                    combatSystem.applyStatusEffect(enemy as any, StatusEffect.STUNNED, 1.0);
                                    this.lastStormComboTime = 0;
                                    appliedStormStun = true;
                                } else {
                                    this.lastStormComboTime = currentTime;
                                }
                            } else if (this.config.unitType === UnitType.JADE_CHI_DRAGOON) {
                                this.chiDragoonHitCount++;
                                if (this.chiDragoonHitCount >= 4) {
                                    this.chiDragoonHitCount = 0;
                                    combatSystem.applyStatusEffect(enemy as any, StatusEffect.STUNNED, 0.7);
                                }
                            } else if (this.config.unitType === UnitType.JADE_HALBERD_GUARDIAN) {
                                if (currentTime - this.halberdLastSlamTime > 6000) {
                                    this.halberdLastSlamTime = currentTime;
                                    combatSystem.applyStatusEffect(enemy as any, StatusEffect.STUNNED, 1.2);
                                }
                            } else if (this.config.unitType === UnitType.JADE_SHADOWBLADE_ASSASSINS) {
                                if (currentTime - this.shadowbladeFirstHitTime > 3000) {
                                    this.shadowbladeFirstHitTime = currentTime;
                                    combatSystem.applyStatusEffect(enemy as any, StatusEffect.STUNNED, 0.5);
                                }
                            } else if (this.config.unitType === UnitType.JADE_BLUE_ONI) {
                                combatSystem.applyStatusEffect(enemy as any, StatusEffect.SLOWED, 1.5);
                            } else if (this.config.unitType === UnitType.FROST_BLOODLINE_NOBLE) {
                                combatSystem.applyStatusEffect(enemy as any, StatusEffect.DOT, 4); // bleed over time
                            } else if (this.config.unitType === UnitType.FROST_FLESH_CRAWLER) {
                                if (Math.random() < 0.1) {
                                    combatSystem.applyStatusEffect(enemy as any, StatusEffect.DOT, 3);
                                }
                            }
                        }
                    }
                });

                if (meleeSkill && hitEnemies.length > 0) {
                    this.applySkillEffects(meleeSkill, hitEnemies, currentTime, combatSystem);
                }
            } else if (!targetUnit.isDead()) {
                // Fallback: single target damage
                const damage = this.getDamage();
                targetUnit.takeDamage(damage);
            }

            // Post-hit conversions (Shade Servant)
            if (this.config.unitType === UnitType.FROST_SHADE_SERVANT && targetUnit.isDead && targetUnit.isDead()) {
                if (Math.random() < 0.1 && unitManager) {
                    const pos = targetUnit.getPosition ? targetUnit.getPosition() : this.getPosition();
                    const newConfig = unitManager.createUnitConfig(UnitType.FROST_FLESH_WEAVER, this.team, pos.x, pos.y);
                    unitManager.spawnUnit(newConfig);
                }
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

        // Flesh Titan rampage activation
        if (!this.rampageActive && this.config.unitType === UnitType.FROST_FLESH_TITAN && this.health > 0 && this.health <= this.maxHealth * 0.5) {
            this.rampageActive = true;
            this.attackSpeedMultiplier *= 1.4;
            this.damageMultiplier *= 1.5;
        }

        // Tick temporary damage buffs
        if (this.damageBuffRemainingMs > 0) {
            this.damageBuffRemainingMs -= deltaTime * 1000;
            if (this.damageBuffRemainingMs <= 0) {
                this.damageMultiplier = 1;
                this.damageBuffRemainingMs = 0;
            }
        }

        this.updateCommanderEffects(deltaTime);

        // Flesh Titan rampage bleed
        if (this.rampageActive) {
            this.rampageBleedAccumulator += deltaTime;
            const bleedInterval = 1.0;
            while (this.rampageBleedAccumulator >= bleedInterval) {
                this.rampageBleedAccumulator -= bleedInterval;
                this.takeDamage(2);
            }
        }
        
        const visualX = this.body.position.x;
        const visualY = this.body.position.y + this.spriteOffsetY;

        this.sprite.x = visualX;
        this.sprite.y = visualY;
        
        // Update health bar and team flag positions
        this.healthBarBg.x = visualX;
        this.healthBarBg.y = visualY;
        this.healthBar.x = visualX;
        this.healthBar.y = visualY;
        this.teamFlag.x = visualX;
        this.teamFlag.y = visualY;
        if (this.statusIcon) {
            this.statusIcon.x = visualX;
            this.statusIcon.y = visualY - 130;
            this.statusIcon.setDepth(visualY + 4000);
        }
        if (this.classLabel) {
            this.classLabel.x = visualX;
            this.classLabel.y = visualY - 110;
            this.classLabel.setDepth(visualY + 2000);
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

    private updateCommanderEffects(deltaTime: number): void {
        const deltaMs = deltaTime * 1000;

        if (this._shieldRemainingMs > 0) {
            this._shieldRemainingMs -= deltaMs;
            if (this._shieldRemainingMs <= 0) {
                this._shieldRemainingMs = 0;
                const excess = Math.max(0, this.health - this.maxHealth);
                if (excess > 0) {
                    this.health = Math.max(this.maxHealth, this.health - Math.min(excess, this._shieldAmount));
                } else {
                    this.health = Math.min(this.health, this.maxHealth);
                }
                this._shieldAmount = 0;
                this.updateHealthBar();
            }
        }

        if (this._healReversedRemainingMs > 0) {
            this._healReversedRemainingMs -= deltaMs;
            if (this._healReversedRemainingMs <= 0) {
                this._healReversedRemainingMs = 0;
                this.healReversed = false;
            }
        }

        if (this._tauntRemainingMs > 0) {
            this._tauntRemainingMs -= deltaMs;
            if (this._tauntRemainingMs > 0 && (this._tauntTargetX !== 0 || this._tauntTargetY !== 0)) {
                const angle = Math.atan2(this._tauntTargetY - this.body.position.y, this._tauntTargetX - this.body.position.x);
                this.facing = angle;
            } else if (this._tauntRemainingMs <= 0) {
                this._tauntRemainingMs = 0;
                this._tauntTargetX = 0;
                this._tauntTargetY = 0;
            }
        }

        if (this._damageShareRemainingMs > 0) {
            this._damageShareRemainingMs -= deltaMs;
            if (this._damageShareRemainingMs <= 0) {
                this.clearDamageShare();
            }
        }
    }
    
    public move(direction: { x: number; y: number }): void {
        if (this.dead) return;
        if (this.stunned) return;

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
        let dmg = Number(amount);
        if (!Number.isFinite(dmg) || dmg <= 0) return;

        if (!this.isApplyingDamageShare && this._damageSharePercent > 0 && this._damageShareLinks.length > 0) {
            const recipients = this._damageShareLinks.filter(u => u !== this && u.isAlive());
            if (recipients.length > 0) {
                const shareAmount = dmg * this._damageSharePercent;
                const selfPortion = Math.max(0, dmg - shareAmount);
                const perTarget = shareAmount / recipients.length;
                this.isApplyingDamageShare = true;
                recipients.forEach(u => u.takeDamage(perTarget));
                this.isApplyingDamageShare = false;
                dmg = selfPortion;
            }
        }

        this.health = Math.max(0, this.health - dmg);
        this.updateHealthBar();
        
        if (!Number.isFinite(this.health) || this.health <= 0) {
            this.health = 0;
            this.die();
        }
        
        this.emit('damage-taken', dmg);
    }

    public heal(amount: number): void {
        if (this.dead || amount <= 0) return;
        // Check heal reverse status
        if (this.healReversed) {
            this.takeDamage(amount);
            return;
        }
        const healVal = Number(amount);
        if (!Number.isFinite(healVal) || healVal <= 0) return;
        this.health = Math.min(this.maxHealth, this.health + healVal);
        this.updateHealthBar();
    }

    // Commander skill support methods
    public applyStun(durationMs: number): void {
        if (this.dead) return;
        const durationSec = durationMs / 1000;
        this.addStatusEffect(StatusEffect.STUNNED, durationSec);
    }

    public applyForce(forceX: number, forceY: number): void {
        if (this.dead) return;
        this.applyImpulse({ x: forceX * 0.001, y: forceY * 0.001 });
    }

    public applySlow(amount: number, durationMs: number): void {
        if (this.dead) return;
        const durationSec = durationMs / 1000;
        this.moveSpeedMultiplier = 1 - amount;
        this.addStatusEffect(StatusEffect.SLOWED, durationSec);
    }

    public cleanse(): void {
        this.clearDebuffs();
    }

    public applyShield(amount: number, durationMs: number): void {
        if (this.dead) return;
        // Simple implementation: temporarily increase max health
        this._shieldAmount = amount;
        this._shieldRemainingMs = durationMs;
        this.health = Math.min(this.health + amount, this.maxHealth + amount);
        this.updateHealthBar();
    }

    public applyAttackBuff(multiplier: number, durationMs: number): void {
        if (this.dead) return;
        this.addDamageBuff(1 + multiplier, durationMs);
    }

    public applyHealReverse(durationMs: number): void {
        if (this.dead) return;
        this.healReversed = true;
        this._healReversedRemainingMs = durationMs;
    }

    public applyTaunt(targetX: number, targetY: number, durationMs: number): void {
        if (this.dead) return;
        this._tauntTargetX = targetX;
        this._tauntTargetY = targetY;
        this._tauntRemainingMs = durationMs;
    }

    public applyDamageShare(percent: number, linkedUnits: Unit[], durationMs: number): void {
        if (this.dead) return;
        this._damageSharePercent = percent;
        this._damageShareLinks = linkedUnits;
        this._damageShareRemainingMs = durationMs;
    }

    public clearDamageShare(): void {
        this._damageSharePercent = 0;
        this._damageShareLinks = [];
        this._damageShareRemainingMs = 0;
    }

    public getMaxHp(): number { return this.maxHealth; }
    public getCurrentHp(): number { return this.health; }
    public isAlive(): boolean { return !this.dead; }
    
    private die(): void {
        this.dead = true;
        this.deathTimer = 0;
        
        this.sprite.setAlpha(0.5);
        this.sprite.setTint(0x666666);
        
        this.healthBar.setVisible(false);
        this.healthBarBg.setVisible(false);
        this.teamFlag.setVisible(false);
        if (this.statusIcon) {
            this.statusIcon.setVisible(false);
            this.statusIcon.destroy();
            this.statusIcon = undefined;
        }
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
        this.sprite.y = y + this.spriteOffsetY;
        if (this.healthBarBg) { this.healthBarBg.x = x; this.healthBarBg.y = y + this.spriteOffsetY; }
        if (this.healthBar) { this.healthBar.x = x; this.healthBar.y = y + this.spriteOffsetY; }
        if (this.teamFlag) { this.teamFlag.x = x; this.teamFlag.y = y + this.spriteOffsetY; }
        if (this.classLabel) { this.classLabel.x = x; this.classLabel.y = y + this.spriteOffsetY - 110; }
    }
    
    public addStatusEffect(effect: StatusEffect, duration: number, magnitude?: number, tickIntervalSeconds?: number): void {
        // Duration and tickInterval are in seconds; update loop also uses seconds.
        this.statusEffects.set(effect, { remaining: duration, magnitude, tickInterval: tickIntervalSeconds, accumulator: 0 });
        if (effect === StatusEffect.STUNNED) {
            this.stunned = true;
        }
    }
    
    public updateStatusEffects(deltaTime: number): void {
        this.statusEffects.forEach((entry, effect) => {
            const newRemaining = entry.remaining - deltaTime; // all in seconds
            let accumulator = entry.accumulator ?? 0;

            // Handle periodic effects
            if ((effect === StatusEffect.DOT || effect === StatusEffect.HOT) && entry.tickInterval) {
                accumulator += deltaTime;
                while (accumulator >= entry.tickInterval) {
                    accumulator -= entry.tickInterval;
                    const mag = Number(entry.magnitude ?? 0);
                    if (mag > 0) {
                        if (effect === StatusEffect.DOT) {
                            this.takeDamage(mag);
                        } else if (effect === StatusEffect.HOT) {
                            this.heal(mag);
                        }
                    }
                }
            }

            if (newRemaining <= 0) {
                this.removeStatusEffect(effect);
                this.statusEffects.delete(effect);
            } else {
                this.statusEffects.set(effect, {
                    ...entry,
                    remaining: newRemaining,
                    accumulator
                });
            }
        });

        // Safety: ensure death triggers if health fell to/below zero from any effect
        if (!this.dead && (!Number.isFinite(this.health) || this.health <= 0)) {
            this.health = 0;
            this.die();
        }
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
            case StatusEffect.STUNNED:
                this.stunned = false;
                break;
            case StatusEffect.SLOWED:
                this.moveSpeedMultiplier = 1;
                break;
        }

        // If no remaining stun/slow, hide status icon immediately
        if (this.statusIcon) {
            const hasSlow = this.statusEffects.has(StatusEffect.SLOWED);
            if (!this.stunned && !hasSlow) {
                this.statusIcon.setText('');
                this.statusIcon.setVisible(false);
            }
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
        return RelicManager.getInstance().applyDamageModifier(baseDamage * this.damageMultiplier, this.getRelicContext());
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
    
    public isStunned(): boolean { return this.stunned; }
    public setStunned(value: boolean): void { this.stunned = value; }
    
    public canAttack(currentTime: number): boolean {
        if (this.stunned) return false;
        const cooldown = 1000 / this.getAttackSpeed();
        return currentTime - this.lastAttackTime >= cooldown;
    }
    public setLastAttackTime(time: number): void { this.lastAttackTime = time; }
    public getPrimarySkill(): UnitSkillTemplate | undefined { return this.skillPrimary; }
    public getSecondarySkill(): UnitSkillTemplate | undefined { return this.skillSecondary; }
    public getPassiveSkill(): UnitSkillTemplate | undefined { return this.passiveSkill; }
    public getSkillTemplates(): UnitSkillTemplate[] {
        return [this.skillPrimary, this.skillSecondary, this.passiveSkill].filter(Boolean) as UnitSkillTemplate[];
    }
    public canUseSkill(skill?: UnitSkillTemplate, currentTime: number = this.scene.time.now): boolean {
        if (!skill) return false;
        const cd = skill.cooldownMs ?? 0;
        const last = this.lastSkillUse.get(skill.id) ?? -Infinity;
        return currentTime - last >= cd;
    }
    public markSkillUsed(skill: UnitSkillTemplate, currentTime: number = this.scene.time.now): void {
        this.lastSkillUse.set(skill.id, currentTime);
    }
    public getLastPassiveTick(skillId: string): number {
        return this.lastPassiveTick.get(skillId) ?? 0;
    }
    public setLastPassiveTick(skillId: string, time: number): void {
        this.lastPassiveTick.set(skillId, time);
    }
    
    public setMoveSpeedMultiplier(value: number): void { this.moveSpeedMultiplier = value; }
    public setAttackSpeedMultiplier(value: number): void { this.attackSpeedMultiplier = value; }
    public addDamageBuff(multiplier: number, durationMs: number): void {
        this.damageMultiplier = Math.max(this.damageMultiplier, multiplier);
        this.damageBuffRemainingMs = Math.max(this.damageBuffRemainingMs, durationMs);
    }
    public triggerSkill(skill: UnitSkillTemplate, targets: Unit[], currentTime: number, combatSystem: any): void {
        this.applySkillEffects(skill, targets, currentTime, combatSystem);
    }
    public clearDebuffs(): void {
        // Remove selected debuffing status effects
        ['STUNNED','SLOWED','SUPPRESSED','SNARED','DAZED','DOT'].forEach(key => {
            const effect = (StatusEffect as any)[key] as StatusEffect | undefined;
            if (effect && this.statusEffects.has(effect)) {
                this.removeStatusEffect(effect);
                this.statusEffects.delete(effect);
            }
        });
    }
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
            case UnitType.JADE_AZURE_SPEAR: return 'jade_azure_spear';
            case UnitType.JADE_STORM_MONKS: return 'jade_storm_monks';
            case UnitType.JADE_CROSSBOW_GUNNERS: return 'jade_crossbow_gunners';
            case UnitType.JADE_HALBERD_GUARDIAN: return 'jade_halberd_guardian';
            case UnitType.JADE_SHRINE_ONI: return 'jade_shrine_oni';
            case UnitType.JADE_SHIKIGAMI_FOX: return 'jade_shikigami_fox';
            case UnitType.JADE_CHI_DRAGOON: return 'jade_chi_dragoon'; // placeholder reuse
            case UnitType.JADE_SHURIKEN_NINJAS: return 'jade_shuriken_ninjas'; // placeholder reuse
            case UnitType.JADE_SHADOWBLADE_ASSASSINS: return 'jade_shadowblade_assassins'; // placeholder reuse
            case UnitType.JADE_SPIRIT_LANTERN: return 'jade_spirit_lantern'; // placeholder reuse
            case UnitType.JADE_PAPER_DOLL: return 'jade_paper_doll'; // placeholder reuse
            case UnitType.JADE_BLUE_ONI: return 'jade_blue_oni'; // placeholder reuse
            case UnitType.FROST_SHADE_SERVANT: return 'frost_shade_servant';
            case UnitType.FROST_PUTRID_ARCHER: return 'frost_putrid_archer';
            case UnitType.FROST_ETERNAL_WATCHER: return 'frost_eternal_watcher';
            case UnitType.FROST_CURSED_WALKER: return 'frost_cursed_walker';
            case UnitType.FROST_BLOODLINE_NOBLE: return 'frost_bloodline_noble';
            case UnitType.FROST_AGONY_SCREAMER: return 'frost_agony_screamer';
            case UnitType.FROST_FLESH_WEAVER: return 'frost_shade_servant'; // placeholder
            case UnitType.FROST_BOUND_SPECTRE: return 'frost_shade_servant'; // placeholder
            case UnitType.FROST_ABOMINATION: return 'frost_eternal_watcher'; // placeholder
            case UnitType.FROST_FORBIDDEN_SCIENTIST: return 'frost_putrid_archer'; // placeholder
            case UnitType.FROST_SCREAMING_COFFIN: return 'frost_eternal_watcher'; // placeholder
            case UnitType.FROST_FLESH_CRAWLER: return 'frost_shade_servant'; // placeholder
            case UnitType.FROST_FLESH_TITAN: return 'frost_eternal_watcher'; // placeholder
            default: return 'warrior';
        }
    }
    
    private createAnimations(): void {
        const spriteKey = this.getSpriteKey();
        const animKey = spriteKey + '_anim';
        
        // Load animation data if it exists
        const animDataKey = this.scene.cache.json.exists(animKey) ? animKey : spriteKey + '_an';
        if (this.scene.cache.json.exists(animDataKey)) {
            const animData = this.scene.cache.json.get(animDataKey);
            
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

        // Visuals for status: tint for slow, icon for stun/slow
        const hasSlow = this.statusEffects.has(StatusEffect.SLOWED);
        if (hasSlow) {
            this.sprite.setTint(0x66ccff);
        } else {
            this.sprite.setTint(this.team === 1 ? 0xaaccff : 0xffaaaa);
        }
        if (this.statusIcon) {
            if (this.stunned) {
                this.statusIcon.setText('💫');
                this.statusIcon.setVisible(true);
            } else if (hasSlow) {
                this.statusIcon.setText('⏳');
                this.statusIcon.setVisible(true);
            } else {
                this.statusIcon.setText('');
                this.statusIcon.setVisible(false);
            }
        }
    }
}