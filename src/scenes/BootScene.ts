import Phaser from 'phaser';
import { registerAllCommanderSkills } from '../systems/skills';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this.load.setBaseURL('./assets/');
    }

    create() {
        // Register all commander active skills
        registerAllCommanderSkills();
        
        this.setupMobileOptimizations();
        this.scene.start('PreloadScene');
    }

    private setupMobileOptimizations() {
        // Pixel art is already configured in main.ts config
        
        if (this.sys.game.device.os.iOS || this.sys.game.device.os.android) {
            // Mobile-specific optimizations can be added here
        }
        
        const matterPhysics = this.matter;
        matterPhysics.world.autoUpdate = false;
        
        this.time.addEvent({
            delay: 1000 / 60,
            loop: true,
            callback: () => {
                const time = this.time.now;
                const delta = 1000 / 60;
                matterPhysics.world.update(time, delta);
            }
        });
    }
}