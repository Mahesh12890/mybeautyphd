import React, { useMemo, useRef, useState } from 'react';
import {
  FileText,
  Search,
  Copy,
  Trash2,
  Edit3,
  Check,
  MapPin,
  Printer,
  AlertTriangle,
  X
} from 'lucide-react';
import { InterviewItem, ParticipantRole } from '../types';
import { exportInterviewToPdf, exportInterviewToDoc, playSound } from '../utils/audioUtils';

interface TranscribeWorkspaceProps {
  interviews: InterviewItem[];
  activeInterview: InterviewItem;
  onSelectInterview: (item: InterviewItem) => void;
  onUpdateInterview: (item: InterviewItem) => void;
  onDeleteInterview: (id: string) => void;
}

export const TranscribeWorkspace: React.FC<TranscribeWorkspaceProps> = ({
  interviews,
  activeInterview,
  onSelectInterview,
  onUpdateInterview,
  onDeleteInterview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingMalayalam, setIsEditingMalayalam] = useState(false);
  const [isEditingEnglish, setIsEditingEnglish] = useState(false);
  const [editedMalayalam, setEditedMalayalam] = useState(activeInterview?.transcriptMalayalam || '');
  const [editedEnglish, setEditedEnglish] = useState(activeInterview?.transcriptEnglish || '');
  const [copiedNotification, setCopiedNotification] = useState(false);
  
  // Custom in-app delete modal state (no window.confirm, guarantees 100% reliable deletion)
  const [interviewToDelete, setInterviewToDelete] = useState<InterviewItem | null>(null);

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useMemo(
    () => activeInterview.audioBlob ? URL.createObjectURL(activeInterview.audioBlob) : activeInterview.audioUrl || null,
    [activeInterview.audioBlob, activeInterview.audioUrl]
  );

  React.useEffect(() => {
    if (activeInterview.audioBlob && audioUrl) {
      return () => URL.revokeObjectURL(audioUrl);
    }
  }, [activeInterview.audioBlob, audioUrl]);

  // Synchronize edit states when active interview changes
  React.useEffect(() => {
    if (activeInterview) {
      setEditedMalayalam(activeInterview.transcriptMalayalam || '');
      setEditedEnglish(activeInterview.transcriptEnglish || '');
      setIsEditingMalayalam(false);
      setIsEditingEnglish(false);
      setAudioError(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [activeInterview?.id]);

  const [roleFilter, setRoleFilter] = useState<'All' | ParticipantRole>('All');

  // Filtered interviews list with safe fallbacks
  const filteredInterviews = (interviews || []).filter((item) => {
    if (!item) return false;
    const nameStr = (item.patientName || (item as any).codeName || '').toLowerCase();
    const locStr = (item.clinicLocation || '').toLowerCase();
    const roleStr = (item.participantRole || (item as any).participantType || '').toLowerCase();
    const engStr = (item.transcriptEnglish || '').toLowerCase();
    const mlStr = item.transcriptMalayalam || '';
    const query = (searchQuery || '').toLowerCase();

    const matchesQuery =
      nameStr.includes(query) ||
      locStr.includes(query) ||
      roleStr.includes(query) ||
      engStr.includes(query) ||
      mlStr.includes(searchQuery);

    const matchesRole = roleFilter === 'All' || item.participantRole === roleFilter;
    return matchesQuery && matchesRole;
  });

  const handleSaveMalayalam = () => {
    onUpdateInterview({
      ...activeInterview,
      transcriptMalayalam: editedMalayalam,
    });
    setIsEditingMalayalam(false);
    playSound('click');
  };

  const handleSaveEnglish = () => {
    onUpdateInterview({
      ...activeInterview,
      transcriptEnglish: editedEnglish,
    });
    setIsEditingEnglish(false);
    playSound('click');
  };

  // Export to PDF
  const handleExportPDF = () => {
    playSound('click');
    exportInterviewToPdf(activeInterview);
  };

  // Export to DOC
  const handleExportDOC = () => {
    playSound('click');
    exportInterviewToDoc(activeInterview);
  };

  const handleCopyClipboard = () => {
    const name = activeInterview?.patientName || (activeInterview as any)?.codeName || 'Participant';
    const role = activeInterview?.participantRole || (activeInterview as any)?.participantType || 'Patient';
    const loc = activeInterview?.clinicLocation || 'Kochi';

    const text = `[Patient: ${name} | Role: ${role} | Location: ${loc}]\n\nMalayalam (യഥാർത്ഥ വിവരണം):\n"${activeInterview?.transcriptMalayalam || ''}"\n\nEnglish Translation:\n"${activeInterview?.transcriptEnglish || ''}"`;
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    playSound('click');
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleConfirmDelete = () => {
    if (interviewToDelete) {
      onDeleteInterview(interviewToDelete.id);
      setInterviewToDelete(null);
      playSound('click');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar in Light Theme with larger typography */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-96">
            <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, clinic, text..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Export Buttons: .PDF and .DOC */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-sm font-bold text-white shadow-md shadow-teal-700/20 transition-all cursor-pointer"
            title="Export and print transcript as PDF"
          >
            <Printer size={17} />
            <span>Export in .PDF</span>
          </button>

          <button
            onClick={handleExportDOC}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-sm font-bold text-teal-800 shadow-sm transition-colors cursor-pointer"
            title="Download transcript as Microsoft Word (.doc)"
          >
            <FileText size={17} className="text-teal-700" />
            <span>Export in .DOC</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Grid: Sidebar + Dual Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Informants Directory */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Recorded Interviews ({filteredInterviews.length})
            </span>
          </div>

          {/* Quick Role Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {(['All', 'Patient', 'Plastic / Aesthetic Surgeon', 'Nurse of the clinic', 'Family Member', 'Other'] as const).map((r) => {
              const active = roleFilter === r;
              const label = r === 'Plastic / Aesthetic Surgeon' ? 'Surgeon' : r === 'Nurse of the clinic' ? 'Nurse' : r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRoleFilter(r);
                    playSound('click');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors cursor-pointer border ${
                    active
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredInterviews.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-sm text-slate-500 shadow-sm">
                No recorded interviews found. Record voice or upload an audio file above to begin.
              </div>
            ) : (
              filteredInterviews.map((item) => {
                const isSelected = activeInterview?.id === item.id;
                const pName = item.patientName || (item as any).codeName || 'Participant';
                const pRole = item.participantRole || (item as any).participantType || 'Patient';
                const pLoc = item.clinicLocation || 'Kochi';

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectInterview(item)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all relative group ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-500 shadow-sm ring-1 ring-teal-500/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="pr-6">
                        <h4 className="font-bold text-base text-slate-900">{pName}</h4>
                        <p className="text-xs text-teal-800 font-semibold">{pRole}</p>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-slate-100 border border-slate-300 text-slate-700 px-2 py-0.5 rounded-full font-mono font-medium">
                          {item.audioDuration || '00:00'}
                        </span>
                        
                        {/* Direct Delete Button on Card */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInterviewToDelete(item);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={`Delete interview for ${pName}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <MapPin size={13} className="text-teal-600" />
                        {pLoc}
                      </span>
                      <span>•</span>
                      <span>{item.date || ''}</span>
                    </div>

                    <p className="text-sm text-slate-600 font-malayalam line-clamp-2 mt-2 italic">
                      "{item.transcriptMalayalam || ''}"
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Dual Transcript Workspace */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            {/* Header with larger fonts */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-2xl font-bold text-slate-900">
                    {activeInterview?.patientName || (activeInterview as any)?.codeName || 'Participant'}
                  </h3>
                  <span className="text-xs px-3 py-1 rounded-full bg-teal-50 border border-teal-300 text-teal-800 font-bold">
                    {activeInterview?.participantRole || (activeInterview as any)?.participantType || 'Patient'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1 font-semibold text-slate-800">
                    <MapPin size={14} className="text-teal-600" />
                    {activeInterview?.clinicLocation || 'Kochi'}
                  </span>
                  <span>•</span>
                  <span>{activeInterview?.date || ''}</span>
                </p>
              </div>

              {/* Action Buttons: Export .PDF, Export .DOC, Copy, Delete */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 rounded-xl text-xs font-bold text-white transition-colors shadow-sm cursor-pointer"
                  title="Export to PDF"
                >
                  <Printer size={15} />
                  <span>Export .PDF</span>
                </button>

                <button
                  onClick={handleExportDOC}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-teal-800 transition-colors shadow-sm cursor-pointer"
                  title="Export to Word (.doc)"
                >
                  <FileText size={15} className="text-teal-700" />
                  <span>Export .DOC</span>
                </button>

                <button
                  onClick={handleCopyClipboard}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  {copiedNotification ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Reliable In-App Delete Button */}
                <button
                  onClick={() => setInterviewToDelete(activeInterview)}
                  className="flex items-center gap-1.5 px-3 py-2 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl border border-slate-200 hover:border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                  title="Delete interview record"
                >
                  <Trash2 size={15} className="text-rose-500" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Audio Playback Bar */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4">
              {audioUrl && !audioError ? (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  preload="metadata"
                  className="w-full min-w-0"
                  onError={() => setAudioError(true)}
                  onLoadedMetadata={(event) => {
                    event.currentTarget.playbackRate = playbackSpeed;
                  }}
                />
              ) : (
                <p className="text-sm text-slate-600 flex-1">
                  {audioError
                    ? 'The saved audio could not be played. The transcript is still available.'
                    : 'No audio recording is attached to this interview.'}
                </p>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono shrink-0">
                {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      if (audioRef.current) audioRef.current.playbackRate = speed;
                    }}
                    className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                      playbackSpeed === speed
                        ? 'bg-teal-700 text-white'
                        : 'hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* DUAL TRANSCRIPT SECTIONS with LARGER TEXT */}
            <div className="space-y-6">
              {/* 1. Complete Malayalam transcript or translation */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider text-teal-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                    Complete Malayalam Transcript / Translation (മലയാളം)
                  </span>

                  <button
                    onClick={() => {
                      if (isEditingMalayalam) {
                        handleSaveMalayalam();
                      } else {
                        setIsEditingMalayalam(true);
                      }
                    }}
                    className="text-xs flex items-center gap-1.5 text-slate-600 hover:text-teal-700 font-bold transition-colors cursor-pointer"
                  >
                    {isEditingMalayalam ? (
                      <>
                        <Check size={14} className="text-teal-700" />
                        <span>Save Edits</span>
                      </>
                    ) : (
                      <>
                        <Edit3 size={14} />
                        <span>Edit Malayalam</span>
                      </>
                    )}
                  </button>
                </div>

                {isEditingMalayalam ? (
                  <textarea
                    value={editedMalayalam}
                    onChange={(e) => setEditedMalayalam(e.target.value)}
                    rows={6}
                    className="w-full bg-white border-2 border-teal-600 rounded-xl p-4 text-base sm:text-lg font-malayalam text-slate-900 focus:outline-none leading-relaxed shadow-sm"
                  />
                ) : (
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-lg font-malayalam text-slate-900 leading-relaxed shadow-inner">
                    {activeInterview.transcriptMalayalam}
                  </div>
                )}
              </div>

              {/* 2. Complete English transcript or translation */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    Complete English Transcript / Translation
                  </span>

                  <button
                    onClick={() => {
                      if (isEditingEnglish) {
                        handleSaveEnglish();
                      } else {
                        setIsEditingEnglish(true);
                      }
                    }}
                    className="text-xs flex items-center gap-1.5 text-slate-600 hover:text-indigo-700 font-bold transition-colors cursor-pointer"
                  >
                    {isEditingEnglish ? (
                      <>
                        <Check size={14} className="text-indigo-700" />
                        <span>Save Edits</span>
                      </>
                    ) : (
                      <>
                        <Edit3 size={14} />
                        <span>Edit Translation</span>
                      </>
                    )}
                  </button>
                </div>

                {isEditingEnglish ? (
                  <textarea
                    value={editedEnglish}
                    onChange={(e) => setEditedEnglish(e.target.value)}
                    rows={6}
                    className="w-full bg-white border-2 border-indigo-600 rounded-xl p-4 text-base text-slate-900 focus:outline-none leading-relaxed shadow-sm"
                  />
                ) : (
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-base text-slate-800 leading-relaxed shadow-inner">
                    {activeInterview.transcriptEnglish}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* In-App Delete Confirmation Modal (100% reliable, no window.confirm) */}
      {interviewToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Delete Interview?</h3>
              </div>
              <button
                onClick={() => setInterviewToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete the interview record for{' '}
              <strong className="text-slate-900 font-bold">
                {interviewToDelete.patientName || (interviewToDelete as any).codeName || 'this participant'}
              </strong>
              ? Both the Malayalam audio transcript and English translation will be removed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setInterviewToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
