import Phaser from 'phaser';
import { PhysicsManager } from '../systems/PhysicsManager';
import { StatusEffect } from '../systems/CombatSystem';

export interface UnitConfig {
    x: number;
    y: number;
    team: number;
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
    private body: MatterJS.BodyType;
    private sprite: Phaser.GameObjects.Sprite;
    private healthBar: Phaser.GameObjects.Graphics;
    private healthBarBg: Phaser.GameObjects.Graphics;
    
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
        const color = this.team === 1 ? 0x4444ff : 0xff4444;
        const radius = this.getSizeRadius();
        
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillCircle(0, 0, radius);
        graphics.generateTexture(`unit_${this.id}`, radius * 2, radius * 2);
        graphics.destroy();
        
        this.sprite = this.scene.add.sprite(this.config.x, this.config.y, `unit_${this.id}`);
        this.sprite.setData('unit', this);
        
        // Create health bar
        this.healthBarBg = this.scene.add.graphics();
        this.healthBar = this.scene.add.graphics();
        this.updateHealthBar();
    }
    
    private updateHealthBar(): void {
        const radius = this.getSizeRadius();
        const barWidth = radius * 2;
        const barHeight = 4;
        const barY = -radius - 10;
        
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
    
    private getSizeRadius(): number {
        switch (this.config.size) {
            case 'small': return 8;
            case 'normal': return 12;
            case 'large': return 18;
        }
    }
    
    public update(deltaTime: number): void {
        if (this.dead) {
            this.deathTimer += deltaTime;
            return;
        }
        
        this.sprite.x = this.body.position.x;
        this.sprite.y = this.body.position.y;
        
        // Update health bar position
        this.healthBarBg.x = this.body.position.x;
        this.healthBarBg.y = this.body.position.y;
        this.healthBar.x = this.body.position.x;
        this.healthBar.y = this.body.position.y;
        
        const velocity = this.body.velocity;
        if (velocity.x !== 0 || velocity.y !== 0) {
            this.facing = Math.atan2(velocity.y, velocity.x);
        }
    }
    
    public move(direction: { x: number; y: number }): void {
        if (this.dead) return;
        
        const speed = this.moveSpeed * this.moveSpeedMultiplier;
        const force = {
            x: direction.x * speed * 0.01,
            y: direction.y * speed * 0.01
        };
        
        this.physicsManager.applyImpulse(this.body, force);
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
    
    private die(): void {
        this.dead = true;
        this.deathTimer = 0;
        
        this.sprite.setAlpha(0.5);
        this.sprite.setTint(0x666666);
        
        this.healthBar.setVisible(false);
        this.healthBarBg.setVisible(false);
        
        (this.body as any).isSensor = true;
        
        this.emit('death');
        
        // Emit to scene for XP orb spawning
        this.scene.events.emit('unit-death', this);
    }
    
    public applyImpulse(force: { x: number; y: number }): void {
        this.physicsManager.applyImpulse(this.body, force);
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
    public getDamage(): number { return this.damage; }
    public getArmor(): number { return this.armor; }
    public getMass(): number { return this.mass; }
    public getCritChance(): number { return this.critChance; }
    public getCritMultiplier(): number { return this.critMultiplier; }
    public getAccuracy(): number { return this.accuracy; }
    public getRange(): number { return this.range; }
    public getAttackSpeed(): number { return this.attackSpeed * this.attackSpeedMultiplier; }
    public canAttack(currentTime: number): boolean {
        const cooldown = 1000 / this.getAttackSpeed();
        return currentTime - this.lastAttackTime >= cooldown;
    }
    public setLastAttackTime(time: number): void { this.lastAttackTime = time; }
    
    public setMoveSpeedMultiplier(value: number): void { this.moveSpeedMultiplier = value; }
    public setAttackSpeedMultiplier(value: number): void { this.attackSpeedMultiplier = value; }
    public setFriction(value: number): void { this.friction = value; }
    public setAccuracy(value: number): void { this.accuracy = value; }
}