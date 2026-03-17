import React, { useState, useEffect } from 'react';
import { Upload, FileText, List, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadDate: string;
  path: string;
}

export default function App() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files');
      const contentType = response.headers.get('content-type');
      
      if (response.ok && contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setFiles(data);
      } else {
        const text = await response.text();
        console.error('Expected JSON but received:', text.substring(0, 100));
        if (!response.ok) {
          setMessage({ type: 'error', text: `Server error: ${response.status}` });
        }
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setMessage({ type: 'error', text: 'Failed to connect to the server.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'File uploaded successfully!' });
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchFiles();
      } else {
        setMessage({ type: 'error', text: 'Failed to upload file.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred during upload.' });
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2">File Metadata Service</h1>
          <p className="text-zinc-500">Express REST API with Firestore metadata storage</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="md:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload File
              </h2>
              
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="relative group">
                  <input
                    type="file"
                    id="fileInput"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="fileInput"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-all"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText className="w-8 h-8 text-zinc-400 mb-2" />
                      <p className="text-xs text-zinc-500 text-center px-4">
                        {selectedFile ? selectedFile.name : 'Click to select a file'}
                      </p>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    !selectedFile || uploading
                      ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]'
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload Metadata'
                  )}
                </button>
              </form>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                      message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Files List Section */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <List className="w-5 h-5" />
                  Stored Metadata
                </h2>
                <button 
                  onClick={fetchFiles}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm">Loading metadata...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-400 border-2 border-dashed border-zinc-100 rounded-xl">
                  <FileText className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">No files uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-xl border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600 group-hover:bg-white transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-medium text-zinc-900 line-clamp-1">{file.originalName}</h3>
                            <p className="text-xs text-zinc-500">
                              {file.mimeType} • {formatSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                            Uploaded
                          </p>
                          <p className="text-xs text-zinc-600">
                            {new Date(file.uploadDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-zinc-50 flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="font-mono">ID: {file.id}</span>
                        <span className="truncate max-w-[200px]">Path: {file.path}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
