'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface GeminiImagePromptProps {
  selectedImageId: string | null;
  selectedImageUrl: string | null;
  onImageGenerated: (imageUrl: string, x: number, y: number) => void;
  onImageUpdated: (imageId: string, newImageUrl: string) => void;
  onClose: () => void;
}


export default function GeminiImagePrompt({
  selectedImageId,
  selectedImageUrl,
  onImageGenerated,
  onImageUpdated,
  onClose
}: GeminiImagePromptProps) {
  const [prompt, setPrompt] = useState('');
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyze prompt to determine intent
  const analyzePromptIntent = (text: string): 'create' | 'update' => {
    const createKeywords = [
      'create', 'generate', 'make', 'new', 'version of this', 'copies', 'copy',
      'variations', 'variation', 'different', 'another', 'more', 'additional'
    ];
    
    const lowerText = text.toLowerCase();
    return createKeywords.some(keyword => lowerText.includes(keyword)) ? 'create' : 'update';
  };


  // Handle file upload for style reference
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setStyleImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate/update image using Gemini
  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const intent = analyzePromptIntent(prompt);
      
      // Prepare request data
      const requestData: {
        prompt: string;
        intent: string;
        styleImage?: string;
        selectedImage?: string;
      } = {
        prompt,
        intent
      };

      // Add style reference image if provided
      if (styleImage) {
        requestData.styleImage = styleImage;
      }

      // Always include selected image if available (used as source or reference)
      if (selectedImageUrl) {
        requestData.selectedImage = selectedImageUrl;
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const result = await response.json();
      
      if (result.success && result.imageUrl) {
        if (intent === 'create') {
          // Generate new image at random position
          const x = Math.random() * 400 + 100;
          const y = Math.random() * 400 + 100;
          onImageGenerated(result.imageUrl, x, y);
        } else {
          // Update existing image
          if (selectedImageId) {
            onImageUpdated(selectedImageId, result.imageUrl);
          }
        }
        
        onClose();
      } else {
        throw new Error('No image generated');
      }

    } catch (error) {
      console.error('Gemini API error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, styleImage, selectedImageUrl, selectedImageId, onImageGenerated, onImageUpdated, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [prompt, styleImage, handleSubmit, onClose]);

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {selectedImageId ? 'Edit Image' : 'Generate Image'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Style reference image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Style Reference (Optional)
            </label>
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 border"
              >
                {styleImage ? 'Change Image' : 'Upload Image'}
              </button>
              {styleImage && (
                <div className="flex items-center space-x-2">
                  <Image
                    src={styleImage}
                    alt="Style reference"
                    width={32}
                    height={32}
                    className="object-cover rounded border"
                  />
                  <button
                    onClick={() => setStyleImage(null)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Prompt input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                selectedImageId
                  ? "Describe how to modify the selected image..."
                  : "Describe the image you want to create..."
              }
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Press Cmd/Ctrl + Enter to submit, Esc to close
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !prompt.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>
                  {isLoading
                    ? 'Generating...'
                    : selectedImageId
                    ? 'Update Image'
                    : 'Generate Image'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
