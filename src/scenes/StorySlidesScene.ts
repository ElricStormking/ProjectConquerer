import Phaser from 'phaser';
import { getStorySlideNarration, getStorySlidePath } from '../data/StorySlides';

interface StorySlidesSceneData {
    slideKeys: string[];
    returnSceneKey?: string;
    nextSceneKey?: string;
    nextSceneData?: Record<string, unknown>;
    onComplete?: () => void;
}

export class StorySlidesScene extends Phaser.Scene {
    private sceneData: StorySlidesSceneData = { slideKeys: [] };
    private slideKeys: string[] = [];
    private slideIndex = 0;
    private slideImage?: Phaser.GameObjects.Image;
    private hintText?: Phaser.GameObjects.Text;
    private missingText?: Phaser.GameObjects.Text;
    private loadingText?: Phaser.GameObjects.Text;
    private narrationText?: Phaser.GameObjects.Text;
    private narrationShade?: Phaser.GameObjects.Graphics;
    private narrationTween?: Phaser.Tweens.Tween;
    private clickZone?: Phaser.GameObjects.Zone;
    private returnSceneKey?: string;
    private nextSceneKey?: string;
    private nextSceneData?: Record<string, unknown>;
    private onComplete?: () => void;

    constructor() {
        super({ key: 'StorySlidesScene' });
    }

    init(data: StorySlidesSceneData): void {
        this.sceneData = data ?? { slideKeys: [] };
    }

    create(data?: StorySlidesSceneData): void {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x000000);

        // Reset any stale references from prior runs.
        this.slideImage?.destroy();
        this.slideImage = undefined;
        this.hintText?.destroy();
        this.hintText = undefined;
        this.missingText?.destroy();
        this.missingText = undefined;
        this.loadingText?.destroy();
        this.loadingText = undefined;
        this.clearNarration();
        this.clickZone?.destroy();
        this.clickZone = undefined;

        const payload = data ?? this.sceneData ?? { slideKeys: [] };
        this.slideKeys = payload.slideKeys ?? [];
        this.slideIndex = 0;
        this.returnSceneKey = payload.returnSceneKey;
        this.nextSceneKey = payload.nextSceneKey;
        this.nextSceneData = payload.nextSceneData;
        this.onComplete = payload.onComplete;

        if (this.slideKeys.length === 0) {
            this.finishSlides();
            return;
        }

        this.hintText = this.add.text(width - 24, height - 24, 'Click to continue', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f0dba5'
        }).setOrigin(1);

        this.loadingText = this.add.text(width / 2, height / 2, 'Loading story slide...', {
            fontFamily: 'Georgia, serif',
            fontSize: '26px',
            color: '#f0dba5'
        }).setOrigin(0.5);

        this.clickZone = this.add.zone(0, 0, width, height)
            .setOrigin(0)
            .setInteractive({ useHandCursor: true });
        this.clickZone.on('pointerup', () => this.advanceSlide());

        this.showSlide(this.slideIndex);
    }

    private advanceSlide(): void {
        this.slideIndex += 1;
        if (this.slideIndex >= this.slideKeys.length) {
            this.finishSlides();
            return;
        }
        this.showSlide(this.slideIndex);
    }

    private showSlide(index: number): void {
        const key = this.slideKeys[index];
        if (!key) {
            this.finishSlides();
            return;
        }
        this.clearNarration();

        const renderSlide = () => {
            const { width, height } = this.scale;
            if (this.slideImage && !this.slideImage.scene) {
                this.slideImage = undefined;
            }
            if (!this.slideImage) {
                this.slideImage = this.add.image(width / 2, height / 2, key);
                this.slideImage.setInteractive({ useHandCursor: true });
                this.slideImage.on('pointerup', () => this.advanceSlide());
            } else {
                this.slideImage.setTexture(key);
            }
            this.slideImage.setDisplaySize(width, height);
            this.slideImage.setVisible(true);
            this.missingText?.destroy();
            this.missingText = undefined;
            this.loadingText?.setVisible(false);
            this.showNarration(key);
        };

        if (this.textures.exists(key)) {
            renderSlide();
            return;
        }

        const path = getStorySlidePath(key);
        if (!path) {
            this.showMissingSlide(key);
            return;
        }

        this.loadingText?.setVisible(true);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
            if (this.textures.exists(key)) {
                renderSlide();
            } else {
                this.showMissingSlide(key);
            }
        });
        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
            this.showMissingSlide(key);
        });
        this.load.image(key, path);
        this.load.start();
    }

    private showMissingSlide(key: string): void {
        const { width, height } = this.scale;
        if (this.slideImage) {
            this.slideImage.setVisible(false);
        }
        this.missingText?.destroy();
        this.clearNarration();
        this.missingText = this.add.text(width / 2, height / 2, `Missing story slide:\n${key}`, {
            fontFamily: 'Georgia, serif',
            fontSize: '28px',
            color: '#f0dba5',
            align: 'center'
        }).setOrigin(0.5);
        this.loadingText?.setVisible(false);
    }

    private showNarration(key: string): void {
        this.clearNarration();

        const narration = getStorySlideNarration(key);
        if (!narration) {
            return;
        }

        const { width, height } = this.scale;
        const textWidth = Math.min(width * 0.84, 1180);
        const fontSize = width < 900 ? '33px' : '42px';
        const startY = height / 3;
        const endY = height * 0.12;
        const scrollDuration = Phaser.Math.Clamp(narration.length * 58, 11000, 18000);

        this.narrationShade = this.add.graphics();
        this.narrationShade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.36, 0.36, 0.08, 0.08);
        this.narrationShade.fillRect(0, height * 0.22, width, height * 0.36);
        this.narrationShade.setDepth(9);

        this.narrationText = this.add.text(width / 2, startY, narration, {
            fontFamily: 'Georgia, serif',
            fontSize,
            color: '#fff3c8',
            align: 'center',
            lineSpacing: 14,
            stroke: '#120a04',
            strokeThickness: 7,
            shadow: {
                offsetX: 0,
                offsetY: 3,
                color: '#000000',
                blur: 8,
                fill: true
            },
            wordWrap: {
                width: textWidth,
                useAdvancedWrap: true
            }
        }).setOrigin(0.5, 0).setDepth(10).setAlpha(0);

        this.narrationTween = this.tweens.add({
            targets: this.narrationText,
            y: endY,
            alpha: 1,
            duration: scrollDuration,
            ease: 'Sine.easeOut'
        });
    }

    private clearNarration(): void {
        this.narrationTween?.stop();
        this.narrationTween = undefined;
        this.narrationText?.destroy();
        this.narrationText = undefined;
        this.narrationShade?.destroy();
        this.narrationShade = undefined;
    }

    private finishSlides(): void {
        this.clearNarration();

        if (this.onComplete) {
            this.onComplete();
        }

        if (this.returnSceneKey) {
            if (this.scene.isPaused(this.returnSceneKey)) {
                this.scene.resume(this.returnSceneKey);
            }
        }

        if (this.nextSceneKey) {
            this.scene.start(this.nextSceneKey, this.nextSceneData);
        }

        this.scene.stop();
    }
}
