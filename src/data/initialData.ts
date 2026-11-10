import { InterviewItem, PhDTask, BotProfile, ResearchFileItem, ProcedureImageItem } from '../types';

export const INITIAL_INTERVIEWS: InterviewItem[] = [];

export const INITIAL_FILES: ResearchFileItem[] = [];

export const INITIAL_TASKS: PhDTask[] = [];

export const INITIAL_SHOWCASE_PHOTOS: ProcedureImageItem[] = [
  {
    id: 'breast-aug-01',
    category: 'Breast augmentation',
    title: 'Subfascial High-Profile Augmentation',
    beforeImage: './assets/aistudio/breast-augmentation-before_102046.png',
    afterImage: './assets/aistudio/breast-augmentation-after_102104.png',
    createdAt: '2026-11-05T10:30:00.000Z'
  },
  {
    id: 'breast-aug-02',
    category: 'Breast augmentation',
    title: 'Dual-Plane Cohesive Gel Contouring',
    beforeImage: './assets/aistudio/brst_2_910befeb.png',
    afterImage: './assets/aistudio/breast-08_711adbda.jpg',
    createdAt: '2026-11-05T10:31:00.000Z'
  },
  {
    id: 'liposuction-01',
    category: 'Liposuction',
    title: 'Abdominal Fat Reduction & Waist Definition',
    beforeImage: './assets/aistudio/liposuction-before-1_090905.png',
    afterImage: './assets/aistudio/liposuction-after-1_090925.png',
    createdAt: '2026-11-05T10:32:00.000Z'
  },
  {
    id: 'liposuction-02',
    category: 'Liposuction',
    title: 'Midline & Flank Fat Sculpting',
    beforeImage: './assets/aistudio/liposuction-before-2_fat-lipo-1.png',
    afterImage: './assets/aistudio/liposuction-after-2_085930.png',
    createdAt: '2026-11-05T10:32:10.000Z'
  },
  {
    id: 'liposuction-03',
    category: 'Liposuction',
    title: 'Body Contour Refinement & Waistline Slimming',
    beforeImage: './assets/aistudio/liposuction-before-3_bodyr1.png',
    afterImage: './assets/aistudio/liposuction-after-3_bodyr2.png',
    createdAt: '2026-11-05T10:32:20.000Z'
  },
  {
    id: 'rhino-01',
    category: 'Rhinoplasty',
    title: 'Dorsal Hump Reduction & Tip Refinement',
    beforeImage: './assets/aistudio/Screenshot_2026-11-05_110231_f538ec82.png',
    afterImage: './assets/aistudio/Screenshot_2026-11-05_110244_b3e13eea.png',
    createdAt: '2026-11-05T11:02:00.000Z'
  },
  {
    id: 'rhino-02',
    category: 'Rhinoplasty',
    title: 'Frontal Nasal Axis & Tip Definition',
    beforeImage: './assets/aistudio/Screenshot_2026-11-05_110019_2745f83d.png',
    afterImage: './assets/aistudio/Screenshot_2026-11-05_110205_5a6d7196.png',
    createdAt: '2026-11-05T11:02:10.000Z'
  },
  {
    id: 'rhino-03',
    category: 'Rhinoplasty',
    title: 'Structural Profile Contouring & Tip Elevation',
    beforeImage: './assets/aistudio/Screenshot_2026-11-05_104821_781d5e98.png',
    afterImage: './assets/aistudio/Screenshot_2026-11-05_104855_d5722017.png',
    createdAt: '2026-11-05T11:02:20.000Z'
  },
  {
    id: 'botox-01',
    category: 'Botox',
    title: "Lateral Canthal (Crow's Feet) Smoothing",
    beforeImage: './assets/aistudio/Screenshot_2026-11-05_110914_6e13b43c.png',
    afterImage: './assets/aistudio/Screenshot_2026-11-05_110926_50dc191e.png',
    createdAt: '2026-11-05T11:05:00.000Z'
  },
  {
    id: 'botox-02',
    category: 'Botox',
    title: 'Glabellar Complex & Forehead Furrows',
    beforeImage: './assets/aistudio/Screenshot_2026-11-05_111401_6983883d.png',
    afterImage: './assets/aistudio/Screenshot_2026-11-05_111412_f7512a86.png',
    createdAt: '2026-11-05T11:05:10.000Z'
  },
  {
    id: 'botox-03',
    category: 'Botox',
    title: 'Periorbital Dynamic Rhytids Relaxation',
    beforeImage: './assets/aistudio/Screenshot_2026-11-05_111706_9d2e5d4d.png',
    afterImage: './assets/aistudio/Screenshot_2026-11-05_111723_bf278c06.png',
    createdAt: '2026-11-05T11:05:20.000Z'
  }
];

export const BOTS: BotProfile[] = [
  {
    elo: 500,
    title: 'MAPCKKK',
    description: 'Novice opponent with casual, unpredictable play. Perfect for a relaxing break.',
    avatar: '🌱',
    blunderRate: 0.55,
    searchDepth: 1
  },
  {
    elo: 800,
    title: 'Ammini',
    description: 'Casual player. Captures hanging pieces but overlooks deeper combinations.',
    avatar: '♟️',
    blunderRate: 0.35,
    searchDepth: 2
  },
  {
    elo: 1100,
    title: 'Rithwik',
    description: 'Solid opening fundamentals, active piece development, and disciplined defense.',
    avatar: '📖',
    blunderRate: 0.18,
    searchDepth: 2
  },
  {
    elo: 1400,
    title: 'Syamala amma',
    description: 'Tactical awareness, strong pawn structure awareness, and coordinated attacks.',
    avatar: '⚖️',
    blunderRate: 0.08,
    searchDepth: 3
  },
  {
    elo: 1700,
    title: 'Sanjay',
    description: 'Senior positional intuition, calculates 3-4 moves ahead, punishes tactical lapses.',
    avatar: '🏛️',
    blunderRate: 0.02,
    searchDepth: 3
  },
  {
    elo: 2000,
    title: 'Mahesh',
    description: 'Doctoral defense master. Relentless calculation, profound endgame and tactical precision.',
    avatar: '👑',
    blunderRate: 0.0,
    searchDepth: 4
  }
];
