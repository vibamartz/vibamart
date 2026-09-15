import React, { useRef, useState } from 'react';
import { Upload, Link, Trash2, Image as ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface VariantImageInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  imageTypeLabel?: string;
}

export function VariantImageInput({ value, onChange, disabled, label, imageTypeLabel = 'Image' }: VariantImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];
    if (!acceptedTypes.includes(file.type)) {
      toast.error('Supported formats: JPG, PNG, WEBP, GIF, SVG, AVIF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10 MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setImageError(false);
        onChange(result);
        toast.success(`${imageTypeLabel} uploaded`);
      }
    };
    reader.readAsDataURL(file);

    // Reset input value to allow selecting the same file again if replaced
    e.target.value = '';
  };

  const handleUrlChange = (newUrl: string) => {
    setImageError(false);
    onChange(newUrl);
  };

  const handleRemove = () => {
    setImageError(false);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isDataUrl = value?.startsWith('data:image/');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3 text-gray-400" />
          {label || 'Image (Upload File or Enter Link)'}
        </label>
        {value ? (
          <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
            {isDataUrl ? 'Uploaded File' : 'URL Link'}
          </span>
        ) : null}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        disabled={disabled}
      />

      <div className="space-y-3">
        {/* Controls: Upload Button + URL Input */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="px-4 py-2.5 bg-gray-900 text-white hover:bg-black rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>

          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Link className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none border border-gray-200 focus:border-gray-400 transition-colors text-gray-800"
              placeholder="Or paste image URL (https://...)"
              value={value || ''}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Image Preview Card */}
        {value ? (
          <div className="relative group p-3 bg-white rounded-2xl border border-gray-200 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0 relative flex items-center justify-center">
              {!imageError ? (
                <img
                  src={value}
                  alt="Variant preview"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-1 text-center">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  <span className="text-[7px] font-bold text-rose-500 leading-tight">Invalid URL</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">
                {isDataUrl ? 'Local File Uploaded' : value}
              </p>
              <p className="text-[9px] font-semibold text-gray-400">
                {imageError ? 'Unable to load image from provided link' : 'Image ready for variant'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                title="Replace Image File"
                className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                title="Remove Image"
                className="p-2 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default VariantImageInput;
