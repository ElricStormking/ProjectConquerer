import Phaser from 'phaser';
import { getStorySlidePath } from '../data/StorySlides';

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
        this.load.once(Phaser.Loader.Events.LOAD_ERROR, () => {
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
        this.missingText = this.add.text(width / 2, height / 2, `Missing story slide:\n${key}`, {
            fontFamily: 'Georgia, serif',
            fontSize: '28px',
            color: '#f0dba5',
            align: 'center'
        }).setOrigin(0.5);
        this.loadingText?.setVisible(false);
    }

    private finishSlides(): void {
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
