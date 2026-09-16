import React, { useRef, useState } from 'react';
import { Upload, Link, Trash2, Image as ImageIcon, RefreshCw, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
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

export interface VariantMultiImageInputProps {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  maxImages?: number;
}

export function VariantMultiImageInput({ images = [], onChange, disabled, maxImages = 8 }: VariantMultiImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  const handleFilesAdded = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum limit of ${maxImages} images reached for this variant.`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.error(`Only ${remainingSlots} image slot(s) remaining out of ${maxImages} max.`);
    }

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];
    const validFiles = filesToProcess.filter(f => {
      if (!acceptedTypes.includes(f.type)) {
        toast.error(`Skipped ${f.name}: Invalid format.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`Skipped ${f.name}: Exceeds 10 MB limit.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    let readCount = 0;
    const loadedImages: string[] = [];
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          loadedImages.push(result);
        }
        readCount++;
        if (readCount === validFiles.length) {
          const updated = [...images, ...loadedImages].slice(0, maxImages);
          onChange(updated);
          toast.success(`Added ${loadedImages.length} image(s) to variant`);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed per variant.`);
      return;
    }
    const updated = [...images, trimmed].slice(0, maxImages);
    onChange(updated);
    setUrlInput('');
    toast.success('Image link added to variant');
  };

  const moveLeft = (index: number) => {
    if (index <= 0) return;
    const list = [...images];
    const temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;
    onChange(list);
  };

  const moveRight = (index: number) => {
    if (index >= images.length - 1) return;
    const list = [...images];
    const temp = list[index + 1];
    list[index + 1] = list[index];
    list[index] = temp;
    onChange(list);
  };

  const triggerReplace = (index: number) => {
    setReplacingIndex(index);
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replacingIndex === null) return;

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];
    if (!acceptedTypes.includes(file.type)) {
      toast.error('Supported formats: JPG, PNG, WEBP, GIF, SVG, AVIF');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const list = [...images];
        list[replacingIndex] = result;
        onChange(list);
        toast.success(`Variant image #${replacingIndex + 1} replaced`);
      }
      setReplacingIndex(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const list = images.filter((_, i) => i !== index);
    onChange(list);
    toast.success(`Removed variant image #${index + 1}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
          Variant Gallery Images (Max 8 Images)
        </label>
        <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
          images.length >= maxImages
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {images.length} / {maxImages} Images
        </span>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesAdded}
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled || images.length >= maxImages}
      />
      <input
        type="file"
        ref={replaceFileInputRef}
        onChange={handleReplaceFile}
        accept="image/*"
        className="hidden"
        disabled={disabled}
      />

      {images.length < maxImages ? (
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File(s)
          </button>

          <div className="relative flex-1 flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Link className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <input
                type="text"
                className="w-full bg-gray-50 focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none border border-gray-200 focus:border-gray-400 transition-colors text-gray-800"
                placeholder="Or paste image URL (https://...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                disabled={disabled}
              />
            </div>
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={disabled || !urlInput.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 disabled:opacity-40 cursor-pointer"
            >
              + Add Link
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-center text-xs font-bold text-amber-800">
          Maximum limit of {maxImages} images reached for this variant. Remove or replace an image to add a new one.
        </div>
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {images.map((imgUrl, idx) => {
            const isDataUrl = imgUrl.startsWith('data:image/');
            return (
              <div
                key={idx}
                className="relative group bg-white p-2 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-2 shadow-sm"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 relative flex items-center justify-center">
                  <img
                    src={imgUrl}
                    alt={`Variant image ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).setAttribute('src', 'https://via.placeholder.com/150?text=Invalid+URL');
                    }}
                  />
                  <span className="absolute top-1 left-1 bg-black/75 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    #{idx + 1} {idx === 0 ? 'Primary' : ''}
                  </span>
                </div>

                <div className="text-[8px] font-bold text-gray-500 truncate px-1" title={isDataUrl ? 'Uploaded File' : imgUrl}>
                  {isDataUrl ? 'Uploaded File' : 'URL Link'}
                </div>

                <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-100">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveLeft(idx)}
                      disabled={disabled || idx === 0}
                      title="Move Left"
                      className="p-1 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRight(idx)}
                      disabled={disabled || idx === images.length - 1}
                      title="Move Right"
                      className="p-1 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => triggerReplace(idx)}
                      disabled={disabled}
                      title="Replace Image"
                      className="p-1 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      disabled={disabled}
                      title="Remove Image"
                      className="p-1 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center text-xs font-bold text-gray-400 italic bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
          No variant images added yet. Upload files or paste links above (up to 8 images).
        </div>
      )}
    </div>
  );
}

export default VariantImageInput;

