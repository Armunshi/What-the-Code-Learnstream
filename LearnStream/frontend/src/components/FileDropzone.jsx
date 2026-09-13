import React, { useRef, useState } from "react";
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// status: 'idle' | 'uploading' | 'done' | 'error'
function FileDropzone({
  file,
  onFileChange,
  accept,
  hint,
  status = "idle",
  progress = 0,
  errorMessage,
}) {
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const disabled = status === "uploading";

  const handleFiles = (fileList) => {
    if (disabled) return;
    const picked = fileList?.[0];
    if (picked) onFileChange(picked);
  };

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
          disabled ? "cursor-not-allowed opacity-70" : ""
        } ${
          status === "error"
            ? "border-red-300 bg-red-50"
            : isDragActive
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {!file ? (
          <>
            <UploadCloud size={22} className="text-gray-400" />
            <p className="text-sm text-gray-600">
              <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
            </p>
            {hint && <p className="text-xs text-gray-400">{hint}</p>}
          </>
        ) : (
          <div
            className="flex w-full items-center gap-3 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText size={20} className="shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              {status === "uploading" && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {status === "error" && errorMessage && (
                <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
              )}
            </div>
            <div className="shrink-0">
              {status === "uploading" && <Loader2 size={18} className="animate-spin text-blue-500" />}
              {status === "done" && <CheckCircle2 size={18} className="text-green-500" />}
              {status === "error" && <AlertCircle size={18} className="text-red-500" />}
              {status === "idle" && (
                <button
                  type="button"
                  onClick={() => onFileChange(null)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  aria-label="Remove file"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileDropzone;
