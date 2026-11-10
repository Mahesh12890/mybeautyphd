import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Upload,
  Search,
  Trash2,
  Download,
  Eye,
  Play,
  FileCheck,
  Layers,
  Edit2,
  Check,
  AlertTriangle,
  X
} from 'lucide-react';
import { ResearchFileItem, MediaFileType } from '../types';
import { getAllStoredFiles, saveStoredFile, deleteStoredFile, formatBytes, saveNotesAsDocFile } from '../utils/fileStorage';
import { playSound } from '../utils/audioUtils';

interface LiteratureVaultProps {
  onNavigateToNotes?: () => void;
}

export const LiteratureVault: React.FC<LiteratureVaultProps> = ({ onNavigateToNotes }) => {
  const [activeMediaTab, setActiveMediaTab] = useState<MediaFileType>('document');
  const [files, setFiles] = useState<ResearchFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<ResearchFileItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [fileToDelete, setFileToDelete] = useState<ResearchFileItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadFiles();
    const handleFilesUpdate = () => {
      loadFiles();
    };
    window.addEventListener('aurascholar_files_updated', handleFilesUpdate);
    return () => window.removeEventListener('aurascholar_files_updated', handleFilesUpdate);
  }, []);

  const loadFiles = async () => {
    try {
      const existingNotes = localStorage.getItem('aurascholar_research_notes');
      if (existingNotes && existingNotes.trim()) {
        const stored = await getAllStoredFiles();
        const hasNotesDoc = stored.some((f) => f.id === 'doc-fieldwork-notes');
        if (!hasNotesDoc) {
          await saveNotesAsDocFile(existingNotes);
        }
      }
    } catch (e) {
      console.warn('Auto-sync check failed:', e);
    }
    const stored = await getAllStoredFiles();
    const sanitized = stored.map((f) => {
      if (f.notes && f.notes.includes('Active research notes synchronized from PhD Milestones notepad')) {
        const cleaned = { ...f, notes: '' };
        saveStoredFile(cleaned).catch(() => {});
        return cleaned;
      }
      return f;
    });
    setFiles(sanitized);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    playSound('click');

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        let fileType: MediaFileType = 'document';

        if (file.type.startsWith('image/')) {
          fileType = 'image';
        } else if (file.type.startsWith('video/')) {
          fileType = 'video';
        } else {
          fileType = 'document';
        }

        const dataUrl = await readFileAsDataURL(file);

        const newFileItem: ResearchFileItem = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: file.name,
          fileType,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
          uploadedAt: new Date().toISOString().split('T')[0],
          notes: '',
        };

        await saveStoredFile(newFileItem);
      }

      await loadFiles();
      playSound('capture');
    } catch (err) {
      console.error('File upload error:', err);
      alert('Error uploading file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteFile = (file: ResearchFileItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFileToDelete(file);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    const id = fileToDelete.id;
    await deleteStoredFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedPreviewFile?.id === id) {
      setSelectedPreviewFile(null);
    }
    setFileToDelete(null);
    playSound('click');
  };

  const handleSaveNotes = async (file: ResearchFileItem) => {
    const updated = { ...file, notes: tempNotes };
    await saveStoredFile(updated);
    setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
    if (selectedPreviewFile?.id === file.id) {
      setSelectedPreviewFile(updated);
    }
    setEditingNotesId(null);
    playSound('click');
  };

  const filteredFiles = files.filter((f) => {
    const matchesTab = f.fileType === activeMediaTab;
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.notes && f.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const docCount = files.filter((f) => f.fileType === 'document').length;
  const imageCount = files.filter((f) => f.fileType === 'image').length;
  const videoCount = files.filter((f) => f.fileType === 'video').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Upload Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Layers className="text-teal-700" size={26} />
            Research Media & Documents Organizer
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Upload and organize documents, photos, and video recordings from your device.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-sm font-bold text-white shadow-md shadow-teal-700/20 transition-all cursor-pointer"
          >
            <Upload size={18} />
            <span>{isUploading ? 'Uploading...' : 'Upload from Device'}</span>
          </button>
        </div>
      </div>

      {/* Media Type Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Section Tabs: Documents, Images, Videos */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveMediaTab('document');
              playSound('click');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeMediaTab === 'document'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText size={17} />
            <span>Documents</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 text-current font-mono font-bold">
              {docCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMediaTab('image');
              playSound('click');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeMediaTab === 'image'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ImageIcon size={17} />
            <span>Images</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 text-current font-mono font-bold">
              {imageCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMediaTab('video');
              playSound('click');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeMediaTab === 'video'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <VideoIcon size={17} />
            <span>Videos</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 text-current font-mono font-bold">
              {videoCount}
            </span>
          </button>
        </div>

        {/* Search with larger font */}
        <div className="relative flex-1 md:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeMediaTab}s...`}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Main Files Display Grid */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white p-14 text-center rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center">
            {activeMediaTab === 'document' ? (
              <FileText size={32} />
            ) : activeMediaTab === 'image' ? (
              <ImageIcon size={32} />
            ) : (
              <VideoIcon size={32} />
            )}
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-800">
              No {activeMediaTab}s uploaded yet
            </h4>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Click the "Upload from Device" button above to add your research {activeMediaTab}s directly from your computer or phone.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-bold inline-flex items-center gap-2 border border-slate-300 shadow-sm cursor-pointer"
          >
            <Upload size={16} className="text-teal-700" />
            <span>Select {activeMediaTab} file</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => {
                setSelectedPreviewFile(file);
                playSound('click');
              }}
              className="bg-white rounded-2xl border border-slate-200 hover:border-teal-500 p-3.5 flex flex-col justify-between cursor-pointer transition-all group overflow-hidden shadow-sm hover:shadow-md"
            >
              {/* Preview Box */}
              <div className="relative w-full h-40 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 mb-3">
                {file.fileType === 'image' ? (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : file.fileType === 'video' ? (
                  <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                    <video
                      src={file.dataUrl}
                      className="w-full h-full object-cover opacity-80"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg">
                        <Play size={20} className="ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : file.mimeType.includes('msword') || file.name.endsWith('.doc') ? (
                  <div className="flex flex-col items-center justify-center text-blue-700 space-y-2 p-2">
                    <FileText size={44} className="text-blue-700" />
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wider font-mono font-bold border border-blue-200">
                      WORD .DOC
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-teal-700 space-y-2 p-2">
                    <FileText size={42} />
                    <span className="text-xs text-slate-600 uppercase tracking-wider font-mono font-bold">
                      {file.mimeType.split('/')[1] || 'PDF / DOC'}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors" title={file.name}>
                    {file.name}
                  </h4>
                  {(file.id.startsWith('doc-') || file.name.includes('Research_Notes')) && (
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded shrink-0">
                      Notes
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>{formatBytes(file.fileSize)}</span>
                  <span>{file.uploadedAt}</span>
                </div>

                {file.notes && (
                  <p className="text-xs text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                    "{file.notes}"
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-teal-700 text-xs font-bold flex items-center gap-1">
                  <Eye size={14} /> Open
                </span>

                <div className="flex items-center gap-2">
                  <a
                    href={file.dataUrl}
                    download={file.name}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 text-slate-500 hover:text-slate-900"
                    title="Download file"
                  >
                    <Download size={15} />
                  </a>

                  <button
                    onClick={(e) => handleDeleteFile(file, e)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    title="Delete file"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Preview Modal */}
      {selectedPreviewFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3 truncate">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
                  {selectedPreviewFile.fileType === 'image' ? (
                    <ImageIcon size={18} />
                  ) : selectedPreviewFile.fileType === 'video' ? (
                    <VideoIcon size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-base text-slate-900 truncate">
                    {selectedPreviewFile.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatBytes(selectedPreviewFile.fileSize)} • Uploaded {selectedPreviewFile.uploadedAt}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedPreviewFile.dataUrl}
                  download={selectedPreviewFile.name}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-800 font-bold border border-slate-300"
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => handleDeleteFile(selectedPreviewFile)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-xs text-rose-600 font-bold border border-slate-300 hover:border-rose-200 cursor-pointer"
                  title="Delete file"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setSelectedPreviewFile(null)}
                  className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center font-bold text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content Media Viewer */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-slate-100">
              {selectedPreviewFile.fileType === 'image' && (
                <img
                  src={selectedPreviewFile.dataUrl}
                  alt={selectedPreviewFile.name}
                  className="max-h-[55vh] max-w-full rounded-xl object-contain shadow-md"
                />
              )}

              {selectedPreviewFile.fileType === 'video' && (
                <video
                  src={selectedPreviewFile.dataUrl}
                  controls
                  autoPlay
                  className="max-h-[55vh] max-w-full rounded-xl shadow-md bg-black"
                />
              )}

              {selectedPreviewFile.fileType === 'document' && (
                <div className="w-full h-[55vh] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                  {selectedPreviewFile.mimeType.includes('msword') || selectedPreviewFile.name.endsWith('.doc') ? (
                    <div className="flex flex-col h-full">
                      {/* Document top status bar */}
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                        <span className="font-bold flex items-center gap-1.5 text-blue-700">
                          <FileText size={16} /> Microsoft Word (.doc) Document View
                        </span>
                        <span className="text-slate-500 font-mono">
                          {formatBytes(selectedPreviewFile.fileSize)} • Standard Word Document
                        </span>
                      </div>

                      {/* Document page body */}
                      <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white font-serif text-slate-900 leading-relaxed">
                        <div className="max-w-2xl mx-auto space-y-4">
                          <div className="border-b border-slate-300 pb-3">
                            <h2 className="text-xl font-bold font-serif text-slate-900">
                              {selectedPreviewFile.name.replace('.doc', '').replace(/_/g, ' ')}
                            </h2>
                            <p className="text-xs text-slate-500 font-sans mt-1">
                              Department of Sociology • Fieldwork & Dissertation Research Record
                            </p>
                          </div>

                          <div className="font-serif text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                            {selectedPreviewFile.textContent ||
                              (selectedPreviewFile.notes
                                ? selectedPreviewFile.notes
                                : 'Word document content synchronized and saved in your research library.')}
                          </div>
                        </div>
                      </div>

                      {/* Document actions bar */}
                      <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          Format: Plain Text / Microsoft Word (.doc)
                        </span>
                        <div className="flex items-center gap-2">
                          {onNavigateToNotes && selectedPreviewFile.id.startsWith('doc-') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPreviewFile(null);
                                onNavigateToNotes();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                            >
                              Edit in Notes Notepad
                            </button>
                          )}
                          <a
                            href={selectedPreviewFile.dataUrl}
                            download={selectedPreviewFile.name}
                            className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <Download size={14} />
                            <span>Download .doc</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : selectedPreviewFile.mimeType.includes('pdf') ? (
                    <iframe
                      src={selectedPreviewFile.dataUrl}
                      className="w-full h-full rounded-lg border-0"
                      title={selectedPreviewFile.name}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 my-auto">
                      <FileCheck size={54} className="text-teal-700 mx-auto" />
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">
                          {selectedPreviewFile.name}
                        </h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Document registered in your research library.
                        </p>
                      </div>
                      <a
                        href={selectedPreviewFile.dataUrl}
                        download={selectedPreviewFile.name}
                        className="px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm"
                      >
                        <Download size={16} />
                        <span>Download to View in Native Reader</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Research Notes & Annotation Footer */}
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Research Fieldwork Notes & Metadata
                </span>

                {editingNotesId !== selectedPreviewFile.id ? (
                  <button
                    onClick={() => {
                      setEditingNotesId(selectedPreviewFile.id);
                      setTempNotes(selectedPreviewFile.notes || '');
                    }}
                    className="text-xs text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>{selectedPreviewFile.notes ? 'Edit Notes' : 'Add Notes'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveNotes(selectedPreviewFile)}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Save Notes</span>
                  </button>
                )}
              </div>

              {editingNotesId === selectedPreviewFile.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    placeholder="Add research note, informant context, clinic location..."
                    className="flex-1 bg-slate-50 border border-teal-600 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveNotes(selectedPreviewFile)}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 min-h-[40px]">
                  {selectedPreviewFile.notes || (
                    <span className="text-slate-400 italic">No notes added yet for this file.</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* In-App Delete Confirmation Modal (100% reliable) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Delete File?</h3>
              </div>
              <button
                onClick={() => setFileToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 font-bold">{fileToDelete.name}</strong> from your
              research organizer?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFile}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
