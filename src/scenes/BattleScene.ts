import Phaser from 'phaser';
import { IsometricRenderer } from '../systems/IsometricRenderer';
import { PhysicsManager } from '../systems/PhysicsManager';
import { UnitManager } from '../systems/UnitManager';
import { CombatSystem } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { DeckSystem } from '../systems/DeckSystem';
import { CardSystem } from '../systems/CardSystem';
import { GameStateManager } from '../systems/GameStateManager';
import { FortressSystem } from '../systems/FortressSystem';
import { WaveManager } from '../systems/WaveManager';
import { CommanderSystem } from '../systems/CommanderSystem';
import { COG_DOMINION_STARTER } from '../data/ironwars/cog_dominion_starter';
import { BattlePhase, ICard, IDeckState, IHandUpdatePayload, IGameState } from '../types/ironwars';

type CardPlayPayload = { card: ICard; screenX: number; screenY: number };
type CommanderCastPayload = { screenX: number; screenY: number };
import { UnitType } from '../data/UnitTypes';

const STARTING_HAND = 5;

export class BattleScene extends Phaser.Scene {
    private isometricRenderer!: IsometricRenderer;
    private physicsManager!: PhysicsManager;
    private unitManager!: UnitManager;
    private combatSystem!: CombatSystem;
    private projectileSystem!: ProjectileSystem;
    private deckSystem!: DeckSystem;
    private cardSystem!: CardSystem;
    private fortressSystem!: FortressSystem;
    private waveManager!: WaveManager;
    private commanderSystem!: CommanderSystem;
    private readonly gameState = GameStateManager.getInstance();
    private readonly starterData = COG_DOMINION_STARTER;

    private battlefield = { centerX: 960, centerY: 540, width: 1720, height: 880 };
    private currentDraggedCard?: ICard;
    private fortressCoreWorld = { x: 0, y: 0 };
    private fortressCoreGraphic?: Phaser.GameObjects.Graphics;
    private startButton!: Phaser.GameObjects.Container;
    private startButtonLabel!: Phaser.GameObjects.Text;
    private overlayContainer?: Phaser.GameObjects.Container;
    private battleState: 'preparation' | 'running' | 'victory' | 'defeat' = 'preparation';
    private hasStartedFirstWave = false;
    private medicLastHeal: Map<string, number> = new Map();

    constructor() {
        super({ key: 'BattleScene' });
    }

    public create() {
        this.launchUIScene();
        this.setupCamera();
        this.setupCoreSystems();
        this.createEnvironment();
        this.initializeIronwarsPrototype();
        this.setupPointerBridge();
    }

    public update(_time: number, delta: number) {
        const deltaSeconds = delta / 1000;
        this.physicsManager.update(deltaSeconds);
        this.unitManager.update(deltaSeconds);
        this.combatSystem.update(deltaSeconds);
        this.projectileSystem.update(deltaSeconds);
        this.isometricRenderer.update();

        if (this.battleState === 'running') {
            this.updateUnitAI();
            this.checkCombat();
            this.checkFortressCollisions();
            this.updateMedicHealing(this.time.now);
            this.cardSystem.update(this.time.now, deltaSeconds);
        }
    }

    private launchUIScene() {
        if (!this.scene.isActive('UIScene')) {
            this.scene.launch('UIScene');
        }
    }

    private setupCamera() {
        const camera = this.cameras.main;
        // Allow camera to move freely enough that we can center on the
        // fortress grid and then zoom back out to full battlefield.
        camera.setZoom(1);
        camera.setBounds(0, 0, 1920, 1080);
        camera.centerOn(this.battlefield.centerX, this.battlefield.centerY);
        camera.roundPixels = true;

        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
            const zoom = camera.zoom;
            camera.zoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 1, 2.5);
        });
    }

    private setupCoreSystems() {
        this.isometricRenderer = new IsometricRenderer(this);
        this.physicsManager = new PhysicsManager(this);
        this.unitManager = new UnitManager(this, this.physicsManager);
        this.combatSystem = new CombatSystem(this, this.unitManager);
        this.projectileSystem = new ProjectileSystem(this);
        this.physicsManager.setBattlefieldBounds(100, 100, 1720, 880, 5, 5);
    }

    private createEnvironment() {
        const bg = this.add.image(960, 540, 'world_bg');
        bg.setDepth(-10000);
        bg.setDisplaySize(1920, 1080);

        // Global isometric grid covering the whole canvas. Use medium-sized
        // diamonds (128x64) so they are easy to hit but not oversized.
        const gridSize = 46;
        const cellWidth = 128;
        const cellHeight = 64;
        const gridGraphics = this.add.graphics();
        gridGraphics.setDepth(-9000);
        gridGraphics.lineStyle(1, 0xffffff, 0.06);

        for (let gx = -gridSize; gx <= gridSize; gx++) {
            for (let gy = -gridSize; gy <= gridSize; gy++) {
                const worldX = (gx - gy) * (cellWidth / 2) + 960;
                const worldY = (gx + gy) * (cellHeight / 2) + 540;

                if (worldX < -cellWidth || worldX > 1920 + cellWidth || worldY < -cellHeight || worldY > 1080 + cellHeight) {
                    continue;
                }

                const halfW = cellWidth / 2;
                const halfH = cellHeight / 2;
                gridGraphics.beginPath();
                gridGraphics.moveTo(worldX, worldY - halfH);
                gridGraphics.lineTo(worldX + halfW, worldY);
                gridGraphics.lineTo(worldX, worldY + halfH);
                gridGraphics.lineTo(worldX - halfW, worldY);
                gridGraphics.closePath();
                gridGraphics.strokePath();
            }
        }

        const boundaryGraphics = this.add.graphics();
        boundaryGraphics.lineStyle(3, 0xffffff, 0.15);
        const left = this.battlefield.centerX - this.battlefield.width / 2;
        const top = this.battlefield.centerY - this.battlefield.height / 2;
        boundaryGraphics.strokeRect(left, top, this.battlefield.width, this.battlefield.height);

        this.createEnvironmentalObjects();
    }

    private initializeIronwarsPrototype() {
        // Use generous starting resources in the prototype so all 5 unit types
        // (soldier, railgunner, tank, medic, cannon) can be summoned for testing.
        this.gameState.initialize(this.starterData, 10, 40);

        // Position the player's fortress/grid (blue team summon area) in the
        // upper-left region of the canvas, with medium diamond cells.
        this.fortressSystem = new FortressSystem(
            this,
            this.isometricRenderer,
            this.starterData.fortress,
            340, 140,
            128, 64
        );
        this.fortressSystem.initialize();
        const coreX = Math.floor(this.starterData.fortress.gridWidth / 2);
        const coreY = Math.floor(this.starterData.fortress.gridHeight / 2);
        this.fortressCoreWorld = this.fortressSystem.gridToWorld(coreX, coreY);
        this.createFortressCorePlaceholder();

        this.deckSystem = new DeckSystem(7);
        this.deckSystem.reset(this.starterData.deck);
        this.deckSystem.draw(STARTING_HAND);
        this.cardSystem = new CardSystem(
            this,
            this.deckSystem,
            this.gameState,
            this.fortressSystem,
            this.unitManager
        );

        this.waveManager = new WaveManager(this, this.unitManager, this.gameState, this.fortressSystem);
        this.waveManager.loadWaves(this.starterData.waves);

        this.commanderSystem = new CommanderSystem(this, this.unitManager);
        this.commanderSystem.initialize(this.starterData.commander);

        this.bindStateEvents();
        this.createPhaseControls();
        this.gameState.setDeckState(this.deckSystem.getState());

        // Start in building phase view, zoomed in on the fortress grid.
        this.updateCameraForPhase('PREPARATION');
    }

    private bindStateEvents() {
        this.deckSystem.on('deck-state-changed', (state: IDeckState) => {
            this.gameState.setDeckState(state);
        });

        this.deckSystem.on('hand-updated', (payload: IHandUpdatePayload) => {
            this.events.emit('hand-updated', payload);
        });

        this.gameState.on('state-updated', (state: IGameState) => {
            this.events.emit('state-updated', state);
        });

        this.gameState.on('phase-changed', (phase: BattlePhase) => {
            this.events.emit('phase-changed', phase);
            this.updateCameraForPhase(phase);
        });

        this.gameState.on('fortress-damaged', (payload: { hp: number; max: number }) => {
            this.events.emit('fortress-damaged', payload);
        });

        this.gameState.on('fortress-destroyed', () => {
            if (this.battleState !== 'defeat' && this.battleState !== 'victory') {
                this.handleDefeat();
            }
        });

        this.waveManager.on('wave-started', (index: number) => {
            this.events.emit('wave-started', index);
            this.gameState.advanceWave();
            this.gameState.setPhase('BATTLE');
            this.battleState = 'running';
        });

        this.waveManager.on('wave-cleared', () => {
            if (this.waveManager.hasNextWave()) {
                // Between waves, return to a full building phase so the
                // player can adjust their fortress and play additional
                // cards before the next fight, and draw one new card at the
                // start of this preparation.
                this.battleState = 'preparation';
                this.gameState.setPhase('PREPARATION');
                this.deckSystem.draw(1);
                this.showStartButton('Start Next Wave');
            } else {
                this.handleVictory();
            }
        });

        this.commanderSystem.on('skill-cast', (payload: { cooldown: number; lastCast: number }) => {
            this.events.emit('commander-cast', payload);
        });
    }

    private createPhaseControls() {
        const container = this.add.container(960, 860);
        const background = this.add.rectangle(0, 0, 260, 66, 0x1d1f2c, 0.85)
            .setStrokeStyle(2, 0xffffff, 0.35)
            .setOrigin(0.5);
        const label = this.add.text(0, 0, 'Start Battle', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add([background, label]);
        container.setDepth(5000);
        container.setSize(260, 66);
        container.setInteractive(new Phaser.Geom.Rectangle(-130, -33, 260, 66), Phaser.Geom.Rectangle.Contains);
        container.on('pointerover', () => background.setFillStyle(0x262a40, 0.95));
        container.on('pointerout', () => background.setFillStyle(0x1d1f2c, 0.85));
        container.on('pointerdown', () => this.tryStartWave());
        this.startButton = container;
        this.startButtonLabel = label;
    }

    private showStartButton(text: string) {
        this.startButtonLabel.setText(text);
        this.startButton.setVisible(true);
    }

    private hideStartButton() {
        this.startButton.setVisible(false);
    }

    private tryStartWave() {
        if (this.battleState === 'running') {
            return;
        }
        // When the player starts the fighting phase, apply all building
        // buffs (Armor Shop, Overclock Stable) to units in their adjacent
        // fortress cells.
        this.cardSystem.applyBuildingBuffsAtBattleStart();
        if (!this.hasStartedFirstWave) {
            this.waveManager.startFirstWave();
            this.hasStartedFirstWave = true;
        } else {
            this.waveManager.startNextWave();
        }
        this.hideStartButton();
    }

    private setupPointerBridge() {
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));

        this.events.on('ui:card-drag-start', (card: ICard) => {
            this.currentDraggedCard = card;
        });

        this.events.on('ui:card-drag-end', () => {
            this.currentDraggedCard = undefined;
            this.fortressSystem.clearHover();
        });

        this.events.on('ui:card-play', (payload: CardPlayPayload) => {
            this.handleCardPlacement(payload);
        });

        this.events.on('ui:start-wave', () => this.tryStartWave());

        this.events.on('ui:commander-cast', (payload: CommanderCastPayload) => {
            const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
            this.commanderSystem.tryCast(worldPoint.x, worldPoint.y);
        });
    }

    private handlePointerMove(pointer: Phaser.Input.Pointer) {
        if (!this.currentDraggedCard) {
            this.fortressSystem.clearHover();
            return;
        }
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const grid = this.fortressSystem.worldToGrid(worldPoint.x, worldPoint.y);
        const isValid = this.gameState.getState().phase === 'PREPARATION' && this.fortressSystem.isValidCell(grid.x, grid.y);
        this.fortressSystem.setHoverCell(grid.x, grid.y, isValid);
    }

    private handleCardPlacement(payload: CardPlayPayload) {
        const state = this.gameState.getState();
        if (state.phase !== 'PREPARATION') {
            this.events.emit('card-placement-result', { cardId: payload.card.id, success: false });
            return;
        }
        const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
        const grid = this.fortressSystem.worldToGrid(worldPoint.x, worldPoint.y);
        const success = this.cardSystem.resolveCardPlacement({
            card: payload.card,
            gridX: grid.x,
            gridY: grid.y
        });
        if (success) {
            this.fortressSystem.clearHover();
        }
        this.events.emit('card-placement-result', { cardId: payload.card.id, success });
    }

    private checkFortressCollisions() {
        const enemies = this.unitManager.getUnitsByTeam(2);
        enemies.forEach(unit => {
            if (unit.isDead()) return;
            const pos = unit.getPosition();
            const dist = Phaser.Math.Distance.Between(pos.x, pos.y, this.fortressCoreWorld.x, this.fortressCoreWorld.y);
            if (dist <= 90) {
                this.gameState.takeFortressDamage(25);
                unit.takeDamage(9999);
            }
        });
    }

    private createFortressCorePlaceholder() {
        const x = this.fortressCoreWorld.x;
        const y = this.fortressCoreWorld.y;

        if (this.fortressCoreGraphic) {
            this.fortressCoreGraphic.destroy();
        }

        const g = this.add.graphics();
        this.fortressCoreGraphic = g;

        // Draw a tower base diamond on the core cell.
        const baseHalfW = 64;
        const baseHalfH = 32;
        g.fillStyle(0x1f2229, 0.95);
        g.lineStyle(2, 0xffcc66, 0.9);
        g.beginPath();
        g.moveTo(x, y - baseHalfH);
        g.lineTo(x + baseHalfW, y);
        g.lineTo(x, y + baseHalfH);
        g.lineTo(x - baseHalfW, y);
        g.closePath();
        g.fillPath();
        g.strokePath();

        // Vertical tower body rising from the core.
        const towerWidth = 46;
        const towerHeight = 90;
        const towerBottomY = y - 8;
        const towerTopY = towerBottomY - towerHeight;

        g.fillStyle(0x343b4a, 1);
        g.fillRect(x - towerWidth / 2, towerTopY, towerWidth, towerHeight);

        // Subtle vertical edge highlights.
        g.lineStyle(1.5, 0x6b7a92, 0.8);
        g.beginPath();
        g.moveTo(x - towerWidth / 4, towerTopY + 4);
        g.lineTo(x - towerWidth / 4, towerBottomY - 4);
        g.moveTo(x + towerWidth / 4, towerTopY + 4);
        g.lineTo(x + towerWidth / 4, towerBottomY - 4);
        g.strokePath();

        // Eye on top of the tower.
        const eyeY = towerTopY - 14;
        g.fillStyle(0xfff3a8, 1);
        g.fillCircle(x, eyeY, 13);
        g.lineStyle(2, 0xffe06b, 0.9);
        g.strokeCircle(x, eyeY, 13);

        // Pupil / slit.
        g.fillStyle(0x3b2308, 1);
        g.fillCircle(x, eyeY, 5);
        g.lineStyle(2, 0xffe06b, 0.9);
        g.beginPath();
        g.moveTo(x, eyeY - 6);
        g.lineTo(x, eyeY + 6);
        g.strokePath();

        // Subtle glow rays from the eye.
        g.lineStyle(1.5, 0xfff3a8, 0.7);
        const rayLen = 20;
        g.beginPath();
        g.moveTo(x - rayLen, eyeY);
        g.lineTo(x - rayLen / 2, eyeY);
        g.moveTo(x + rayLen, eyeY);
        g.lineTo(x + rayLen / 2, eyeY);
        g.moveTo(x, eyeY - rayLen);
        g.lineTo(x, eyeY - rayLen / 2);
        g.moveTo(x, eyeY + rayLen);
        g.lineTo(x, eyeY + rayLen / 2);
        g.strokePath();

        // Depth: keep tower in front of units standing near the core.
        g.setDepth(y + 4000);

        // Gentle breathing animation so the eye feels alive.
        this.tweens.add({
            targets: g,
            scale: { from: 1, to: 1.03 },
            duration: 900,
            yoyo: true,
            repeat: -1
        });
    }

    private handleVictory() {
        if (this.battleState === 'victory') return;
        this.battleState = 'victory';
        this.showOverlay('Victory!', 'Prototype wave cleared. Ready for playtest.', 0x44ff88);
        this.events.emit('battle-victory');
    }

    private handleDefeat() {
        if (this.battleState === 'defeat') return;
        this.battleState = 'defeat';
        this.showOverlay('Fortress Destroyed', 'Rebuild and try again.', 0xff5566);
        this.events.emit('battle-defeat');
    }

    private updateCameraForPhase(phase: BattlePhase) {
        const camera = this.cameras.main;
        const duration = 600;

        if (phase === 'PREPARATION') {
            // Zoom in and center on the player's fortress grid (building phase),
            // so the spawn diamonds sit in the middle of the screen.
            const target = this.fortressCoreWorld;
            camera.pan(target.x, target.y, duration, 'Sine.easeInOut');
            camera.zoomTo(2.5, duration);
        } else {
            // Zoom back out to full battlefield view for fighting / wave clear.
            camera.pan(this.battlefield.centerX, this.battlefield.centerY, duration, 'Sine.easeInOut');
            camera.zoomTo(1, duration);
        }
    }

    private showOverlay(title: string, subtitle: string, tint: number) {
        if (this.overlayContainer) {
            this.overlayContainer.destroy();
        }
        const container = this.add.container(960, 540);
        const bg = this.add.rectangle(0, 0, 620, 260, 0x0b0c10, 0.9)
            .setStrokeStyle(3, tint, 0.8)
            .setOrigin(0.5);
        const titleText = this.add.text(0, -40, title, {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        titleText.setTint(tint);
        const subtitleText = this.add.text(0, 30, subtitle, {
            fontSize: '24px',
            color: '#bfc5d2'
        }).setOrigin(0.5);
        const restart = this.add.text(0, 100, 'Press R to restart prototype', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add([bg, titleText, subtitleText, restart]);
        container.setDepth(9000);
        this.overlayContainer = container;

        this.input.keyboard?.once('keydown-R', () => {
            this.scene.restart();
        });
    }

    private updateUnitAI() {
        const units = this.unitManager.getAllUnits();
        units.forEach(unit => {
            if (unit.isDead()) return;

            const currentPos = unit.getPosition();
            const bfLeft = this.battlefield.centerX - this.battlefield.width / 2;
            const bfTop = this.battlefield.centerY - this.battlefield.height / 2;
            const bounds = {
                minX: bfLeft + 5,
                maxX: bfLeft + this.battlefield.width - 5,
                minY: bfTop + 5,
                maxY: bfTop + this.battlefield.height - 5
            };

            if (currentPos.x < bounds.minX || currentPos.x > bounds.maxX ||
                currentPos.y < bounds.minY || currentPos.y > bounds.maxY) {
                const clampedX = Phaser.Math.Clamp(currentPos.x, bounds.minX, bounds.maxX);
                const clampedY = Phaser.Math.Clamp(currentPos.y, bounds.minY, bounds.maxY);
                (unit as any).teleportTo(clampedX, clampedY);
                return;
            }

            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            if (enemies.length === 0) return;

            let closestEnemy: any = null;
            let closestDistance = Infinity;
            enemies.forEach(enemy => {
                if (enemy.isDead()) return;
                const distance = Phaser.Math.Distance.Between(
                    unit.getPosition().x, unit.getPosition().y,
                    enemy.getPosition().x, enemy.getPosition().y
                );
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestEnemy = enemy;
                }
            });

            if (closestEnemy) {
                const targetPos = closestEnemy.getPosition();
                const dxToTarget = targetPos.x - currentPos.x;
                const dyToTarget = targetPos.y - currentPos.y;
                const distanceToTarget = Math.sqrt(dxToTarget * dxToTarget + dyToTarget * dyToTarget);

                const unitConfig = unit.getConfig();
                if (this.isRangedUnit(unitConfig.unitType) && distanceToTarget <= unit.getRange()) {
                    return;
                }

                if (unitConfig.unitType === UnitType.NINJA) {
                    const jumped = (unit as any).attemptNinjaJump(targetPos, this.time.now);
                    if (jumped) {
                        return;
                    }
                }

                const direction = { x: dxToTarget, y: dyToTarget };
                const nextX = currentPos.x + direction.x * 0.1;
                const nextY = currentPos.y + direction.y * 0.1;

                if (nextX < bounds.minX || nextX > bounds.maxX || nextY < bounds.minY || nextY > bounds.maxY) {
                    if (nextX < bounds.minX) direction.x = Math.max(0, direction.x);
                    if (nextX > bounds.maxX) direction.x = Math.min(0, direction.x);
                    if (nextY < bounds.minY) direction.y = Math.max(0, direction.y);
                    if (nextY > bounds.maxY) direction.y = Math.min(0, direction.y);
                }

                const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
                if (magnitude > 0) {
                    direction.x /= magnitude;
                    direction.y /= magnitude;
                    unit.move(direction);
                }
            }
        });
    }

    private checkCombat() {
        const currentTime = this.time.now;
        const units = this.unitManager.getAllUnits();
        units.forEach(unit => {
            if (unit.isDead()) return;
            if (!unit.canAttack(currentTime)) return;

            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
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
                const unitConfig = unit.getConfig();
                if (unitConfig.unitType === UnitType.RAIDER_BOSS) {
                    this.performBossAreaAttack(unit);
                } else if (this.isRangedUnit(unitConfig.unitType)) {
                    this.createProjectileAttack(unit, targetEnemy, unitConfig.unitType);
                } else if (this.isMeleeUnit(unitConfig.unitType)) {
                    unit.performMeleeAttack(targetEnemy, currentTime, this.unitManager as any, this.combatSystem as any);
                }
                unit.setLastAttackTime(currentTime);
            }
        });
    }

    private updateMedicHealing(currentTime: number): void {
        const HEAL_COOLDOWN = 1500; // ms
        const HEAL_RADIUS = 220;
        const HEAL_AMOUNT = 6;

        const allies = this.unitManager.getUnitsByTeam(1);
        const medics = allies.filter(u => u.getConfig().unitType === UnitType.COG_MEDIC_DRONE);

        medics.forEach(medic => {
            const id = medic.getId();
            const last = this.medicLastHeal.get(id) ?? 0;
            if (currentTime - last < HEAL_COOLDOWN) {
                return;
            }
            this.medicLastHeal.set(id, currentTime);

            const center = medic.getPosition();
            allies.forEach(ally => {
                if (ally.isDead()) return;
                const pos = ally.getPosition();
                const dist = Phaser.Math.Distance.Between(center.x, center.y, pos.x, pos.y);
                if (dist <= HEAL_RADIUS) {
                    (ally as any).heal(HEAL_AMOUNT);
                }
            });

            const g = this.add.graphics();
            g.setDepth(4000);
            g.setBlendMode(Phaser.BlendModes.ADD);
            g.lineStyle(2, 0x66ffcc, 0.8);
            g.strokeCircle(center.x, center.y, HEAL_RADIUS);
            this.tweens.add({
                targets: g,
                alpha: 0,
                duration: 400,
                onComplete: () => g.destroy()
            });
        });
    }

    private isRangedUnit(unitType: UnitType): boolean {
        return [
            UnitType.SNIPER,
            UnitType.DARK_MAGE,
            UnitType.CHRONOTEMPORAL,
            UnitType.COG_RAILGUNNER,
            UnitType.COG_THUNDER_CANNON,
            UnitType.RAIDER_BOMBER,
            UnitType.RAIDER_ARCHER
        ].includes(unitType);
    }

    private isMeleeUnit(unitType: UnitType): boolean {
        return [
            UnitType.WARRIOR,
            UnitType.NINJA,
            UnitType.SHOTGUNNER,
            UnitType.COG_SOLDIER,
            UnitType.COG_AEGIS_TANK,
            UnitType.RAIDER_GRUNT,
            UnitType.RAIDER_ROGUE
        ].includes(unitType);
    }

    private performBossAreaAttack(boss: any): void {
        const center = boss.getPosition();
        const RADIUS = 80; // roughly size of a fortress grid diamond

        const enemies = this.unitManager.getUnitsByTeam(1);
        enemies.forEach(enemy => {
            if (enemy.isDead()) return;
            const pos = enemy.getPosition();
            const dist = Phaser.Math.Distance.Between(center.x, center.y, pos.x, pos.y);
            if (dist <= RADIUS) {
                this.combatSystem.dealDamage(boss as any, enemy as any, boss.getDamage());
            }
        });

        // Visual ground slam indicator
        const g = this.add.graphics();
        g.setDepth(6000);
        g.setBlendMode(Phaser.BlendModes.ADD);
        g.lineStyle(3, 0xffaa55, 0.9);
        g.strokeCircle(center.x, center.y, RADIUS);
        this.tweens.add({
            targets: g,
            alpha: 0,
            duration: 250,
            onComplete: () => g.destroy()
        });
    }

    private createProjectileAttack(attackerUnit: any, targetUnit: any, unitType: UnitType) {
        const attackerPos = attackerUnit.getPosition();
        const targetPos = targetUnit.getPosition();
        let speed = 320;
        switch (unitType) {
            case UnitType.SNIPER:
                speed = 600;
                break;
            case UnitType.COG_THUNDER_CANNON:
                speed = 220;
                break;
            case UnitType.DARK_MAGE:
                speed = 220;
                break;
            case UnitType.CHRONOTEMPORAL:
                speed = 250;
                break;
            case UnitType.COG_RAILGUNNER:
                speed = 420;
                break;
            case UnitType.RAIDER_ARCHER:
                speed = 420;
                break;
        }

        this.projectileSystem.createProjectile({
            startX: attackerPos.x,
            startY: attackerPos.y,
            targetX: targetPos.x,
            targetY: targetPos.y,
            unitType,
            damage: attackerUnit.getDamage(),
            speed,
            attackerTeam: attackerUnit.getTeam()
        });

        const distance = Phaser.Math.Distance.Between(attackerPos.x, attackerPos.y, targetPos.x, targetPos.y);
        const travelTime = (distance / speed) * 1000;

        this.time.delayedCall(travelTime, () => {
            if (!targetUnit.isDead()) {
                this.combatSystem.dealDamage(attackerUnit, targetUnit, attackerUnit.getDamage());
            }
        });
    }

    private createEnvironmentalObjects() {
        const numTrees = 24;
        const numBushes = 32;
        const exclusionZones = [
            { x: 175, y: 340, width: 350, height: 400 },
            { x: 1395, y: 340, width: 350, height: 400 },
            { x: 760, y: 440, width: 400, height: 200 }
        ];

        for (let i = 0; i < numTrees; i++) {
            let x = 0, y = 0, attempts = 0;
            do {
                x = Phaser.Math.Between(150, 1770);
                y = Phaser.Math.Between(150, 930);
                attempts++;
            } while (attempts < 40 && this.isInExclusionZone(x, y, exclusionZones));
            if (attempts < 40) {
                this.createTree(x, y);
            }
        }

        for (let i = 0; i < numBushes; i++) {
            let x = 0, y = 0, attempts = 0;
            do {
                x = Phaser.Math.Between(150, 1770);
                y = Phaser.Math.Between(150, 930);
                attempts++;
            } while (attempts < 40 && this.isInExclusionZone(x, y, exclusionZones));
            if (attempts < 40) {
                this.createBush(x, y);
            }
        }
    }

    private isInExclusionZone(x: number, y: number, zones: Array<{ x: number; y: number; width: number; height: number }>): boolean {
        return zones.some(zone => x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height);
    }

    private createTree(x: number, y: number) {
        const tree = this.add.graphics();
        tree.fillStyle(0x8b4513, 1);
        tree.fillRect(x - 4, y - 8, 8, 16);
        tree.fillStyle(0x228b22, 0.8);
        tree.fillCircle(x, y - 20, 16);
        tree.fillStyle(0x32cd32, 0.7);
        tree.fillCircle(x - 8, y - 15, 12);
        tree.fillCircle(x + 8, y - 15, 12);
        tree.fillStyle(0x006400, 0.6);
        tree.fillCircle(x, y - 10, 10);
        this.isometricRenderer.addToRenderGroup(tree);
    }

    private createBush(x: number, y: number) {
        const bush = this.add.graphics();
        bush.fillStyle(0x228b22, 0.7);
        bush.fillCircle(x, y, 8);
        bush.fillStyle(0x32cd32, 0.6);
        bush.fillCircle(x - 6, y + 2, 6);
        bush.fillCircle(x + 6, y + 2, 6);
        bush.fillStyle(0x006400, 0.5);
        bush.fillCircle(x, y + 4, 5);
        this.isometricRenderer.addToRenderGroup(bush);
    }
}
