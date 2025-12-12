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
        this.load.text('unit_skills_data', 'data/unit_skills.csv');
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
        // Commander portraits (Jade Dynasty starters)
        this.load.image('commander_long_jin', 'assets/commanders/jade_commanders/Long_Jin.png');
        this.load.image('commander_hanami_reika', 'assets/commanders/jade_commanders/Hanami_Reika.png');
        this.load.image('commander_kasumi_nightwind', 'assets/commanders/jade_commanders/Kasumi_Nightwind.png');
        // Commander portraits (Eternal Frost Clan)
        this.load.image('commander_azariel', 'assets/commanders/nightborn_commander/Azariel_Lich_King.png');
        this.load.image('commander_bellucci', 'assets/commanders/nightborn_commander/Bellucci_The Blood_Queen.png');
        this.load.image('commander_zhaquille', 'assets/commanders/nightborn_commander/Zhaquille_Frankenstein.png');
        // Jade Dynasty unit card art
        this.load.image('card_jade_azure_spear', 'assets/cards/Jade_dynasty/units/Azure_Spear_Chargers.png');
        this.load.image('card_jade_chi_dragoon', 'assets/cards/Jade_dynasty/units/Chi_Dragoon.png');
        this.load.image('card_jade_storm_monks', 'assets/cards/Jade_dynasty/units/Storm_Monks.png');
        this.load.image('card_jade_shuriken_ninjas', 'assets/cards/Jade_dynasty/units/Shuriken_Ninjas.png');
        this.load.image('card_jade_shadowblade_assassins', 'assets/cards/Jade_dynasty/units/Shadowblade _Assassins.png');
        this.load.image('card_jade_halberd_guardian', 'assets/cards/Jade_dynasty/units/Jade Halberd Guardian.png');
        this.load.image('card_jade_crossbow_gunners', 'assets/cards/Jade_dynasty/units/Repeating_Crossbow_Gunners.png');
        this.load.image('card_jade_shrine_oni', 'assets/cards/Jade_dynasty/units/Shrine_Oni_Guardian.png');
        this.load.image('card_jade_paper_doll', 'assets/cards/Jade_dynasty/units/Paper_Doll_Guardian.png');
        this.load.image('card_jade_blue_oni', 'assets/cards/Jade_dynasty/units/Blue_Oni_Bruiser.png');
        this.load.image('card_jade_spirit_lantern', 'assets/cards/Jade_dynasty/units/Spirit_Lantern_Healer.png');
        this.load.image('card_jade_shikigami_fox', 'assets/cards/Jade_dynasty/units/Golden_Shikigami_Fox.png');
        // Jade Dynasty buildings (card art)
        this.load.image('card_jade_war_drum', 'assets/cards/Jade_dynasty/buildings/War_Drum_of_the_South_Wind.png.png');
        this.load.image('card_jade_resonance_tower', 'assets/cards/Jade_dynasty/buildings/Chi_Resonance_Tower.png.png');
        this.load.image('card_jade_healing_shrine', 'assets/cards/Jade_dynasty/buildings/Jade_Healing_Shrine.png.png');
        this.load.image('card_jade_spirit_bell', 'assets/cards/Jade_dynasty/buildings/Spirit_Bell_Shrine.png.png');
        this.load.image('card_jade_smoke_bomb', 'assets/cards/Jade_dynasty/buildings/Smoke_Bomb_Generator.png.png');
        this.load.image('card_jade_archer_turret', 'assets/cards/Jade_dynasty/buildings/Jade_Archer_Turret.png.png');
        // Jade Dynasty modules (card art)
        this.load.image('card_jade_amplifier', 'assets/cards/Jade_dynasty/Modules/Chi_Amplifier.png.png');
        this.load.image('card_jade_spirit_gate', 'assets/cards/Jade_dynasty/Modules/Spirit_Gate.png.png');
        this.load.image('card_jade_feng_shui_ward', 'assets/cards/Jade_dynasty/Modules/Feng_Shui_Ward.png.png');
        this.load.image('card_jade_ninja_warp', 'assets/cards/Jade_dynasty/Modules/Ninja_Warp_Pad.png.png');
        this.load.image('card_jade_shield_node', 'assets/cards/Jade_dynasty/Modules/Jade_Shield.png.png');
        this.load.image('card_jade_chi_reactor', 'assets/cards/Jade_dynasty/Modules/Chi_Reactor.png.png');

        // Stage maps (world map backgrounds)
        this.load.image('stage_1_map', 'assets/stage_map/map_stage_jade.png');
        this.load.image('stage_frost_map', 'assets/stage_map/map_stage_eternal.png');
        // Battle backgrounds (stage-specific)
        this.load.image('battle_bg_stage_1', 'assets/background/gamemap_jade_01.png');
        
        // Fortress grid CSVs (metadata + tilemap pairs)
        this.load.text('fortress_grid_jade_dynasty_01_meta', 'data/fortress_grids/fortress_jade_dynasty_01.csv');
        this.load.text('fortress_grid_jade_dynasty_01_tilemap', 'data/fortress_grids/fortress_jade_dynasty_01_grid.csv');

        // Load unit spritesheets with full frame dimensions (96x96 for complete unit)
        this.load.image('world_bg', 'assets/gamemap_01.png');
        
        // Fortress images
        // Default testing fortress art now uses Jade Dynasty
        this.load.image('fortress_jade_dynasty_01', 'assets/fortress/fortress_jade_dynasty_01.png');
        
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
        // Overclock uses the barrier art as a placeholder (missing dedicated art)
        this.load.image('card_spell_overclock', 'assets/cards/card_spell_barrier.png');

        // Eternal Frost Clan card art (units / spells / buildings / modules)
        // Units
        this.load.image('card_frost_flesh_weaver', 'assets/cards/Eternal_frost_clan/units/Flesh_Weaver.png');
        this.load.image('card_frost_bound_spectre', 'assets/cards/Eternal_frost_clan/units/Bound_Spectre.png');
        this.load.image('card_frost_bloodline_noble', 'assets/cards/Eternal_frost_clan/units/Bloodline_Noble.png');
        this.load.image('card_frost_abomination', 'assets/cards/Eternal_frost_clan/units/Abomination.png');
        this.load.image('card_frost_forbidden_scientist', 'assets/cards/Eternal_frost_clan/units/Forbidden_Scientist.png');
        this.load.image('card_frost_screaming_coffin', 'assets/cards/Eternal_frost_clan/units/Screaming_Coffin.png');
        this.load.image('card_frost_flesh_crawler', 'assets/cards/Eternal_frost_clan/units/Flesh_Crawler.png');
        this.load.image('card_frost_shade_servant', 'assets/cards/Eternal_frost_clan/units/Shade_Servant.png');
        this.load.image('card_frost_putrid_archer', 'assets/cards/Eternal_frost_clan/units/Putrid_Archer.png');
        this.load.image('card_frost_cursed_walker', 'assets/cards/Eternal_frost_clan/units/Cursed Walker.png');
        this.load.image('card_frost_agony_screamer', 'assets/cards/Eternal_frost_clan/units/Agony_Screamer.png');
        this.load.image('card_frost_eternal_watcher', 'assets/cards/Eternal_frost_clan/units/Eternal_Watcher.png');
        this.load.image('card_frost_flesh_titan', 'assets/cards/Eternal_frost_clan/units/Flesh_Titan.png');

        // Spells
        this.load.image('card_frost_spell_living_sacrifice', 'assets/cards/Eternal_frost_clan/spell/Spell_Living_Sacrifice.png');
        this.load.image('card_frost_spell_soul_shackles', 'assets/cards/Eternal_frost_clan/spell/Spell_Soul_Shackles.png');
        this.load.image('card_frost_spell_pact_of_blood', 'assets/cards/Eternal_frost_clan/spell/Spell_Pact_of_Blood.png');
        this.load.image('card_frost_spell_plague_infestation', 'assets/cards/Eternal_frost_clan/spell/Spell_Plague_Infestation.png');
        this.load.image('card_frost_spell_forbidden_transmutation', 'assets/cards/Eternal_frost_clan/spell/Spell_Forbidden_Transmutation.png');
        this.load.image('card_frost_spell_essence_burst', 'assets/cards/Eternal_frost_clan/spell/Spell_Essence_Burst.png');
        this.load.image('card_frost_spell_blood_rite', 'assets/cards/Eternal_frost_clan/spell/Spell_Blood_Rite.png');

        // Buildings / Structures
        this.load.image('card_frost_living_altar', 'assets/cards/Eternal_frost_clan/buildings/Living_Altar.png');
        this.load.image('card_frost_taboo_blood_pool', 'assets/cards/Eternal_frost_clan/buildings/Taboo_Blood_Pool.png');
        this.load.image('card_frost_torment_spire', 'assets/cards/Eternal_frost_clan/buildings/Torment_Spire.png');
        this.load.image('card_frost_flesh_repair_device', 'assets/cards/Eternal_frost_clan/buildings/Flesh_Repair_ Device.png');
        this.load.image('card_frost_soul_harvester', 'assets/cards/Eternal_frost_clan/buildings/Soul_Harvester.png');
        this.load.image('card_frost_abominable_hatchery', 'assets/cards/Eternal_frost_clan/buildings/Abominable_Hatchery.png');
        this.load.image('card_frost_wall_of_screams', 'assets/cards/Eternal_frost_clan/buildings/Wall_of_Screams.png');

        // Modules
        this.load.image('card_frost_necrotic_weaving', 'assets/cards/Eternal_frost_clan/modules/NecroticWeaving.png');
        this.load.image('card_frost_eternal_servitude', 'assets/cards/Eternal_frost_clan/modules/EternalServitude.png');
        this.load.image('card_frost_blood_enhancement', 'assets/cards/Eternal_frost_clan/modules/BloodEnhancement.png');
        this.load.image('card_frost_agony_core', 'assets/cards/Eternal_frost_clan/modules/AgonyCore.png');
        this.load.image('card_frost_plague_infusion', 'assets/cards/Eternal_frost_clan/modules/Plague Infusion.png');
        this.load.image('card_frost_forbidden_regeneration', 'assets/cards/Eternal_frost_clan/modules/ForbiddenRegeneration.png');
        this.load.image('card_frost_soul_pact', 'assets/cards/Eternal_frost_clan/modules/SoulPact.png');

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

        // Jade Dynasty units
        this.load.spritesheet('jade_azure_spear', 'assets/units/Jade_Dynasty/army_Azure_Spear_Chargers/army_Azure_Spear_Chargers.png', { frameWidth: 160, frameHeight: 160 });
        this.load.json('jade_azure_spear_anim', 'assets/units/Jade_Dynasty/army_Azure_Spear_Chargers/army_Azure_Spear_Chargers_an.json');
        
        this.load.spritesheet('jade_storm_monks', 'assets/units/Jade_Dynasty/army_Storm_Monks/army_Storm_Monks.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('jade_storm_monks_anim', 'assets/units/Jade_Dynasty/army_Storm_Monks/army_Storm_Monks_an.json');

        this.load.spritesheet('jade_crossbow_gunners', 'assets/units/Jade_Dynasty/army_Repeating_Crossbow_Gunners/army_Repeating_Crossbow_Gunners.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('jade_crossbow_gunners_anim', 'assets/units/Jade_Dynasty/army_Repeating_Crossbow_Gunners/army_Repeating_Crossbow_Gunners_an.json');

        this.load.spritesheet('jade_halberd_guardian', 'assets/units/Jade_Dynasty/army_Jade_Halberd_Guardian/army_Jade_Halberd_Guardian.png', { frameWidth: 128, frameHeight: 128 });
        this.load.json('jade_halberd_guardian_anim', 'assets/units/Jade_Dynasty/army_Jade_Halberd_Guardian/army_Jade_Halberd_Guardian_an.json');

        this.load.spritesheet('jade_shrine_oni', 'assets/units/Jade_Dynasty/army_Shrine_Oni_Guardian/army_Shrine_Oni_Guardian.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('jade_shrine_oni_anim', 'assets/units/Jade_Dynasty/army_Shrine_Oni_Guardian/army_Shrine_Oni_Guardian_an.json');

        this.load.spritesheet('jade_shikigami_fox', 'assets/units/Jade_Dynasty/army_Golden_Shikigami_Fox/army_Golden_Shikigami_Fox.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('jade_shikigami_fox_anim', 'assets/units/Jade_Dynasty/army_Golden_Shikigami_Fox/army_Golden_Shikigami_Fox_an.json');

        // Placeholder: reuse existing sheets for other Jade units until unique sheets provided
        this.load.spritesheet('jade_chi_dragoon', 'assets/units/Jade_Dynasty/army_Jade_Halberd_Guardian/army_Jade_Halberd_Guardian.png', { frameWidth: 128, frameHeight: 128 });
        this.load.json('jade_chi_dragoon_anim', 'assets/units/Jade_Dynasty/army_Jade_Halberd_Guardian/army_Jade_Halberd_Guardian_an.json');
        
        this.load.spritesheet('jade_shuriken_ninjas', 'assets/units/Jade_Dynasty/army_Repeating_Crossbow_Gunners/army_Repeating_Crossbow_Gunners.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('jade_shuriken_ninjas_anim', 'assets/units/Jade_Dynasty/army_Repeating_Crossbow_Gunners/army_Repeating_Crossbow_Gunners_an.json');

        this.load.spritesheet('jade_shadowblade_assassins', 'assets/units/Jade_Dynasty/army_Storm_Monks/army_Storm_Monks.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('jade_shadowblade_assassins_anim', 'assets/units/Jade_Dynasty/army_Storm_Monks/army_Storm_Monks_an.json');

        this.load.spritesheet('jade_spirit_lantern', 'assets/units/Jade_Dynasty/army_Golden_Shikigami_Fox/army_Golden_Shikigami_Fox.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('jade_spirit_lantern_anim', 'assets/units/Jade_Dynasty/army_Golden_Shikigami_Fox/army_Golden_Shikigami_Fox_an.json');
        
        this.load.spritesheet('jade_paper_doll', 'assets/units/Jade_Dynasty/army_Shrine_Oni_Guardian/army_Shrine_Oni_Guardian.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('jade_paper_doll_anim', 'assets/units/Jade_Dynasty/army_Shrine_Oni_Guardian/army_Shrine_Oni_Guardian_an.json');

        this.load.spritesheet('jade_blue_oni', 'assets/units/Jade_Dynasty/army_Shrine_Oni_Guardian/army_Shrine_Oni_Guardian.png', { frameWidth: 96, frameHeight: 96 });
        this.load.json('jade_blue_oni_anim', 'assets/units/Jade_Dynasty/army_Shrine_Oni_Guardian/army_Shrine_Oni_Guardian_an.json');

        // Eternal Frost Clan units
        this.load.spritesheet('frost_shade_servant', 'assets/units/Eternal_Frost_Clan/army_Shade_Servant/army_Shade_Servant.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('frost_shade_servant_anim', 'assets/units/Eternal_Frost_Clan/army_Shade_Servant/army_Shade_Servant_an.json');
        
        this.load.spritesheet('frost_putrid_archer', 'assets/units/Eternal_Frost_Clan/army_Putrid_Archer/army_Putrid_Archer.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('frost_putrid_archer_anim', 'assets/units/Eternal_Frost_Clan/army_Putrid_Archer/army_Putrid_Archer_an.json');

        this.load.spritesheet('frost_eternal_watcher', 'assets/units/Eternal_Frost_Clan/army_Eternal_Watcher/army_Eternal_Watcher.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('frost_eternal_watcher_anim', 'assets/units/Eternal_Frost_Clan/army_Eternal_Watcher/army_Eternal_Watcher_an.json');

        this.load.spritesheet('frost_cursed_walker', 'assets/units/Eternal_Frost_Clan/army_Cursed_Walker/army_Cursed_Walker.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('frost_cursed_walker_anim', 'assets/units/Eternal_Frost_Clan/army_Cursed_Walker/army_Cursed_Walker_an.json');

        this.load.spritesheet('frost_bloodline_noble', 'assets/units/Eternal_Frost_Clan/army_Bloodline_Noble/army_Bloodline_Noble.png', { frameWidth: 192, frameHeight: 192 });
        this.load.json('frost_bloodline_noble_anim', 'assets/units/Eternal_Frost_Clan/army_Bloodline_Noble/army_Bloodline_Noble_an.json');

        this.load.spritesheet('frost_agony_screamer', 'assets/units/Eternal_Frost_Clan/army_Agony_Screamer/army_Agony_Screamer.png', { frameWidth: 64, frameHeight: 64 });
        this.load.json('frost_agony_screamer_anim', 'assets/units/Eternal_Frost_Clan/army_Agony_Screamer/army_Agony_Screamer_an.json');
    }

    create() {
        // Initialize DataManager with loaded CSVs
        DataManager.getInstance().parse(this.cache);

        // Go to title menu after loading
        this.scene.start('TitleMenuScene');
    }
}