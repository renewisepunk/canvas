"use client";

import React, { useState, useEffect } from 'react';
import { EditorState, Tool } from '@/app/page';
import { Type, MousePointer2 } from 'lucide-react';

interface ToolbarProps {
    editorState: EditorState;
    setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
    currentTool: Tool;
    setCurrentTool: React.Dispatch<React.SetStateAction<Tool>>;
}

interface GoogleFont {
    family: string;
}

const Toolbar: React.FC<ToolbarProps> = ({ editorState, setEditorState, currentTool, setCurrentTool }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [googleFonts, setGoogleFonts] = useState<GoogleFont[]>([]);

  useEffect(() => {
    fetch('/google-fonts.json')
      .then(res => res.json())
      .then(data => setGoogleFonts(data));
  }, []);

  return (
    <div className="fixed top-1/2 left-4 -translate-y-1/2 bg-gray-800 border border-gray-600 shadow-xl rounded-lg p-2 flex flex-col gap-4 z-10">
      <button 
        className={`w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-700 text-white ${currentTool === 'select' ? 'bg-gray-600' : ''}`}
        onClick={() => setCurrentTool('select')}
      >
        <MousePointer2 />
      </button>
      <button 
        className={`w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-700 text-white ${currentTool === 'text' ? 'bg-gray-600' : ''}`}
        onClick={() => {
            setCurrentTool('text');
            setShowFontPicker(!showFontPicker);
        }}
      >
        <Type />
      </button>

      {showFontPicker && currentTool === 'text' && (
        <div className="absolute left-14 top-0 bg-gray-800 border border-gray-600 shadow-lg rounded-lg p-2 w-48">
          <p className="text-sm font-semibold mb-2 text-white">Select Font</p>
          <select 
            value={editorState.fontFamily} 
            onChange={(e) => setEditorState({...editorState, fontFamily: e.target.value})}
            className="w-full p-1 border border-gray-600 rounded-md bg-gray-700 text-white"
          >
            {googleFonts.map(font => (
                <option key={font.family} value={font.family}>{font.family}</option>
            ))}
          </select>
        </div>
      )}

      <button 
        className="w-10 h-10 rounded-md hover:bg-gray-700 flex items-center justify-center"
        onClick={() => setShowColorPicker(!showColorPicker)}
      >
        <div style={{backgroundColor: editorState.color}} className="w-6 h-6 rounded-full border-2 border-gray-600"></div>
      </button>

      {showColorPicker && (
        <div className="absolute left-14 top-12 bg-gray-800 border border-gray-600 shadow-lg rounded-lg p-2">
            <p className="text-sm font-semibold mb-2 text-white">Select Color</p>
            <input 
                type="color" 
                value={editorState.color}
                onChange={(e) => setEditorState({...editorState, color: e.target.value})}
            />
        </div>
      )}
    </div>
  );
};

export default Toolbar;
