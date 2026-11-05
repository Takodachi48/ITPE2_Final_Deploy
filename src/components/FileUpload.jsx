// src/components/FileUpload.jsx
import { useRef, useState } from 'react';
import { uploadToSignedUrl } from '../api/client';

export default function FileUpload({ accept, maxSizeMb, onUploaded, onError, getUploadUrl }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setProgress(0);
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      const msg = `File exceeds ${maxSizeMb} MB limit.`;
      setError(msg);
      onError?.(msg);
      return;
    }
    setUploading(true);
    try {
      const info = await getUploadUrl({ fileName: file.name, mime: file.type, size: file.size });
      await uploadToSignedUrl(info.uploadUrl, file, setProgress);
      onUploaded?.(info.path, file);
    } catch (err) {
      const msg = err?.message || 'Upload failed.';
      setError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className="btn"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? `Uploading ${progress}%` : 'Choose file'}
      </button>
      {uploading && (
        <div style={{ marginTop: 6, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#2563eb', borderRadius: 3 }} />
        </div>
      )}
      {error && <div className="auth-error" role="alert" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}