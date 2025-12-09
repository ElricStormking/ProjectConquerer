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
        this.load.text('stages_data', 'data/stages.csv');
        this.load.text('relics_data', 'data/relics.csv');
        this.load.text('events_data', 'data/events.csv');
        this.load.text('map_nodes_data', 'data/map_nodes.csv');
        this.load.text('factions_data', 'data/factions.csv');
        this.load.text('commanders_data', 'data/commanders.csv');
        
        // Title screen
        this.load.image('title_bg', 'assets/ui/ui_title_menu/TitleScreen.png');
        this.load.image('ui_button_on', 'assets/ui/ui_title_menu/button_on.png');
        this.load.image('ui_button_off', 'assets/ui/ui_title_menu/button_off.png');

        // Stage maps (world map backgrounds)
        this.load.image('stage_1_map', 'assets/stage_map/map_stage_jade.png');
        // Battle backgrounds (stage-specific)
        this.load.image('battle_bg_stage_1', 'assets/background/gamemap_jade_01.png');
        
        // Load unit spritesheets with full frame dimensions (96x96 for complete unit)
        this.load.image('world_bg', 'assets/gamemap_01.png');
        
        // Fortress images (use Jade Dynasty as default test fortress art)
        this.load.image('fortress_jade_dynasty_01', 'assets/fortress/fortress_jade_dynasty_01.png');
        // Alias for jade_palace fortress id to avoid missing texture
        this.load.image('jade_palace', 'assets/fortress/fortress_jade_dynasty_01.png');
        
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
        this.load.spritesheet('chronotemporal', 'assets/units/Chronotemporal.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('chronotemporal_anim', 'assets/units/Chronotemporal.json');
        
        this.load.spritesheet('sniper', 'assets/units/Sniper.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('sniper_anim', 'assets/units/Sniper.json');
        
        this.load.spritesheet('dark_mage', 'assets/units/Dark Mage.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('dark_mage_anim', 'assets/units/Dark Mage.json');
        
        this.load.spritesheet('warrior', 'assets/units/warrior.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('warrior_anim', 'assets/units/warrior.json');
        
        this.load.spritesheet('ninja', 'assets/units/ninja.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('ninja_anim', 'assets/units/ninja.json');
        
        this.load.spritesheet('shotgunner', 'assets/units/Shotgunner.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('shotgunner_anim', 'assets/units/Shotgunner.json');
        
        // Cog Dominion units
        this.load.spritesheet('camp1_soldier1', 'assets/units/Cog_Dominion/cog_aegis_tank/camp1_soldier1.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('camp1_soldier1_anim', 'assets/units/Cog_Dominion/cog_aegis_tank/camp1_soldier1_an.json');
        
        this.load.spritesheet('camp1_soldier2', 'assets/units/Cog_Dominion/cog_thunder_mage/camp1_soldier2.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('camp1_soldier2_anim', 'assets/units/Cog_Dominion/cog_thunder_mage/camp1_soldier2_an.json');
        
        this.load.spritesheet('camp1_soldier3', 'assets/units/Cog_Dominion/cog_railgunner/camp1_soldier3.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('camp1_soldier3_anim', 'assets/units/Cog_Dominion/cog_railgunner/camp1_soldier3_an.json');
    }

    create() {
        // Initialize DataManager with loaded CSVs
        DataManager.getInstance().parse(this.cache);

        // Go to title menu after loading
        this.scene.start('TitleMenuScene');
    }
}