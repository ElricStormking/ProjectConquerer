import Phaser from 'phaser';
import { DataManager } from '../systems/DataManager';

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
        // Load Data CSVs
        this.load.text('units_data', 'data/units.csv');
        this.load.text('cards_data', 'data/cards.csv');
        this.load.text('waves_data', 'data/waves.csv');
        this.load.text('skills_data', 'data/skills.csv');
        this.load.text('buildings_data', 'data/buildings.csv');
        this.load.text('relics_data', 'data/relics.csv');
        this.load.text('map_nodes_data', 'data/map_nodes.csv');

        // Load character spritesheets with full frame dimensions (96x96 for complete character)
        this.load.image('world_bg', 'assets/gamemap_01.png');
        // Cog Dominion buildings
        this.load.image('building_cannon_tower', 'assets/buildings/cog_buildings/Building_CannonTower.png');
        this.load.image('building_armor_shop', 'assets/buildings/cog_buildings/Building_ArmorShop.png');
        this.load.image('building_fortress_core', 'assets/buildings/cog_buildings/Building_FortressCore.png');
        // Card portraits (unit and spell cards)
        this.load.image('card_soldier', 'assets/cards/card_soldier.png');
        this.load.image('card_railgunner', 'assets/cards/card_railgunner.png');
        this.load.image('card_tank', 'assets/cards/card_tank.png');
        this.load.image('card_medic', 'assets/cards/card_medic.png');
        this.load.image('card_cannon', 'assets/cards/card_cannon.png');
        this.load.image('card_cannon_tower', 'assets/cards/card_cannon_tower.png');
        this.load.image('card_thunder_mage', 'assets/cards/card_thunder_mage.png');
        this.load.image('card_spell_barrier', 'assets/cards/card_spell_barrier.png');
        this.load.image('card_spell_overclock', 'assets/cards/card_spell_overclock.png');

        // Victory / SFX
        this.load.audio('sfx_victory', 'assets/audio/sounds/victory.mp3');
        // Prototype background music
        this.load.audio('bgm_dragonbattle', 'assets/audio/bgm/bgm_01_dragonbattle.mp3');
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
        // Initialize DataManager with loaded CSVs
        DataManager.getInstance().parse(this.cache);

        this.scene.start('BattleScene');
        this.scene.start('UIScene');
    }
}