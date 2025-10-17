# InfiniteCanvas Component Implementation Documentation

## Overview

The `InfiniteCanvas` component is a React component that provides an infinite scrolling canvas using PixiJS for rendering interactive images. It supports dragging, scaling, and manipulation of images with a sophisticated interaction system.

## Core Architecture

### Main Component Structure

```typescript
interface InfiniteCanvasProps {
  currentTool: Tool;
  editorState: EditorState;
}
```

The component manages:
- PixiJS Application instance
- Main container for infinite scrolling
- Array of draggable/resizable images
- Canvas panning functionality
- Auto-save with debouncing

### Key State Management

```typescript
const [images, setImages] = useState<DraggableImage[]>([]);
const [selectedImage, setSelectedImage] = useState<DraggableImage | null>(null);
const [isDragging, setIsDragging] = useState(false);
```

## DraggableResizable Class

The core interactive element is the `DraggableResizable` class that extends `PIXI.Container`.

### Components

1. **Sprite**: The actual image with center anchor for scaling
2. **Frame**: Selection border around the image
3. **Handle**: Resize handle at bottom-right corner

### Dragging Implementation

#### What Works for Dragging

**Pointer Event System**:
- Uses PixiJS's federated pointer events (`pointerdown`, `pointermove`, `pointerup`)
- Tracks `pointerId` for multi-touch support
- Stores drag offset to prevent jumping

**Coordinate System**:
- Uses global coordinates (`e.global`) for consistent positioning
- Calculates offset between pointer and container position
- Updates container position directly during drag

**Event Handling**:
```typescript
onDragStart(e: PIXI.FederatedPointerEvent): void {
  this.dragging = true;
  this.dragPointerId = e.pointerId;
  this.sprite.cursor = 'grabbing';
  
  // Store offset between pointer and container position
  const gp = e.global;
  this.dragOffset.set(gp.x - this.x, gp.y - this.y);
}
```

**Key Success Factors**:
- ✅ Uses `eventMode = 'static'` for proper event handling
- ✅ Tracks pointer ID to prevent multi-touch conflicts
- ✅ Uses global coordinates for consistent positioning
- ✅ Updates position directly on container
- ✅ Emits 'moved' event for state synchronization

### Scaling Implementation

#### What Works for Scaling

**Resize Handle System**:
- Bottom-right corner handle with visual feedback
- Uses distance-based scaling from center point
- Preserves aspect ratio automatically

**Wheel-based Scaling**:
- Mouse wheel scaling with exponential mapping
- Ctrl+wheel for stronger scaling
- Uses same scale constraints as resize handle

**Scale Constraints**:
```typescript
getScaleConstraints(): { min: number; max: number } {
  const minPx = 20;
  const minTexDim = Math.min(this.sprite.texture.width, this.sprite.texture.height);
  const minScale = Math.max(0.05, minPx / minTexDim);
  const maxScale = 8;
  return { min: minScale, max: maxScale };
}
```

**Key Success Factors**:
- ✅ Uses global coordinates for resize calculations
- ✅ Distance-based scaling from center point
- ✅ Proper event listener management (attach/remove from stage)
- ✅ Visual feedback during resize (handle alpha)
- ✅ Scale constraints prevent extreme values
- ✅ Exponential wheel scaling for consistent feel

#### Resize Handle Implementation

**Visual Design**:
- 16x16 pixel handle at bottom-right corner
- Blue fill with white border and diagonal lines
- Larger hit area (48x48) for easier interaction

**Interaction Logic**:
```typescript
onResizeStart(e: PIXI.FederatedPointerEvent): void {
  e.stopPropagation(); // Prevent sprite drag
  
  // Calculate starting distance in global space
  const globalPoint = e.global.clone();
  const thisGlobal = this.parent.toGlobal(new PIXI.Point(this.x, this.y));
  this.startProj = Math.hypot(
    globalPoint.x - thisGlobal.x,
    globalPoint.y - thisGlobal.y
  );
  
  // Attach global event listeners
  const root = this.getInteractiveRoot();
  if (root) {
    root.on('pointermove', this.boundOnResizeMove);
    root.on('pointerup', this.boundOnResizeEnd);
  }
}
```

## Canvas Panning

### Implementation Details

**Panning Logic**:
- Only starts when clicking on empty canvas (not on sprites)
- Uses pointer events with global coordinates
- Updates container position directly

**Event Handling**:
```typescript
container.on('pointerdown', (event) => {
  if (event.target === container) {
    const pointer = event.global;
    lastPointerPosition = { x: pointer.x, y: pointer.y };
    isPanning = true;
  }
});
```

## Image Management

### Adding Images

**Drag & Drop Support**:
- Handles file drops on canvas
- Converts screen coordinates to container local space
- Uses `Assets.load()` for proper texture loading

**Texture Optimization**:
```typescript
// Enable mipmapping for smooth scaling
texture.source.autoGenerateMipmaps = true;
texture.source.scaleMode = 'linear';
```

### State Synchronization

**Event-driven Updates**:
- Images emit 'moved' and 'resized' events
- Component updates React state accordingly
- Debounced auto-save prevents excessive API calls

**Debounced Auto-save**:
```typescript
const debouncedAutoSave = () => {
  if (saveDebounceRef.current) {
    window.clearTimeout(saveDebounceRef.current);
  }
  saveDebounceRef.current = window.setTimeout(() => {
    if (images.length > 0) {
      saveToAPI();
    }
  }, 2000);
};
```

## Performance Optimizations

### Rendering Optimizations

1. **Pixel-perfect positioning**: `Math.round(x)` for crisp rendering
2. **Mipmapping**: Enabled for smooth scaling at all zoom levels
3. **Linear scaling**: Better quality than nearest neighbor
4. **Event mode management**: Proper event handling without performance impact

### Memory Management

1. **Texture cleanup**: Proper destruction of PixiJS objects
2. **Event listener cleanup**: Removal of global event listeners
3. **Invalid image filtering**: Cleanup of corrupted image data

## API Integration

### Data Structure

```typescript
interface CanvasData {
  images: StoredImageData[];
  canvasPosition: {
    x: number;
    y: number;
  };
}

interface StoredImageData {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
}
```

### Save/Load Operations

- **Save**: POST to `/api/canvas` with current state
- **Load**: GET from `/api/canvas` and recreate all images
- **Validation**: Filters out invalid image URLs before saving

## Key Implementation Patterns

### 1. Event Delegation
- Use stage-level events for resize operations
- Prevent event bubbling for nested interactions
- Track pointer IDs for multi-touch support

### 2. Coordinate System Management
- Always use global coordinates for calculations
- Convert between global and local spaces as needed
- Store offsets to prevent jumping during interactions

### 3. State Management
- Emit events from PixiJS objects to React
- Use refs to avoid unnecessary re-renders
- Debounce expensive operations like API calls

### 4. Visual Feedback
- Change cursor styles during interactions
- Modify handle alpha during resize
- Show/hide selection frames appropriately

## Common Pitfalls and Solutions

### 1. Event Handling Issues
**Problem**: Events not firing or conflicting
**Solution**: Use `eventMode = 'static'` and proper event delegation

### 2. Coordinate System Confusion
**Problem**: Objects jumping or positioning incorrectly
**Solution**: Always use global coordinates for calculations, convert to local as needed

### 3. Performance Issues
**Problem**: Laggy interactions or memory leaks
**Solution**: Proper cleanup, mipmapping, and debounced operations

### 4. Scale Constraints
**Problem**: Objects becoming too small/large or losing aspect ratio
**Solution**: Implement proper min/max constraints and preserve aspect ratio

## Best Practices

1. **Always use global coordinates** for interaction calculations
2. **Implement proper scale constraints** to prevent extreme values
3. **Use debounced auto-save** to avoid excessive API calls
4. **Enable mipmapping** for smooth scaling at all zoom levels
5. **Clean up event listeners** to prevent memory leaks
6. **Use pixel-perfect positioning** for crisp rendering
7. **Implement proper error handling** for texture loading failures
8. **Track pointer IDs** for multi-touch support

This implementation provides a robust foundation for interactive canvas applications with smooth dragging and scaling capabilities.
