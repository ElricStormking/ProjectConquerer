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

let cachedNarrationCsv: string | undefined;
let cachedNarration: Record<string, string> = {};

export const parseStorySlideNarration = (csv?: string): Record<string, string> => {
    if (!csv) {
        return {};
    }
    if (cachedNarrationCsv === csv) {
        return cachedNarration;
    }

    const narration: Record<string, string> = {};
    const normalizedCsv = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedCsv.split('\n');

    lines.slice(1).forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            return;
        }

        const commaIndex = trimmedLine.indexOf(',');
        if (commaIndex <= 0) {
            return;
        }

        const key = trimmedLine.slice(0, commaIndex).trim();
        let text = trimmedLine.slice(commaIndex + 1).trim();
        if (text.startsWith('"') && text.endsWith('"')) {
            text = text.slice(1, -1);
        }
        text = text.replace(/""/g, '"').trim();
        if (key && text) {
            narration[key] = text;
        }
    });

    cachedNarrationCsv = csv;
    cachedNarration = narration;
    return narration;
};

export const getStorySlideNarration = (key: string, csv?: string): string | undefined =>
    parseStorySlideNarration(csv)[key];

const STAGE_INTRO_SLIDES: Record<number, string[]> = {
    0: ['story_begining_01_stage1'],
    2: ['story_begining_01_stage3'],
    3: ['story_begining_01_stage4']
};

const STAGE_OUTRO_SLIDES: Record<number, string[]> = {
    0: ['story_ending_01_stage1'],
    1: ['story_ending_01_stage2'],
    2: ['story_ending_01_stage3'],
    3: ['story_ending_01_stage4'],
    4: ['story_ending_01_stage5']
};

export const getStageIntroSlides = (stageIndex: number): string[] =>
    STAGE_INTRO_SLIDES[stageIndex] ?? [];

export const getStageOutroSlides = (stageIndex: number): string[] =>
    STAGE_OUTRO_SLIDES[stageIndex] ?? [];
