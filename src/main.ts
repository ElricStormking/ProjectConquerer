import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { BattleScene } from './scenes/BattleScene';
import { UIScene } from './scenes/UIScene';
import { SkillSelectionScene } from './scenes/SkillSelectionScene';
import { CardRewardScene } from './scenes/CardRewardScene';
import { StageMapScene } from './scenes/StageMapScene';
import { EventScene } from './scenes/EventScene';
import { ShopScene } from './scenes/ShopScene';
import { RestScene } from './scenes/RestScene';
import { RewardScene } from './scenes/RewardScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent: 'game-container',
    backgroundColor: '#2d2d2d',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1920,
        height: 1080
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: { x: 0, y: 0 },
            debug: false,
            enableSleeping: true,
            constraintIterations: 2,
            positionIterations: 6,
            velocityIterations: 4
        }
    },
    fps: {
        target: 30,
        forceSetTimeOut: true
    },
    render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false,
        batchSize: 2048,
        maxLights: 8
    },
    scene: [
        BootScene,
        PreloadScene,
        StageMapScene,
        BattleScene,
        UIScene,
        SkillSelectionScene,
        CardRewardScene,
        EventScene,
        ShopScene,
        RestScene,
        RewardScene
    ]
};

new Phaser.Game(config);

// Let Phaser Scale Manager handle resizing with FIT; no manual resize to avoid
// skewed world coordinates or CSS scaling artifacts.