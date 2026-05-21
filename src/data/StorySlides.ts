export const getPreludeSlides = (): string[] => [
    'story_begining_01_prelude',
    'story_begining_02_prelude',
    'story_begining_03_prelude',
    'story_begining_04_prelude'
];

export const getFinalSlides = (): string[] => [
    'story_begining_01_final'
];

export const STORY_SLIDE_PATHS: Record<string, string> = {
    story_begining_01_prelude: 'assets/StorySlides/begining_01_prelude.png',
    story_begining_02_prelude: 'assets/StorySlides/begining_02_prelude.png',
    story_begining_03_prelude: 'assets/StorySlides/begining_03_prelude.png',
    story_begining_04_prelude: 'assets/StorySlides/begining_04_prelude.png',
    story_begining_01_stage1: 'assets/StorySlides/begining_01_stage1.png',
    story_begining_01_stage3: 'assets/StorySlides/begining_01_stage3.png',
    story_begining_01_stage4: 'assets/StorySlides/begining_01_stage4.png',
    story_begining_01_final: 'assets/StorySlides/begining_01_final.png',
    story_ending_01_stage1: 'assets/StorySlides/ending_01_stage1.png',
    story_ending_01_stage2: 'assets/StorySlides/ending_01_stage2.png',
    story_ending_01_stage3: 'assets/StorySlides/ending_01_stage3.png',
    story_ending_01_stage4: 'assets/StorySlides/ending_01_stage4.png',
    story_ending_01_stage5: 'assets/StorySlides/ending_01_stage5.png'
};

export const getStorySlidePath = (key: string): string | undefined => STORY_SLIDE_PATHS[key];

const STORY_SLIDE_NARRATION: Record<string, string> = {
    story_begining_01_prelude:
        'During a storm night, in a dark temple of the shadow goddess. A sound from the mystery goddess sculpture whispered: You will be a commander that starts the war, conquer the land, and bring the honor and believers for me. I bestow you the war wisdom.',
    story_begining_02_prelude:
        "A new born baby in the arms of a nun, is sleeping. The nun can't hear anything whispered from the goddess sculpture whispered, but the sleeping baby...",
    story_begining_03_prelude:
        'The sleeping baby has a old soul from other metaverse. He hears the goddess whisper..... then suddenly opened eyes. In his mind thinking. "You better shut up, Fake god"',
    story_begining_04_prelude:
        "The baby grew up in a general's family. He is receiving his first mission from his dad: defeat all the bandits who are plundering this land."
};

export const getStorySlideNarration = (key: string): string | undefined => STORY_SLIDE_NARRATION[key];

const STAGE_INTRO_SLIDES: Record<number, string[]> = {
    0: ['story_begining_01_stage3'],
    2: ['story_begining_01_stage1'],
    3: ['story_begining_01_stage4']
};

const STAGE_OUTRO_SLIDES: Record<number, string[]> = {
    0: ['story_ending_01_stage3'],
    1: ['story_ending_01_stage2'],
    2: ['story_ending_01_stage1'],
    3: ['story_ending_01_stage4'],
    4: ['story_ending_01_stage5']
};

export const getStageIntroSlides = (stageIndex: number): string[] =>
    STAGE_INTRO_SLIDES[stageIndex] ?? [];

export const getStageOutroSlides = (stageIndex: number): string[] =>
    STAGE_OUTRO_SLIDES[stageIndex] ?? [];
