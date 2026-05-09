import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import type { Photo } from '../../types';

interface PhotoUploadProps {
  applicationId?: string;
  stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED';
  photos: Photo[];
  onUpload: (file: File, stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED') => Promise<void>;
  onDelete: (photoId: string) => void;
  label: string;
}

export default function PhotoUpload({
  stage,
  photos,
  onUpload,
  onDelete,
  label,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true);
      try {
        for (const file of acceptedFiles) {
          await onUpload(file, stage);
        }
      } finally {
        setUploading(false);
      }
    },
    [onUpload, stage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    multiple: true,
  });

  const stagePhotos = photos.filter((p) => p.stage === stage);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          {uploading
            ? 'Uploading...'
            : isDragActive
            ? 'Drop the files here...'
            : 'Drag & drop photos here, or click to select'}
        </p>
        <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP up to 10MB</p>
      </div>

      {/* Photo Preview Grid */}
      {stagePhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {stagePhotos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.thumbnail_url || photo.file_url}
                alt="Upload preview"
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => onDelete(photo.id)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              {photo.gps_lat && photo.gps_lng && (
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  GPS: {photo.gps_lat.toFixed(4)}, {photo.gps_lng.toFixed(4)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {stagePhotos.length === 0 && (
        <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
          <ImageIcon className="mx-auto h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500 mt-2">No photos uploaded yet</p>
        </div>
      )}
    </div>
  );
}
