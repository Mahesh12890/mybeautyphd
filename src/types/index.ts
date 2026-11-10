export type ParticipantRole =
  | 'Patient'
  | 'Plastic / Aesthetic Surgeon'
  | 'Nurse of the clinic'
  | 'Family Member'
  | 'Other';

export interface InterviewItem {
  id: string;
  patientName: string;
  participantRole: ParticipantRole;
  clinicLocation: 'Kochi' | 'Kannur';
  date: string;
  audioDuration: string;
  audioUrl?: string;
  audioBlob?: Blob;
  transcriptMalayalam: string;
  transcriptEnglish: string;
  thematicTags: string[];
  sociologicalInsights: string[];
}

export type MediaFileType = 'document' | 'image' | 'video';

export interface ResearchFileItem {
  id: string;
  name: string;
  fileType: MediaFileType;
  fileSize: number;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
  notes?: string;
  textContent?: string;
}

export interface PhDTask {
  id: string;
  title: string;
  deadline: string;
  additionalNote?: string;
  completed: boolean;
}

export type EloRating = 500 | 800 | 1100 | 1400 | 1700 | 2000;

export interface BotProfile {
  elo: EloRating;
  title: string;
  description: string;
  avatar: string;
  blunderRate: number;
  searchDepth: number;
}

export interface ChessGameRecord {
  id: string;
  date: string;
  timestamp: number;
  opponent: {
    title: string;
    elo: EloRating;
    avatar: string;
  };
  playerColor: 'w' | 'b';
  result: 'win' | 'loss' | 'draw' | 'resigned';
  resultReason: string;
  moveCount: number;
  moves: string[];
  durationSeconds: number;
  fen: string;
}

export type UserRole = 'Lead Researcher' | 'Academic Advisor' | 'Fieldwork Coordinator' | 'Guest Scholar';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  institution: string;
  avatar: string;
  createdAt: string;
}

export interface ProcedureImageItem {
  id: string;
  category: 'Liposuction' | 'Breast augmentation' | 'Rhinoplasty' | 'Botox' | string;
  title: string;
  beforeImage: string;
  afterImage: string;
  notes?: string;
  createdAt?: string;
  currentView?: 'before' | 'after';
}
