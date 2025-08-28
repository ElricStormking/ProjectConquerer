import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        this.createLoadingBar();
        this.loadAssets();
    }

    private createLoadingBar() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                color: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);
        
        const percentText = this.make.text({
            x: width / 2,
            y: height / 2,
            text: '0%',
            style: {
                font: '18px monospace',
                color: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);
        
        this.load.on('progress', (value: number) => {
            percentText.setText(parseInt((value * 100).toString()) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
        });
    }

    private loadAssets() {
        // Load character spritesheets with full frame dimensions (96x96 for complete character)
        this.load.image('world_bg', 'assets/gamemap_01.jpg');
        this.load.spritesheet('chronotemporal', 'assets/characters/Chronotemporal.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('chronotemporal_anim', 'assets/characters/Chronotemporal.json');
        
        this.load.spritesheet('sniper', 'assets/characters/Sniper.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('sniper_anim', 'assets/characters/Sniper.json');
        
        this.load.spritesheet('dark_mage', 'assets/characters/Dark Mage.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('dark_mage_anim', 'assets/characters/Dark Mage.json');
        
        this.load.spritesheet('warrior', 'assets/characters/warrior.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('warrior_anim', 'assets/characters/warrior.json');
        
        this.load.spritesheet('ninja', 'assets/characters/ninja.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('ninja_anim', 'assets/characters/ninja.json');
        
        this.load.spritesheet('shotgunner', 'assets/characters/Shotgunner.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('shotgunner_anim', 'assets/characters/Shotgunner.json');
    }

    create() {
        this.scene.start('BattleScene');
        this.scene.start('UIScene');
    }
}