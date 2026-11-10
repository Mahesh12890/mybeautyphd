import React, { useState } from 'react';
import {
  CheckSquare,
  Calendar,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  FileEdit,
  Download,
  ExternalLink
} from 'lucide-react';
import { PhDTask } from '../types';
import { playSound, exportToFile } from '../utils/audioUtils';
import { saveNotesAsDocFile, generateNoteDocHtml } from '../utils/fileStorage';

interface MilestoneTrackerProps {
  tasks: PhDTask[];
  onAddTask: (task: PhDTask) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onNavigateToVault?: () => void;
}

export const MilestoneTracker: React.FC<MilestoneTrackerProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onNavigateToVault,
}) => {
  // New task form fields: Task Title, Deadline Date, Additional Note
  const [taskTitle, setTaskTitle] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [additionalNote, setAdditionalNote] = useState('');

  // General Research Notepad
  const [researchNotes, setResearchNotes] = useState(() => {
    try {
      return localStorage.getItem('aurascholar_research_notes') || '';
    } catch {
      return '';
    }
  });
  const [notesSaveSuccess, setNotesSaveSuccess] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !deadlineDate.trim()) return;

    const newTask: PhDTask = {
      id: `task-${Date.now()}`,
      title: taskTitle.trim(),
      deadline: deadlineDate,
      additionalNote: additionalNote.trim() || undefined,
      completed: false,
    };

    onAddTask(newTask);
    playSound('click');

    // Reset task form
    setTaskTitle('');
    setDeadlineDate('');
    setAdditionalNote('');
  };

  const handleSaveResearchNotes = async () => {
    try {
      localStorage.setItem('aurascholar_research_notes', researchNotes);
      // Save and synchronize as .doc in Documents section (Literature Vault)
      await saveNotesAsDocFile(researchNotes);
      setNotesSaveSuccess(true);
      playSound('capture');
      setTimeout(() => setNotesSaveSuccess(false), 3500);
    } catch (e) {
      console.warn('Could not save notes:', e);
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      const savedItem = await saveNotesAsDocFile(researchNotes, { isSnapshot: true });
      setSnapshotSuccess(savedItem.name);
      playSound('capture');
      setTimeout(() => setSnapshotSuccess(null), 3500);
    } catch (e) {
      console.warn('Snapshot error:', e);
    }
  };

  const handleDownloadDoc = () => {
    const docHtml = generateNoteDocHtml(researchNotes, 'Fieldwork & Dissertation Research Notes');
    exportToFile(docHtml, 'Fieldwork_Research_Notes.doc', 'application/msword');
    playSound('click');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <CheckSquare className="text-teal-700" size={26} />
          PhD Milestones & Research Notes
        </h2>
      </div>

      {/* Grid: Left Column for Task Form & List, Right Column for Research Notepad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Tasks (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Simple New Task Form in Light Theme */}
          <form
            onSubmit={handleCreateTask}
            className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-sm"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus size={18} className="text-teal-700" />
              Add New Milestone
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter milestone title..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Deadline Date *
              </label>
              <input
                type="date"
                required
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Additional Note
              </label>
              <input
                type="text"
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                placeholder="Add any specific context or detail..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md shadow-teal-700/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                <span>Save Milestone</span>
              </button>
            </div>
          </form>

          {/* Simple Task List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
              Your Milestones ({tasks.length})
            </h4>

            {tasks.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-sm text-slate-500 shadow-sm">
                No milestones added yet. Use the form above to schedule your fieldwork appointments and deadlines.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => {
                    onToggleTask(task.id);
                    playSound('click');
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3.5 ${
                    task.completed
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200 hover:border-teal-400 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => {}}
                      className="mt-1 rounded accent-teal-700 w-4 h-4 cursor-pointer"
                    />

                    <div className="space-y-1">
                      <p
                        className={`text-base font-bold ${
                          task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1 text-teal-800 font-mono font-bold text-xs">
                          <Calendar size={13} />
                          {task.deadline}
                        </span>
                      </div>

                      {task.additionalNote && (
                        <p className="text-xs text-slate-600 italic mt-1">
                          Note: {task.additionalNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTask(task.id);
                      playSound('click');
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Delete milestone"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Research Notepad (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileEdit size={18} className="text-teal-700" />
                <h3 className="text-base font-bold text-slate-900">Research Notes & Ideas</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDoc}
                  title="Download notes as Microsoft Word .doc file"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-all cursor-pointer"
                >
                  <Download size={13} className="text-blue-700" />
                  <span>.doc</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveResearchNotes}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md shadow-teal-700/20 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  <span>{notesSaveSuccess ? 'Saved to .doc!' : 'Save Notes'}</span>
                </button>
              </div>
            </div>


            <textarea
              value={researchNotes}
              onChange={(e) => setResearchNotes(e.target.value)}
              rows={15}
              placeholder="Write your research notes, theoretical connections, interview observations, or to-dos here..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white leading-relaxed font-sans shadow-inner"
            />

            {/* Quick Actions Footer below Notes */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveSnapshot}
                title="Create a dated .doc snapshot in Documents section"
                className="text-xs text-slate-600 hover:text-teal-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} className="text-teal-700" />
                <span>Save Dated Snapshot (.doc)</span>
              </button>

              {onNavigateToVault && (
                <button
                  type="button"
                  onClick={onNavigateToVault}
                  className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to Documents</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>

            {notesSaveSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 size={16} />
                  <span>Notes saved & synchronized to Documents!</span>
                </div>
                <p className="text-emerald-700 pl-6">
                  Saved as <strong className="font-semibold">Fieldwork_Research_Notes.doc</strong> in the Literature & Documents section.
                </p>
                {onNavigateToVault && (
                  <div className="pl-6 pt-1">
                    <button
                      type="button"
                      onClick={onNavigateToVault}
                      className="text-xs font-bold text-emerald-900 underline hover:text-emerald-950 cursor-pointer"
                    >
                      View in Documents section →
                    </button>
                  </div>
                )}
              </div>
            )}

            {snapshotSuccess && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-300 text-blue-900 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-700" />
                <span>Created dated snapshot: <strong>{snapshotSuccess}</strong> in Documents!</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
