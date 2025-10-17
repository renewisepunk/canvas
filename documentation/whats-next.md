# What's Next - Canvas Text Tool Improvements

## Current Status
The text tool has been implemented with basic functionality, but several critical issues remain that need to be addressed for a production-ready experience.

## Priority Issues to Fix

### 1. Text Saving Issues ❌
**Problem**: Text elements are not being saved to the JSON canvas data
- Text creation works visually but doesn't persist after page refresh
- Auto-save triggers but text data is not included in the saved JSON
- Debug logs show text creation but no save confirmation

**Impact**: Users lose all text work when refreshing or navigating away

### 2. Buggy Dragging Behavior ❌
**Problem**: Text dragging is limited and buggy
- Dragging feels unresponsive or jerky
- Text elements don't follow mouse cursor smoothly
- Drag handles may not be positioned correctly
- Event handling conflicts between text and container

**Impact**: Poor user experience, text positioning is unreliable

### 3. Text Selection and Font Management ❌
**Problem**: No way to select existing text and change fonts
- Once text is committed, users cannot edit it
- No way to change font family, size, or color after creation
- No text editing mode or inline editing capability
- Typing on screen management is incomplete

**Impact**: Users must delete and recreate text to make changes

## Technical Areas to Address

### Text State Management
- Ensure text elements are properly included in `saveToAPI` function
- Fix dependency arrays in `useCallback` hooks for text operations
- Implement proper text state synchronization between PixiJS and React

### Event Handling Improvements
- Fix drag event propagation and handling
- Improve resize handle positioning and interaction
- Resolve conflicts between text selection and canvas interactions
- Implement proper event delegation for text elements

### Text Editing Workflow
- Add text selection mode (click to select existing text)
- Implement inline text editing (double-click to edit)
- Add font picker integration for selected text
- Create text properties panel for selected text elements

### Typing Experience
- Improve direct canvas typing experience
- Add visual feedback for typing mode
- Implement proper text cursor positioning
- Handle text overflow and wrapping

## Implementation Plan

### Phase 1: Fix Core Functionality
1. **Debug and fix text saving**
   - Add comprehensive logging to text save/load process
   - Verify text data structure in JSON
   - Test auto-save triggers for text changes

2. **Improve dragging mechanics**
   - Refactor drag event handling in `DraggableResizableText`
   - Fix drag offset calculations
   - Improve visual feedback during dragging

### Phase 2: Enhanced Text Management
1. **Implement text selection**
   - Add click-to-select functionality
   - Visual selection indicators
   - Multi-text selection support

2. **Add text editing capabilities**
   - Double-click to edit text content
   - Font family/size/color changes for selected text
   - Text properties panel

### Phase 3: Polish and UX
1. **Improve typing experience**
   - Better cursor positioning
   - Text wrapping and overflow handling
   - Keyboard shortcuts for text operations

2. **Performance optimizations**
   - Optimize text rendering for large canvases
   - Implement text virtualization if needed
   - Improve font loading performance

## Testing Checklist

### Text Saving
- [ ] Create text element
- [ ] Move text element
- [ ] Scale text element
- [ ] Refresh page
- [ ] Verify text persists with correct properties

### Text Interaction
- [ ] Click to select text
- [ ] Drag text smoothly
- [ ] Scale text with handle
- [ ] Double-click to edit
- [ ] Change font properties

### Typing Experience
- [ ] Press 'T' to start typing
- [ ] Type directly on canvas
- [ ] Press Enter to commit
- [ ] Click outside to commit
- [ ] Visual feedback during typing

## Related Files
- `src/components/InfiniteCanvas.tsx` - Main text implementation
- `src/components/Toolbar.tsx` - Font selection UI
- `src/app/api/canvas/route.ts` - Canvas data persistence
- `public/canvas-data.json` - Saved canvas data

## Notes
- Current implementation uses PixiJS for text rendering
- Google Fonts integration is partially working
- Event system needs significant improvements
- State management between PixiJS and React needs better synchronization
