import * as React from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for PhotoUploadField component
 */
export interface PhotoUploadFieldProps {
  /** Current file value (single file or array) */
  value?: File | File[] | null;
  /** Callback when files change */
  onChange: (files: File[] | null) => void;
  /** Label for the field */
  label?: string;
  /** Whether to allow multiple file selection */
  multiple?: boolean;
  /** Maximum number of files (only for multiple mode) */
  maxFiles?: number;
  /** Accepted file types (default: 'image/*') */
  accept?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Additional className */
  className?: string;
  /** Show preview thumbnails */
  showPreview?: boolean;
  /** Maximum file size in bytes (default: 5MB) */
  maxFileSize?: number;
}

/**
 * PhotoUploadField - File input with preview, validation, and multiple file support
 *
 * @example
 * Single file upload:
 * ```tsx
 * <PhotoUploadField
 *   value={photo}
 *   onChange={(files) => setPhoto(files?.[0] || null)}
 *   label="Profile Photo"
 *   showPreview
 *   required
 * />
 * ```
 *
 * Multiple files upload:
 * ```tsx
 * <PhotoUploadField
 *   value={photos}
 *   onChange={setPhotos}
 *   label="Application Photos"
 *   multiple
 *   maxFiles={5}
 *   showPreview
 * />
 * ```
 *
 * Features:
 * - Single or multiple file support
 * - Preview thumbnails for selected images
 * - File count display
 * - Remove individual file functionality
 * - File size and type validation
 * - Upload icon indicator
 * - Accessible with proper ARIA attributes
 */
export function PhotoUploadField({
  value,
  onChange,
  label,
  multiple = false,
  maxFiles = 10,
  accept = 'image/*',
  disabled = false,
  required = false,
  className,
  showPreview = true,
  maxFileSize = 5 * 1024 * 1024, // 5MB default
}: PhotoUploadFieldProps) {
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Normalize value to always be an array for easier handling
  const files = React.useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];

    // Validate file count
    if (multiple && selectedFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file sizes
    const oversizedFiles = selectedFiles.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      setError(`File size must be less than ${(maxFileSize / (1024 * 1024)).toFixed(0)}MB`);
      return;
    }

    // Validate file types
    const invalidFiles = selectedFiles.filter(file => {
      if (accept === 'image/*') {
        return !file.type.startsWith('image/');
      }
      const acceptedTypes = accept.split(',').map(type => type.trim());
      return !acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'));
        }
        return file.type === type;
      });
    });

    if (invalidFiles.length > 0) {
      setError('Invalid file type');
      return;
    }

    onChange(selectedFiles.length > 0 ? selectedFiles : null);

    // Reset input value to allow re-selecting the same file
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onChange(newFiles.length > 0 ? newFiles : null);
    setError(null);
  };

  const handleClearAll = () => {
    onChange(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          disabled={disabled}
          required={required}
          aria-label={label}
          className="cursor-pointer"
        />
        {files.length > 0 && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* File Count Display */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" />
          <span>
            {files.length} {files.length === 1 ? 'file' : 'files'} selected
            {multiple && maxFiles && ` (max ${maxFiles})`}
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Preview Thumbnails */}
      {showPreview && files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
          {files.map((file, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg border border-border overflow-hidden group"
            >
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                  onLoad={(e) => {
                    // Cleanup object URL to avoid memory leaks
                    URL.revokeObjectURL((e.target as HTMLImageElement).src);
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {!disabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
