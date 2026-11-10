import React, { useState, useEffect } from 'react';
import { Navbar, StudioTabType } from './components/Navbar';
import { PlasticBeautyShowcase } from './components/PlasticBeautyShowcase';
import { AudioRecorder } from './components/AudioRecorder';
import { TranscribeWorkspace } from './components/TranscribeWorkspace';
import { LiteratureVault } from './components/LiteratureVault';
import { MilestoneTracker } from './components/MilestoneTracker';
import { ChessArena } from './components/ChessArena';
import { LoginModal } from './components/LoginModal';
import { INITIAL_INTERVIEWS, INITIAL_TASKS } from './data/initialData';
import { InterviewItem, PhDTask, UserAccount } from './types';
import { getAllStoredFiles } from './utils/fileStorage';
import { playSound } from './utils/audioUtils';
import {
  getCurrentUserSession,
  setCurrentUserSession,
  getStoredInterviews,
  saveStoredInterview,
  deleteStoredInterview,
  getStoredTasks,
  saveStoredTask,
  deleteStoredTask,
} from './utils/database';

export default function App() {
  // Main Interface view mode: 'showcase' (default, video interface) or 'workstation' (researcher studio)
  const [viewMode, setViewMode] = useState<'showcase' | 'workstation'>('showcase');
  const [activeTab, setActiveTab] = useState<StudioTabType>('transcribe');
  const [, setMediaFileCount] = useState(0);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUserSession());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const normalizeInterview = (raw: any): InterviewItem => {
    return {
      id: raw.id || `int-${Date.now()}`,
      patientName: raw.patientName || raw.codeName || 'Anonymous Respondent',
      participantRole: raw.participantRole || raw.participantType || 'Patient',
      clinicLocation: raw.clinicLocation && String(raw.clinicLocation).includes('Kannur') ? 'Kannur' : 'Kochi',
      date: raw.date || new Date().toISOString().split('T')[0],
      audioDuration: raw.audioDuration || '00:00',
      audioUrl: raw.audioUrl,
      audioBlob: raw.audioBlob instanceof Blob ? raw.audioBlob : undefined,
      transcriptMalayalam: raw.transcriptMalayalam || '',
      transcriptEnglish: raw.transcriptEnglish || '',
      thematicTags: Array.isArray(raw.thematicTags) ? raw.thematicTags : [],
      sociologicalInsights: Array.isArray(raw.sociologicalInsights) ? raw.sociologicalInsights : [],
    };
  };

  // Interviews State loaded from Unified Database
  const [interviews, setInterviews] = useState<InterviewItem[]>(() => {
    try {
      const saved = localStorage.getItem('aurascholar_interviews');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeInterview);
        }
      }
      return INITIAL_INTERVIEWS;
    } catch {
      return INITIAL_INTERVIEWS;
    }
  });

  const [activeInterview, setActiveInterview] = useState<InterviewItem | null>(() => interviews[0] || null);

  // Milestones Tasks State loaded from Database
  const [tasks, setTasks] = useState<PhDTask[]>(() => {
    try {
      const saved = localStorage.getItem('aurascholar_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  // Load from IndexedDB on startup
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const dbInterviews = await getStoredInterviews();
        if (dbInterviews && dbInterviews.length > 0) {
          const norm = dbInterviews.map(normalizeInterview);
          setInterviews(norm);
          setActiveInterview((curr) => curr || norm[0]);
        }
        const dbTasks = await getStoredTasks();
        if (dbTasks && dbTasks.length > 0) {
          setTasks(dbTasks);
        }
      } catch (e) {
        console.warn('Database initialization load error:', e);
      }
    };
    loadFromDB();
  }, []);

  // Track media file count
  useEffect(() => {
    const updateCount = async () => {
      const files = await getAllStoredFiles();
      setMediaFileCount(files.length);
    };
    updateCount();
    const interval = setInterval(updateCount, 4000);
    return () => clearInterval(interval);
  }, []);

  // Listen for user profile events
  useEffect(() => {
    const handleUserChanged = (e: any) => {
      setCurrentUser(e.detail || null);
    };
    window.addEventListener('aurascholar_user_changed', handleUserChanged);
    return () => window.removeEventListener('aurascholar_user_changed', handleUserChanged);
  }, []);

  // Handler: Add newly transcribed interview (saved to DB)
  const handleTranscriptionComplete = async (newInterview: InterviewItem) => {
    const normalized = normalizeInterview(newInterview);
    await saveStoredInterview(normalized);
    setInterviews((prev) => [normalized, ...prev]);
    setActiveInterview(normalized);
  };

  // Handler: Update interview
  const handleUpdateInterview = async (updated: InterviewItem) => {
    const normalized = normalizeInterview(updated);
    setInterviews((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
    if (activeInterview?.id === normalized.id) {
      setActiveInterview(normalized);
    }
    await saveStoredInterview(normalized);
  };

  // Handler: Delete interview
  const handleDeleteInterview = async (id: string) => {
    setInterviews((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      setActiveInterview((currentActive) => {
        if (currentActive?.id === id) {
          return remaining.length > 0 ? remaining[0] : null;
        }
        return currentActive;
      });
      return remaining;
    });
    await deleteStoredInterview(id);
    playSound('click');
  };

  // Handler: Tasks
  const handleAddTask = async (task: PhDTask) => {
    setTasks((prev) => [task, ...prev]);
    await saveStoredTask(task);
  };

  const handleToggleTask = async (id: string) => {
    let updatedTask: PhDTask | null = null;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          updatedTask = { ...t, completed: !t.completed };
          return updatedTask;
        }
        return t;
      })
    );
    if (updatedTask) {
      await saveStoredTask(updatedTask);
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteStoredTask(id);
    playSound('click');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white text-base">
      {/* 
        MAIN INTERFACE: When in 'showcase' mode, the entire navigation tab bar is REMOVED!
        The screen matches the video with 100% precision.
      */}
      {viewMode === 'showcase' ? (
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col justify-center">
          <PlasticBeautyShowcase
            currentUser={currentUser}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onOpenWorkstation={() => {
              playSound('click');
              setViewMode('workstation');
            }}
          />
        </main>
      ) : (
        /* RESEARCHER WORKSTATION: Contains Fieldwork, Documents, Notes, and Chess */
        <div className="flex-1 flex flex-col">
          <Navbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentUser={currentUser}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onBackToShowcase={() => setViewMode('showcase')}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-8">
            {/* TAB 1: FIELDWORK */}
            {activeTab === 'transcribe' && (
              <section className="space-y-8 animate-fadeIn">
                <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />

                {interviews.length > 0 && activeInterview ? (
                  <TranscribeWorkspace
                    interviews={interviews}
                    activeInterview={activeInterview}
                    onSelectInterview={setActiveInterview}
                    onUpdateInterview={handleUpdateInterview}
                    onDeleteInterview={handleDeleteInterview}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs space-y-2">
                    <p className="text-base font-bold text-slate-800">No Recorded Fieldwork Interviews</p>
                    <p className="text-sm text-slate-500">
                      Record qualitative interviews above or upload audio to generate verbatim transcripts.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: DOCUMENTS */}
            {activeTab === 'vault' && (
              <section className="animate-fadeIn">
                <LiteratureVault onNavigateToNotes={() => setActiveTab('tasks')} />
              </section>
            )}

            {/* TAB 3: NOTES */}
            {activeTab === 'tasks' && (
              <section className="animate-fadeIn">
                <MilestoneTracker
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onNavigateToVault={() => setActiveTab('vault')}
                />
              </section>
            )}

            {/* TAB 4: CHESS */}
            {activeTab === 'chess' && (
              <section className="animate-fadeIn">
                <ChessArena />
              </section>
            )}
          </main>
        </div>
      )}

      {/* Clean & Professional Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onUserChange={(user) => {
          setCurrentUser(user);
          setCurrentUserSession(user);
        }}
      />
    </div>
  );
}
