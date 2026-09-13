import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children }) {
  return (
    // backdrop
    <div
      onClick={onClose}
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors
        ${open ? "visible bg-black/40" : "invisible bg-transparent"}
      `}
    >
      {/* modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          relative flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl transition-all max-h-[85vh]
          ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}
        `}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 rounded-lg p-1.5 text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
