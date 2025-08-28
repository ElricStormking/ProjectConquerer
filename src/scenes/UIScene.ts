import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
    private fpsText!: Phaser.GameObjects.Text;
    private unitCountText!: Phaser.GameObjects.Text;
    private performanceText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private xpBar!: Phaser.GameObjects.Graphics;
    private xpBarBg!: Phaser.GameObjects.Graphics;
    
    constructor() {
        super({ key: 'UIScene' });
    }

    create() {
        this.setupDebugUI();
        this.setupBattleUI();
        this.setupLevelUI();
        this.setupEventListeners();
    }

    private setupDebugUI() {
        const debugContainer = this.add.container(10, 10);
        
        this.fpsText = this.add.text(0, 0, 'FPS: 30', {
            font: '14px monospace',
            color: '#00ff00'
        });
        
        this.unitCountText = this.add.text(0, 20, 'Units: 0', {
            font: '14px monospace',
            color: '#ffffff'
        });
        
        this.performanceText = this.add.text(0, 40, 'Bodies: 0 / 160', {
            font: '14px monospace',
            color: '#ffffff'
        });
        
        debugContainer.add([this.fpsText, this.unitCountText, this.performanceText]);
    }

    private setupBattleUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const deployButton = this.add.text(width - 150, height - 60, 'DEPLOY', {
            font: 'bold 20px sans-serif',
            color: '#ffffff',
            backgroundColor: '#4444ff',
            padding: { x: 20, y: 10 }
        }).setInteractive();
        
        deployButton.on('pointerdown', () => {
            this.events.emit('deploy-units');
        });
        
        deployButton.on('pointerover', () => {
            deployButton.setBackgroundColor('#6666ff');
        });
        
        deployButton.on('pointerout', () => {
            deployButton.setBackgroundColor('#4444ff');
        });
    }
    
    private setupLevelUI() {
        const width = this.cameras.main.width;
        
        // Level display
        this.levelText = this.add.text(width / 2, 30, 'Level 1', {
            font: 'bold 24px sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // XP Bar background
        this.xpBarBg = this.add.graphics();
        this.xpBarBg.fillStyle(0x333333, 1);
        this.xpBarBg.fillRect(width / 2 - 200, 50, 400, 10);
        
        // XP Bar fill
        this.xpBar = this.add.graphics();
        
        this.updateXPBar(0, 100, 1);
    }
    
    private updateXPBar(currentXP: number, requiredXP: number, level: number) {
        const width = this.cameras.main.width;
        const percentage = requiredXP > 0 ? (currentXP / requiredXP) : 0;
        
        // Update level text
        this.levelText.setText(`Level ${level}`);
        
        // Update XP bar
        this.xpBar.clear();
        this.xpBar.fillStyle(0x00ff00, 1);
        this.xpBar.fillRect(width / 2 - 200, 50, 400 * Math.min(1, percentage), 10);
    }
    
    private setupEventListeners() {
        // Listen for XP and level changes from the battle scene
        const battleScene = this.scene.get('BattleScene');
        
        battleScene.events.on('xp-gained', (data: any) => {
            // Get level system from battle scene to calculate progress
            const levelUpSystem = (battleScene as any).levelUpSystem;
            if (levelUpSystem) {
                const progress = levelUpSystem.getXPProgressToNextLevel();
                this.updateXPBar(progress.current, progress.required, data.currentLevel);
            }
        });
        
        battleScene.events.on('level-up', () => {
            // Flash effect on level up
            this.cameras.main.flash(500, 255, 255, 0);
        });
    }

    update() {
        const fps = Math.round(this.game.loop.actualFps);
        this.fpsText.setText(`FPS: ${fps}`);
        this.fpsText.setColor(fps < 25 ? '#ff0000' : fps < 28 ? '#ffff00' : '#00ff00');
        
        const battleScene = this.scene.get('BattleScene');
        if (battleScene && battleScene.scene.isActive()) {
            const unitManager = (battleScene as any).unitManager;
            if (unitManager) {
                this.unitCountText.setText(`Units: ${unitManager.getUnitCount?.() || 0}`);
            }
            
            const physicsManager = (battleScene as any).physicsManager;
            if (physicsManager) {
                const bodyCount = physicsManager.getActiveBodyCount?.() || 0;
                this.performanceText.setText(`Bodies: ${bodyCount} / 160`);
                this.performanceText.setColor(bodyCount > 140 ? '#ff0000' : bodyCount > 120 ? '#ffff00' : '#ffffff');
            }
        }
    }
}