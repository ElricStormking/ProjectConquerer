import Phaser from 'phaser';
import { IsometricRenderer } from '../systems/IsometricRenderer';
import { PhysicsManager } from '../systems/PhysicsManager';
import { UnitManager } from '../systems/UnitManager';
import { CombatSystem } from '../systems/CombatSystem';
import { DeploymentSystem } from '../systems/DeploymentSystem';
import { UnitFactory, UnitType } from '../data/UnitTypes';
import { LevelUpSystem } from '../systems/LevelUpSystem';
import { SkillManager } from '../data/Skills';

export class BattleScene extends Phaser.Scene {
    private isometricRenderer!: IsometricRenderer;
    private physicsManager!: PhysicsManager;
    private unitManager!: UnitManager;
    private combatSystem!: CombatSystem;
    private deploymentSystem!: DeploymentSystem;
    private levelUpSystem!: LevelUpSystem;
    private skillManager!: SkillManager;
    
    constructor() {
        super({ key: 'BattleScene' });
    }

    create() {
        this.setupSystems();
        this.setupCamera();
        this.createTestEnvironment();
        this.setupDeploymentZones();
        this.setupTestUnits();
        this.setupEventListeners();
    }

    private setupSystems() {
        this.isometricRenderer = new IsometricRenderer(this);
        this.physicsManager = new PhysicsManager(this);
        this.unitManager = new UnitManager(this, this.physicsManager);
        this.combatSystem = new CombatSystem(this, this.unitManager);
        this.deploymentSystem = new DeploymentSystem(this.unitManager);
        this.levelUpSystem = new LevelUpSystem(this);
        this.skillManager = new SkillManager();
    }

    private setupCamera() {
        const camera = this.cameras.main;
        camera.setZoom(1);
        camera.centerOn(960, 540);
        
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown) {
                camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
                camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
            }
        });
        
        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
            const zoom = camera.zoom;
            camera.zoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.5, 2);
        });
    }

    private createTestEnvironment() {
        const gridSize = 20;
        const tileWidth = 32;
        const tileHeight = 16;
        
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const isoX = (x - y) * (tileWidth / 2);
                const isoY = (x + y) * (tileHeight / 2);
                
                const graphics = this.add.graphics();
                graphics.lineStyle(1, 0x444444, 0.5);
                graphics.strokeRect(isoX + 960 - tileWidth/2, isoY + 400 - tileHeight/2, tileWidth, tileHeight);
            }
        }
    }

    private setupDeploymentZones() {
        this.deploymentSystem.createDeploymentZone(1, 600, 540, 300, 200);
        this.deploymentSystem.createDeploymentZone(2, 1320, 540, 300, 200);
        
        this.visualizeDeploymentZones();
    }

    private visualizeDeploymentZones() {
        const zone1 = this.deploymentSystem.getDeploymentZone(1);
        const zone2 = this.deploymentSystem.getDeploymentZone(2);
        
        if (zone1) {
            const graphics1 = this.add.graphics();
            graphics1.lineStyle(2, 0x4444ff, 0.3);
            graphics1.fillStyle(0x4444ff, 0.1);
            graphics1.fillRect(zone1.centerX - zone1.width/2, zone1.centerY - zone1.height/2, zone1.width, zone1.height);
            graphics1.strokeRect(zone1.centerX - zone1.width/2, zone1.centerY - zone1.height/2, zone1.width, zone1.height);
        }
        
        if (zone2) {
            const graphics2 = this.add.graphics();
            graphics2.lineStyle(2, 0xff4444, 0.3);
            graphics2.fillStyle(0xff4444, 0.1);
            graphics2.fillRect(zone2.centerX - zone2.width/2, zone2.centerY - zone2.height/2, zone2.width, zone2.height);
            graphics2.strokeRect(zone2.centerX - zone2.width/2, zone2.centerY - zone2.height/2, zone2.width, zone2.height);
        }
    }

    private setupTestUnits() {
        const team1Units = [
            UnitFactory.createUnit(UnitType.KNIGHT, 1, 0, 0, 1),
            UnitFactory.createUnit(UnitType.KNIGHT, 1, 0, 0, 1),
            UnitFactory.createUnit(UnitType.SHIELD_BEARER, 1, 0, 0, 1),
            UnitFactory.createUnit(UnitType.ARCHER, 1, 0, 0, 1),
            UnitFactory.createUnit(UnitType.ARCHER, 1, 0, 0, 1),
            UnitFactory.createUnit(UnitType.MAGE, 1, 0, 0, 2)
        ];
        
        const team2Units = [
            UnitFactory.createUnit(UnitType.BERSERKER, 2, 0, 0, 1),
            UnitFactory.createUnit(UnitType.BERSERKER, 2, 0, 0, 1),
            UnitFactory.createUnit(UnitType.KNIGHT, 2, 0, 0, 1),
            UnitFactory.createUnit(UnitType.ARCHER, 2, 0, 0, 1),
            UnitFactory.createUnit(UnitType.CATAPULT, 2, 0, 0, 1)
        ];
        
        team1Units.forEach(unit => this.deploymentSystem.queueUnit(1, unit));
        team2Units.forEach(unit => this.deploymentSystem.queueUnit(2, unit));
    }

    private setupEventListeners() {
        const uiScene = this.scene.get('UIScene');
        
        uiScene.events.on('deploy-units', () => {
            this.deploymentSystem.deployUnits(1);
            this.deploymentSystem.deployUnits(2);
            
            this.time.delayedCall(1000, () => {
                this.startBattle();
            });
        });
        
        this.events.on('damage-dealt', (event: any) => {
            console.log(`Damage dealt: ${event.damage} (${event.armorFacing})`);
        });
        
        // Unit death -> spawn XP orb  
        this.events.on('unit-death', (unit: any) => {
            const xpValue = Math.floor(5 + unit.getMaxHealth() / 20);
            this.levelUpSystem.spawnXPOrb(
                unit.getPosition().x,
                unit.getPosition().y,
                xpValue
            );
        });
        
        // Level up -> show skill selection
        this.events.on('level-up', (data: any) => {
            const choices = this.skillManager.generateSkillChoices(data.newLevel);
            const skillScene = this.scene.get('SkillSelectionScene') as any;
            skillScene.showSkillSelection(choices, data.newLevel);
        });
        
        // Skill selection handling
        const skillScene = this.scene.get('SkillSelectionScene');
        skillScene.events.on('skill-selected', (skill: any) => {
            this.skillManager.selectSkill(skill);
            this.levelUpSystem.onSkillSelected(skill);
            this.applySkillEffects();
        });
    }

    private startBattle() {
        console.log('Battle started! Units:', this.unitManager.getUnitCount());
        
        // Create a repeating timer for unit AI
        this.time.addEvent({
            delay: 100,
            callback: () => this.updateUnitAI(),
            loop: true
        });
    }
    
    private updateUnitAI() {
        const units = this.unitManager.getAllUnits();
        
        units.forEach(unit => {
            if (unit.isDead()) return;
            
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            if (enemies.length === 0) return;
            
            // Find closest enemy
            let closestEnemy = null;
            let closestDistance = Infinity;
            
            enemies.forEach(enemy => {
                if (!enemy.isDead()) {
                    const distance = Phaser.Math.Distance.Between(
                        unit.getPosition().x, unit.getPosition().y,
                        enemy.getPosition().x, enemy.getPosition().y
                    );
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                }
            });
            
            if (closestEnemy) {
                const direction = {
                    x: closestEnemy.getPosition().x - unit.getPosition().x,
                    y: closestEnemy.getPosition().y - unit.getPosition().y
                };
                
                const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
                if (magnitude > 0) {
                    direction.x /= magnitude;
                    direction.y /= magnitude;
                    unit.move(direction);
                }
            }
        });
    }

    update(_time: number, delta: number) {
        const deltaSeconds = delta / 1000;
        
        this.physicsManager.update(deltaSeconds);
        this.unitManager.update(deltaSeconds);
        this.combatSystem.update(deltaSeconds);
        this.isometricRenderer.update();
        this.levelUpSystem.update();
        
        this.checkCombat();
    }

    private checkCombat() {
        const currentTime = this.time.now;
        const units = this.unitManager.getAllUnits();
        
        units.forEach(unit => {
            if (unit.isDead() || !unit.canAttack(currentTime)) return;
            
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            
            // Find enemies in range
            let targetEnemy = null;
            let closestDistance = unit.getRange();
            
            enemies.forEach(enemy => {
                if (enemy.isDead()) return;
                
                const distance = Phaser.Math.Distance.Between(
                    unit.getPosition().x, unit.getPosition().y,
                    enemy.getPosition().x, enemy.getPosition().y
                );
                
                if (distance <= unit.getRange() && distance < closestDistance) {
                    closestDistance = distance;
                    targetEnemy = enemy;
                }
            });
            
            if (targetEnemy) {
                this.combatSystem.dealDamage(unit, targetEnemy, unit.getDamage());
                unit.setLastAttackTime(currentTime);
            }
        });
    }
    
    private applySkillEffects(): void {
        const activeSkills = this.skillManager.getActiveSkills();
        const units = this.unitManager.getAllUnits();
        
        // Apply skill effects to all units
        units.forEach(unit => {
            activeSkills.forEach(skill => {
                skill.effects.forEach(effect => {
                    const value = effect.baseValue + (effect.perRank * (skill.currentRank - 1));
                    this.applyEffectToUnit(unit, effect.stat, value, effect.isMultiplier);
                });
            });
        });
    }
    
    private applyEffectToUnit(unit: any, stat: string, value: number, isMultiplier: boolean): void {
        // This would apply the effect to the unit based on the stat type
        // For now, just log it
        console.log(`Applied ${stat}: ${value}${isMultiplier ? '%' : ''} to unit ${unit.getId()}`);
    }
}