"use client";

import InfiniteCanvas from "@/components/InfiniteCanvas";
import Toolbar from "@/components/Toolbar";
import { useState } from "react";

export type Tool = "select" | "text";

export interface EditorState {
  color: string;
  fontFamily: string;
}

export default function Home() {
  const [editorState, setEditorState] = useState<EditorState>({
    color: "#000000",
    fontFamily: "Roboto",
  });
  const [currentTool, setCurrentTool] = useState<Tool>("select");

  return (
    <main>
      <Toolbar
        editorState={editorState}
        setEditorState={setEditorState}
        currentTool={currentTool}
        setCurrentTool={setCurrentTool}
      />
      <InfiniteCanvas currentTool={currentTool} editorState={editorState} />
    </main>
  );
}
