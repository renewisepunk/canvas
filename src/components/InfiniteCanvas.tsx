'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Assets } from 'pixi.js';
import { EditorState, Tool } from '@/app/page';
import GeminiImagePrompt from './GeminiImagePrompt';

class DraggableResizableText extends PIXI.Container {
  text!: PIXI.Text;
  frame: PIXI.Graphics;
  handle: PIXI.Graphics;
  id: string;

  // drag state
  dragging = false;
  dragPointerId: number | null = null;
  dragOffset = new PIXI.Point();

  // resize state
  resizing = false;
  resizePointerId: number | null = null;
  private startProj = 0;  // starting distance from center to pointer
  private startScale = 1;

  // Bound event handlers for stage-level events (so we can add/remove them)
  private boundOnResizeMove: (e: PIXI.FederatedPointerEvent) => void;
  private boundOnResizeEnd: (e: PIXI.FederatedPointerEvent) => void;

  constructor(textContent: string, id: string, fontFamily: string, color: string) {
    super();

    this.id = id;

    // Bind resize handlers so they can be added/removed from stage
    this.boundOnResizeMove = this.onResizeMove.bind(this);
    this.boundOnResizeEnd = this.onResizeEnd.bind(this);

    // Initialize frame and handle first
    this.frame = new PIXI.Graphics();
    this.addChild(this.frame);

    this.handle = new PIXI.Graphics();
    this.addChild(this.handle);

    // Load font for PixiJS if it's a Google Font
    this.loadFontForPixi(fontFamily).then(() => {
      console.log('Font loaded, creating PixiJS text with font:', fontFamily);
      
      // Text sprite
      this.text = new PIXI.Text({
        text: textContent,
        style: {
          fontFamily: `"${fontFamily}", Arial, sans-serif`,
          fontSize: 24,
          fill: color,
          align: 'left',
        }
      });
      this.text.anchor.set(0.5); // scale from center
      this.addChild(this.text);

      // Make text draggable
      this.text.eventMode = 'static';
      this.text.cursor = 'grab';
      this.text.on('pointerdown', this.onDragStart, this);
      this.text.on('pointerup', this.onDragEnd, this);
      this.text.on('pointerupoutside', this.onDragEnd, this);
      this.text.on('pointermove', this.onDragMove, this);

      // Make handle resizable
      this.handle.eventMode = 'static';
      this.handle.cursor = 'nwse-resize';
      this.handle.on('pointerdown', this.onResizeStart, this);

      // Make the entire container interactive for selection
      this.eventMode = 'static';
      this.cursor = 'pointer';

      this._redrawFrame();
      
      console.log('PixiJS text created successfully');
    }).catch((error) => {
      console.error('Failed to load font, using fallback:', error);
      
      // Fallback with Arial
      this.text = new PIXI.Text({
        text: textContent,
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 24,
          fill: color,
          align: 'left',
        }
      });
      this.text.anchor.set(0.5);
      this.addChild(this.text);

      // Make text draggable
      this.text.eventMode = 'static';
      this.text.cursor = 'grab';
      this.text.on('pointerdown', this.onDragStart, this);
      this.text.on('pointerup', this.onDragEnd, this);
      this.text.on('pointerupoutside', this.onDragEnd, this);
      this.text.on('pointermove', this.onDragMove, this);

      // Make handle resizable
      this.handle.eventMode = 'static';
      this.handle.cursor = 'nwse-resize';
      this.handle.on('pointerdown', this.onResizeStart, this);

      // Make the entire container interactive for selection
      this.eventMode = 'static';
      this.cursor = 'pointer';

      this._redrawFrame();
    });
  }

  private async loadFontForPixi(fontFamily: string): Promise<void> {
    console.log('Loading font for PixiJS:', fontFamily);
    
    // For Google Fonts, we need to ensure they're loaded for PixiJS
    if (fontFamily !== 'Roboto' && fontFamily !== 'Arial' && fontFamily !== 'Helvetica' && fontFamily !== 'Times New Roman') {
      try {
        // Check if font is already loaded
        const existingLink = document.querySelector(`link[href*="${fontFamily.replace(/\s+/g, '+')}"]`);
        if (!existingLink) {
          console.log('Loading Google Font:', fontFamily);
          // Load Google Font
          const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400&display=swap`;
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = fontUrl;
          document.head.appendChild(link);
          
          // Wait for font to load
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          console.log('Font already loaded, waiting briefly');
          // Font already loaded, wait a bit
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Force font loading by creating a test element
        const testElement = document.createElement('div');
        testElement.style.fontFamily = `"${fontFamily}", Arial, sans-serif`;
        testElement.style.position = 'absolute';
        testElement.style.left = '-9999px';
        testElement.style.fontSize = '16px';
        testElement.textContent = 'Test';
        document.body.appendChild(testElement);
        
        // Wait a bit more for font to be available
        await new Promise(resolve => setTimeout(resolve, 500));
        
        document.body.removeChild(testElement);
        console.log('Font loading completed for:', fontFamily);
      } catch (error) {
        console.warn('Failed to load Google Font for PixiJS:', fontFamily, error);
      }
    } else {
      console.log('Using system font:', fontFamily);
      // System font, just wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ---- Dragging
  onDragStart(e: PIXI.FederatedPointerEvent): void {
    this.dragging = true;
    this.dragPointerId = e.pointerId;
    const localPos = this.text.toLocal(e.global);
    this.dragOffset.set(localPos.x, localPos.y);
  }

  onDragEnd(e: PIXI.FederatedPointerEvent): void {
    if (this.dragging && this.dragPointerId === e.pointerId) {
      this.dragging = false;
      this.dragPointerId = null;
      this.text.cursor = 'grab';
      
      // Emit moved event for state management
      this.emit('moved', { x: this.x, y: this.y });
    }
  }

  onDragMove(e: PIXI.FederatedPointerEvent): void {
    if (this.dragging && this.dragPointerId === e.pointerId) {
      const globalPos = e.global;
      const localPos = this.parent?.toLocal(globalPos);
      if (localPos) {
        this.x = localPos.x - this.dragOffset.x;
        this.y = localPos.y - this.dragOffset.y;
        this.text.cursor = 'grabbing';
      }
    }
  }

  // ---- Resizing
  onResizeStart(e: PIXI.FederatedPointerEvent): void {
    this.resizing = true;
    this.resizePointerId = e.pointerId;
    
    // Calculate initial distance from center to pointer
    const globalPos = e.global;
    const localPos = this.parent?.toLocal(globalPos);
    if (localPos) {
      const dx = localPos.x - this.x;
      const dy = localPos.y - this.y;
      this.startProj = Math.sqrt(dx * dx + dy * dy);
      this.startScale = this.text.scale.x;

      // Add global event listeners for resize
      const stage = this.parent?.parent;
      if (stage) {
        stage.on('pointermove', this.boundOnResizeMove);
        stage.on('pointerup', this.boundOnResizeEnd);
        stage.on('pointerupoutside', this.boundOnResizeEnd);
      }
    }
  }

  onResizeMove(e: PIXI.FederatedPointerEvent): void {
    if (this.resizing && this.resizePointerId === e.pointerId) {
      const globalPos = e.global;
      const localPos = this.parent?.toLocal(globalPos);
      if (localPos) {
        const dx = localPos.x - this.x;
        const dy = localPos.y - this.y;
        const currentProj = Math.sqrt(dx * dx + dy * dy);
        
        const scaleFactor = currentProj / this.startProj;
        const newScale = Math.max(0.1, Math.min(5, this.startScale * scaleFactor));
        
        this.text.scale.set(newScale);
        this._redrawFrame();
      }
    }
  }

  onResizeEnd(e: PIXI.FederatedPointerEvent): void {
    if (this.resizing && this.resizePointerId === e.pointerId) {
      this.resizing = false;
      this.resizePointerId = null;
      
      // Remove global event listeners
      const stage = this.parent?.parent;
      if (stage) {
        stage.off('pointermove', this.boundOnResizeMove);
        stage.off('pointerup', this.boundOnResizeEnd);
        stage.off('pointerupoutside', this.boundOnResizeEnd);
      }
      
      // Emit scaled event for state management
      this.emit('scaled', { scale: this.text.scale.x });
    }
  }

  // ---- Visual feedback
  showSelection(): void {
    this.frame.visible = true;
    this.handle.visible = true;
  }

  hideSelection(): void {
    this.frame.visible = false;
    this.handle.visible = false;
  }

  getScale(): number {
    return this.text.scale.x;
  }

  setScale(scale: number): void {
    this.text.scale.set(scale);
    this._redrawFrame();
  }

  private _redrawFrame(): void {
    if (!this.text) return;
    
    const bounds = this.text.getBounds();
    const padding = 4;
    
    // Selection frame
    this.frame.clear();
    this.frame.lineStyle(2, 0x007AFF, 1);
    this.frame.drawRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2
    );
    
    // Corner handle (bottom-right) - positioned relative to the frame
    this.handle.clear();
    this.handle.beginFill(0x007AFF);
    this.handle.drawRect(
      bounds.x + bounds.width - padding - 2,
      bounds.y + bounds.height - padding - 2,
      8,
      8
    );
    this.handle.endFill();
    
    // Hide by default
    this.frame.visible = false;
    this.handle.visible = false;
    
    console.log('Frame redrawn, bounds:', bounds, 'handle at:', bounds.x + bounds.width - padding - 2, bounds.y + bounds.height - padding - 2);
  }
}

class DraggableResizable extends PIXI.Container {
  sprite: PIXI.Sprite;
  frame: PIXI.Graphics;
  handle: PIXI.Graphics;
  id: string;

  // drag state
  dragging = false;
  dragPointerId: number | null = null;
  dragOffset = new PIXI.Point();

  // resize state
  resizing = false;
  resizePointerId: number | null = null;
  private startProj = 0;  // starting distance from center to pointer
  private startScale = 1;

  // Bound event handlers for stage-level events (so we can add/remove them)
  private boundOnResizeMove: (e: PIXI.FederatedPointerEvent) => void;
  private boundOnResizeEnd: (e: PIXI.FederatedPointerEvent) => void;

  constructor(texture: PIXI.Texture, id: string) {
    super();

    this.id = id;

    // Bind resize handlers so they can be added/removed from stage
    this.boundOnResizeMove = this.onResizeMove.bind(this);
    this.boundOnResizeEnd = this.onResizeEnd.bind(this);

    // Image sprite
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5); // scale from center (feels nicer)
    this.addChild(this.sprite);

    // Selection frame
    this.frame = new PIXI.Graphics();
    this.addChild(this.frame);

    // Corner handle (bottom-right)
    this.handle = new PIXI.Graphics();
    this.addChild(this.handle);

    // Initial scale down if huge
    const maxDim = 200;
    const { width: iw, height: ih } = this.sprite.texture;
    const s = Math.min(1, maxDim / Math.max(iw, ih));
    this.sprite.scale.set(s);
    this.startScale = s;
    this._redrawFrame();

    // Make sprite draggable
    this.sprite.eventMode = 'static';
    this.sprite.cursor = 'grab';
    this.sprite.on('pointerdown', this.onDragStart, this);
    this.sprite.on('pointerup', this.onDragEnd, this);
    this.sprite.on('pointerupoutside', this.onDragEnd, this);
    this.sprite.on('pointermove', this.onDragMove, this);

    // Make handle resizable - only pointerdown on handle, global events attached to stage
    this.handle.eventMode = 'static';
    this.handle.cursor = 'nwse-resize';
    this.handle.on('pointerdown', this.onResizeStart, this);
  }

  // ---- Dragging
  onDragStart(e: PIXI.FederatedPointerEvent): void {
    this.dragging = true;
    this.dragPointerId = e.pointerId;
    this.sprite.cursor = 'grabbing';

    // store offset between pointer and container position
    const gp = e.global;
    this.dragOffset.set(gp.x - this.x, gp.y - this.y);
  }

  onDragMove(e: PIXI.FederatedPointerEvent): void {
    if (!this.dragging || e.pointerId !== this.dragPointerId) return;
    const gp = e.global;
    this.position.set(gp.x - this.dragOffset.x, gp.y - this.dragOffset.y);
  }

  onDragEnd(e: PIXI.FederatedPointerEvent): void {
    if (e.pointerId !== this.dragPointerId) return;
    this.dragging = false;
    this.dragPointerId = null;
    this.sprite.cursor = 'grab';
    // Notify listeners that position changed
    this.emit('moved', { x: this.x, y: this.y });
  }

  // ---- Resizing (preserve aspect ratio)
  onResizeStart(e: PIXI.FederatedPointerEvent): void {
    e.stopPropagation(); // don't start dragging the sprite underneath
    this.resizing = true;
    this.resizePointerId = e.pointerId;

    if (!this.parent) return;

    // Store the starting global pointer position directly
    // Using global coordinates avoids issues with parent transformations
    const globalPoint = e.global.clone();

    // Get this container's global position
    const thisGlobal = this.parent.toGlobal(new PIXI.Point(this.x, this.y));

    // Calculate starting distance in global/screen space
    this.startProj = Math.hypot(
      globalPoint.x - thisGlobal.x,
      globalPoint.y - thisGlobal.y
    );

    // Snapshot current scale
    this.startScale = this.sprite.scale.x;

    // Visual feedback during resize
    this.handle.alpha = 0.7;

    // Attach global event listeners to the interactive root container
    const root = this.getInteractiveRoot();
    if (root) {
      root.on('pointermove', this.boundOnResizeMove);
      root.on('pointerup', this.boundOnResizeEnd);
      root.on('pointerupoutside', this.boundOnResizeEnd);
    }

    console.log('Resize start:', { startProj: this.startProj, startScale: this.startScale, root });
  }

  // Helper to get the root interactive container (the one with eventMode set)
  private getInteractiveRoot(): PIXI.Container | null {
    // Walk up to find the main container (parent of all images)
    // This is the container that has eventMode = 'static'
    let current: PIXI.Container | null = this.parent;
    while (current && current.parent && current.parent.parent) {
      current = current.parent;
    }
    return current;
  }

  onResizeMove(e: PIXI.FederatedPointerEvent): void {
    if (!this.resizing || e.pointerId !== this.resizePointerId || !this.parent) return;

    // Use global pointer regardless of handle hover
    const globalPoint = e.global;
    const thisGlobal = this.parent.toGlobal(new PIXI.Point(this.x, this.y));
    const currentProj = Math.hypot(globalPoint.x - thisGlobal.x, globalPoint.y - thisGlobal.y);

    // Calculate scale factor based on distance ratio
    const factor = currentProj / this.startProj;
    const newScale = this.startScale * factor;

    // Use shared scale constraints
    const { min, max } = this.getScaleConstraints();
    const finalScale = Math.min(max, Math.max(min, newScale));

    console.log('Resize move:', { currentProj, factor, newScale, finalScale });

    // Apply scale directly - smooth and responsive
    this.sprite.scale.set(finalScale);
    this._redrawFrame();
    // Don't emit during move - only on resize end to avoid excessive state updates
  }

  onResizeEnd(e: PIXI.FederatedPointerEvent): void {
    if (e.pointerId !== this.resizePointerId) return;

    // Remove global event listeners from the interactive root container
    const root = this.getInteractiveRoot();
    if (root) {
      root.off('pointermove', this.boundOnResizeMove);
      root.off('pointerup', this.boundOnResizeEnd);
      root.off('pointerupoutside', this.boundOnResizeEnd);
    }

    this.resizing = false;
    this.resizePointerId = null;

    // Restore visual feedback
    this.handle.alpha = 1.0;
    // Final notification for scale change
    this.emit('resized', this.sprite.scale.x);

    console.log('Resize end');
  }

  // ---- Draw selection frame + handle based on current sprite bounds
  _redrawFrame(): void {
    const w = this.sprite.texture.width  * this.sprite.scale.x;
    const h = this.sprite.texture.height * this.sprite.scale.y;

    this.frame.clear();
    this.frame.rect(-w/2, -h/2, w, h).stroke({ width: 2, color: 0x007bff, alpha: 0.8 });

    // handle: 16x16 square at bottom-right corner for better visibility
    const hs = 16;
    this.handle.clear();
    this.handle.rect(w/2 - hs, h/2 - hs, hs, hs).fill({ color: 0x007bff, alpha: 0.9 }).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });

    // Add diagonal lines to indicate resize
    this.handle.moveTo(w/2 - hs + 4, h/2 - hs + 4);
    this.handle.lineTo(w/2 - 4, h/2 - 4);
    this.handle.moveTo(w/2 - hs + 4, h/2 - 4);
    this.handle.lineTo(w/2 - 4, h/2 - hs + 4);
    this.handle.stroke({ width: 1, color: 0xffffff, alpha: 0.9 });

    // Set a larger invisible hit area to make the handle easier to grab
    this.handle.hitArea = new PIXI.Rectangle(w/2 - 24, h/2 - 24, 48, 48);
  }

  // ---- Selection control
  showSelection(): void {
    this.frame.visible = true;
    this.handle.visible = true;
  }

  hideSelection(): void {
    this.frame.visible = false;
    this.handle.visible = false;
  }

  // ---- Get current scale for state management
  getScale(): number {
    return this.sprite.scale.x; // return actual sprite scale
  }

  // ---- Set scale for state management
  setScale(scale: number): void {
    this.sprite.scale.set(scale);
    this._redrawFrame();
  }

  // ---- Get scale constraints (used by both resize handle and wheel handler)
  getScaleConstraints(): { min: number; max: number } {
    const minPx = 20;
    const minTexDim = Math.min(this.sprite.texture.width, this.sprite.texture.height);
    const minScale = Math.max(0.05, minPx / minTexDim);
    const maxScale = 8;
    return { min: minScale, max: maxScale };
  }
}

interface DraggableImage {
  id: string;
  node: DraggableResizable;
  x: number;
  y: number;
  scale: number;
  imageUrl: string;
}

interface DraggableText {
  id: string;
  node: DraggableResizableText;
  x: number;
  y: number;
  text: string;
  color: string;
  fontFamily: string;
}

interface StoredImageData {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
}

interface StoredTextData {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontFamily: string;
  scale: number;
}

interface CanvasData {
  images: StoredImageData[];
  texts: StoredTextData[];
  canvasPosition: {
    x: number;
    y: number;
  };
}

interface InfiniteCanvasProps {
  currentTool: Tool;
  editorState: EditorState;
}

export default function InfiniteCanvas({ currentTool, editorState }: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);
  const [images, setImages] = useState<DraggableImage[]>([]);
  const [texts, setTexts] = useState<DraggableText[]>([]);
  const [selectedImage, setSelectedImage] = useState<DraggableImage | null>(null);
  const [selectedText, setSelectedText] = useState<DraggableText | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingPosition, setTypingPosition] = useState({ x: 0, y: 0 });
  const [currentText, setCurrentText] = useState('');
  const selectedImageRef = useRef<DraggableImage | null>(null);
  const selectedTextRef = useRef<DraggableText | null>(null);
  const saveDebounceRef = useRef<number | null>(null);
  const [showGeminiPrompt, setShowGeminiPrompt] = useState(false);
  const saveToAPIRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const debouncedAutoSaveRef = useRef<() => void>(() => {});
  const handleImageDoubleClickRef = useRef<(imageId: string) => void>(() => {});
  const handleDeleteImageRef = useRef<(imageId: string) => void>(() => {});
  const handleDeleteTextRef = useRef<(textId: string) => void>(() => {});
  const createTextElementRef = useRef<(text: string, x: number, y: number) => void>(() => {});


  const debouncedAutoSave = useCallback(() => {
    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
    }
    // Debounce saves to avoid excessive POSTs while interacting
    saveDebounceRef.current = window.setTimeout(() => {
      console.log('Auto-save triggered, images:', images.length, 'texts:', texts.length);
      if (images.length > 0 || texts.length > 0) {
        saveToAPIRef.current?.();
      }
    }, 2000);
  }, [images.length, texts.length]);

  // Store currentTool and editorState in refs to avoid recreating the entire canvas
  const currentToolRef = useRef<Tool>(currentTool);
  const editorStateRef = useRef<EditorState>(editorState);

  // Update refs when props change
  useEffect(() => {
    console.log('Current tool changed to:', currentTool);
    currentToolRef.current = currentTool;
  }, [currentTool]);

  useEffect(() => {
    editorStateRef.current = editorState;
  }, [editorState]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize PixiJS application
    const app = new PIXI.Application();
    
    const initApp = async () => {
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0xf0f0f0,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });

      canvasRef.current?.appendChild(app.canvas);

      // Create main container for infinite scrolling
      const container = new PIXI.Container();
      app.stage.addChild(container);
      containerRef.current = container;

      // Enable interaction
      container.eventMode = 'static';

      container.on('pointerdown', (event) => {
        console.log('Canvas clicked, current tool:', currentToolRef.current);
        if (currentToolRef.current === 'text') {
          console.log('Text tool active, starting typing at click position');
          const localPoint = container.toLocal(event.global);
          setTypingPosition({ x: localPoint.x, y: localPoint.y });
          setCurrentText('');
          setIsTyping(true);
        } else {
            // Only start panning if not clicking on a sprite or handle
            if (event.target === container) {
              const pointer = event.global;
              lastPointerPosition = { x: pointer.x, y: pointer.y };
              isPanning = true;

              // Deselect image when clicking on empty space
              if (selectedImageRef.current?.node) {
                selectedImageRef.current.node.hideSelection();
              }
              setSelectedImage(null);
              
              // Deselect text when clicking on empty space
              setSelectedText(null);

              // If currently typing, finish typing and create text element
              if (isTyping && currentText.trim()) {
                createTextElementRef.current?.(currentText.trim(), typingPosition.x, typingPosition.y);
                setIsTyping(false);
                setCurrentText('');
              }
            }
        }
      });

      // Handle canvas dragging for panning
      let isPanning = false;
      let lastPointerPosition = { x: 0, y: 0 };

      container.on('pointermove', (event) => {
        if (isPanning) {
          const pointer = event.global;
          const deltaX = pointer.x - lastPointerPosition.x;
          const deltaY = pointer.y - lastPointerPosition.y;
          
          container.x += deltaX;
          container.y += deltaY;
          
          lastPointerPosition = { x: pointer.x, y: pointer.y };
          
          // Auto-save canvas position changes (debounced)
          debouncedAutoSaveRef.current?.();
        }
      });

      container.on('pointerup', () => {
        isPanning = false;
      });

      container.on('pointerupoutside', () => {
        isPanning = false;
      });

      // Handle drag and drop for images
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        canvasRef.current?.classList.add('drag-over');
      };

      const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        canvasRef.current?.classList.remove('drag-over');
      };

      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        canvasRef.current?.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer?.files || []);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        imageFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const imageUrl = event.target?.result as string;
            if (imageUrl && containerRef.current) {
              // Convert screen coordinates to container's local coordinate space
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                // Get pointer position relative to canvas
                const canvasX = e.clientX - rect.left;
                const canvasY = e.clientY - rect.top;

                // Create point in global/canvas space
                const globalPoint = new PIXI.Point(canvasX, canvasY);

                // Convert to container's local coordinate space
                // This properly accounts for container position, scale, and rotation
                const localPoint = containerRef.current.toLocal(globalPoint);

                await addImageAtPosition(imageUrl, localPoint.x, localPoint.y);
              }
            }
          };
          reader.onerror = (error) => {
            console.error('Error reading file:', error);
          };
          reader.readAsDataURL(file);
        });
      };

      // Add drag and drop event listeners to the canvas container
      const canvasElement = canvasRef.current;
      if (canvasElement) {
        canvasElement.addEventListener('dragover', handleDragOver);
        canvasElement.addEventListener('dragleave', handleDragLeave);
        canvasElement.addEventListener('drop', handleDrop);
      }

      // Add wheel event for scaling
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const selected = selectedImageRef.current;
        if (!selected?.node) return;

        // Use exponential mapping for consistent feel across devices
        const base = 1.0015;
        let factor = Math.pow(base, -e.deltaY);
        // If pinch-zoom gesture (ctrlKey), make it stronger
        if (e.ctrlKey) factor = Math.pow(base, -e.deltaY * 2);

        const current = selected.node.getScale();

        // Use the same scale constraints as resize handle
        const { min, max } = selected.node.getScaleConstraints();
        const clamped = Math.max(min, Math.min(max, current * factor));

        selected.node.setScale(clamped);

        setImages(prev => prev.map(img => img.id === selected.id ? { ...img, scale: clamped } : img));
        setSelectedImage(si => si && si.id === selected.id ? { ...si, scale: clamped } : si);
        debouncedAutoSaveRef.current?.();
      };
      
      if (canvasElement) {
        canvasElement.addEventListener('wheel', handleWheel, { passive: false });
      }

      // Handle window resize
      const handleResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', handleResize);

      appRef.current = app;

      return () => {
        window.removeEventListener('resize', handleResize);
        if (canvasElement) {
          canvasElement.removeEventListener('dragover', handleDragOver);
          canvasElement.removeEventListener('dragleave', handleDragLeave);
          canvasElement.removeEventListener('drop', handleDrop);
          canvasElement.removeEventListener('wheel', handleWheel);
        }
        app.destroy(true);
      };
    };

    initApp();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only initialize once

  const addTextAtPosition = (text: string, x: number, y: number, editorState: EditorState) => {
    if (!appRef.current || !containerRef.current) return;

    const pixiText = new PIXI.Text({
        text,
        style: {
            fontFamily: editorState.fontFamily,
            fill: editorState.color,
            fontSize: 24
        }
    });

    pixiText.x = x;
    pixiText.y = y;
    pixiText.anchor.set(0.5);

    containerRef.current.addChild(pixiText);
  }

  const createSpriteFromTexture = useCallback((texture: PIXI.Texture, x: number, y: number, imageUrl: string) => {
    try {
      console.log('Creating sprite from texture:', { 
        imageUrl: imageUrl.substring(0, 100) + '...', 
        x, 
        y, 
        textureValid: !!texture 
      });
      
      const id = Date.now().toString();
      const node = new DraggableResizable(texture, id);

      // Position the node at pixel-perfect coordinates for crisp rendering
      node.x = Math.round(x);
      node.y = Math.round(y);
      
      // Hide selection by default
      node.hideSelection();
      
      // Add click handler for selection and double-click for Gemini prompt
      let clickTimeout: number | null = null;
      node.sprite.on('pointerdown', (event) => {
        event.stopPropagation(); // Prevent container click event
        
        // Clear any existing timeout
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
          // This is a double-click
          handleImageDoubleClickRef.current?.(id);
          return;
        }
        
        // Set timeout for single click
        clickTimeout = window.setTimeout(() => {
          // Hide selection for previously selected image
          if (selectedImage?.node && selectedImage.id !== id) {
            selectedImage.node.hideSelection();
          }
          
          // Show selection for newly selected image
          node.showSelection();
          setSelectedImage({
            id,
            node,
            x: node.x,
            y: node.y,
            scale: node.getScale(),
            imageUrl
          });
          clickTimeout = null;
        }, 300);
      });

      if (containerRef.current) {
        containerRef.current.addChild(node);
      }

      const newImage: DraggableImage = {
        id,
        node,
        x: node.x,
        y: node.y,
        scale: node.getScale(),
        imageUrl
      };

      console.log('Created new image:', { 
        id, 
        imageUrl: imageUrl.substring(0, 100) + '...', 
        x: node.x, 
        y: node.y 
      });

      setImages(prev => {
        const updated = [...prev, newImage];
        console.log('Updated images array:', updated.length, 'images');
        return updated;
      });

      // Listen for node resize and move events to persist state
      // Use once: false to ensure these handlers stay attached
      node.on('resized', (scale: number) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, scale } : img));
        setSelectedImage(si => si && si.id === id ? { ...si, scale } as DraggableImage : si);
        debouncedAutoSaveRef.current?.();
      });
      node.on('moved', ({ x, y }: { x: number; y: number }) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, x, y } : img));
        setSelectedImage(si => si && si.id === id ? { ...si, x, y } as DraggableImage : si);
        debouncedAutoSaveRef.current?.();
      });
      
    } catch (error) {
      console.error('Error creating sprite:', error);
    }
  }, [selectedImage]);

  const addImageAtPosition = useCallback(async (imageUrl: string, x: number, y: number) => {
    if (!appRef.current || !containerRef.current) {
      console.error('App or container not initialized');
      return;
    }

    console.log('Adding image at position:', { imageUrl: imageUrl.substring(0, 100) + '...', x, y });

    try {
      // Use Assets.load for better texture loading
      const texture = await Assets.load(imageUrl);

      // Enable mipmapping for smooth scaling at all zoom levels
      texture.source.autoGenerateMipmaps = true;
      texture.source.scaleMode = 'linear';

      createSpriteFromTexture(texture, x, y, imageUrl);
    } catch (error) {
      console.error('Error loading texture:', error);
      // Fallback to direct texture creation
      try {
        const texture = PIXI.Texture.from(imageUrl);
        if (texture && texture.source) {
          // Check if texture is ready
          if (texture.source.width > 0 && texture.source.height > 0) {
            createSpriteFromTexture(texture, x, y, imageUrl);
          } else {
            // Wait for texture to load
            const checkLoaded = () => {
              if (texture.source && texture.source.width > 0 && texture.source.height > 0) {
                createSpriteFromTexture(texture, x, y, imageUrl);
              } else {
                setTimeout(checkLoaded, 100);
              }
            };
            checkLoaded();
          }
        } else {
          console.error('Failed to create texture');
        }
      } catch (fallbackError) {
        console.error('Fallback texture creation failed:', fallbackError);
      }
    }
  }, [createSpriteFromTexture]);





  const saveToAPI = useCallback(async () => {
    if (!containerRef.current) return;

    console.log('All images before saving:', images);
    console.log('All texts before saving:', texts);
    
    const canvasData: CanvasData = {
      images: images.map(img => {
        console.log('Saving image:', img.id, 'URL:', img.imageUrl, 'Type:', typeof img.imageUrl);
        
        // Validate image URL before saving
        if (!img.imageUrl || typeof img.imageUrl !== 'string') {
          console.warn('Skipping image with invalid URL:', img.id, img.imageUrl);
          return null;
        }
        
        return {
          id: img.id,
          imageUrl: img.imageUrl,
          x: img.node?.x || 0,
          y: img.node?.y || 0,
          scale: img.node?.getScale() || 1
        };
      }).filter((img): img is StoredImageData => img !== null), // Remove null entries
      texts: texts.map(text => {
        console.log('Saving text:', text.id, 'content:', text.text, 'font:', text.fontFamily);
        return {
          id: text.id,
          text: text.text,
          x: text.node?.x || 0,
          y: text.node?.y || 0,
          color: text.color,
          fontFamily: text.fontFamily,
          scale: text.node?.getScale() || 1
        };
      }),
      canvasPosition: {
        x: containerRef.current.x,
        y: containerRef.current.y
      }
    };
    
    console.log('Filtered images:', canvasData.images);

    console.log('Saving canvas data:', canvasData);
    
    try {
      const response = await fetch('/api/canvas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(canvasData),
      });

      if (!response.ok) {
        throw new Error('Failed to save canvas data');
      }

      console.log('Canvas data saved successfully');
    } catch (error) {
      console.error('Error saving canvas data:', error);
    }
  }, [images, texts, containerRef]);

  const loadCanvasData = async (canvasData: CanvasData) => {
    // Clear existing images
    images.forEach(img => {
      if (img.node) {
        img.node.destroy();
      }
    });
    setImages([]);
    setSelectedImage(null);

    // Clear existing texts
    texts.forEach(text => {
      if (text.node) {
        text.node.destroy();
      }
    });
    setTexts([]);
    setSelectedText(null);

    // Restore canvas position
    if (containerRef.current && canvasData.canvasPosition) {
      containerRef.current.x = canvasData.canvasPosition.x;
      containerRef.current.y = canvasData.canvasPosition.y;
    }

    // Load images
    const loadedImages: DraggableImage[] = [];
    for (const storedImage of canvasData.images) {
      try {
        if (!storedImage.imageUrl) {
          console.warn('Skipping image with no URL:', storedImage.id);
          continue;
        }

        // Validate image URL
        if (!storedImage.imageUrl || typeof storedImage.imageUrl !== 'string') {
          console.warn('Invalid image URL for image:', storedImage.id, storedImage.imageUrl);
          continue;
        }

        // Create texture and wait for it to load
        console.log('Creating texture for:', storedImage.imageUrl);
        const texture = PIXI.Texture.from(storedImage.imageUrl);
        console.log('Texture created:', texture);

        // Check if texture creation failed
        if (!texture) {
          console.warn('Failed to create texture for:', storedImage.imageUrl);
          continue;
        }

        // Wait for texture to load if it's not ready
        if (!texture.source || texture.source.width === 0 || texture.source.height === 0) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Texture loading timeout'));
            }, 5000);

            const checkLoaded = () => {
              if (texture.source && texture.source.width > 0 && texture.source.height > 0) {
                clearTimeout(timeout);
                resolve(true);
              } else {
                setTimeout(checkLoaded, 100);
              }
            };
            checkLoaded();
          });
        }

        // Enable mipmapping for smooth scaling at all zoom levels
        if (texture && texture.source) {
          texture.source.autoGenerateMipmaps = true;
          texture.source.scaleMode = 'linear';
        }

        // Create the draggable resizable node
        const node = new DraggableResizable(texture, storedImage.id);

        // Position the node at pixel-perfect coordinates for crisp rendering
        node.x = Math.round(storedImage.x);
        node.y = Math.round(storedImage.y);
        node.setScale(storedImage.scale);
        
        // Hide selection by default
        node.hideSelection();
        
        // Add click handler for selection
        node.sprite.on('pointerdown', (event) => {
          event.stopPropagation();
          
          // Hide selection for previously selected image
          if (selectedImage?.node && selectedImage.id !== storedImage.id) {
            selectedImage.node.hideSelection();
          }
          
          // Show selection for newly selected image
          node.showSelection();
          setSelectedImage({
            id: storedImage.id,
            node,
            x: node.x,
            y: node.y,
            scale: node.getScale(),
            imageUrl: storedImage.imageUrl
          });
        });
        
        if (containerRef.current) {
          containerRef.current.addChild(node);
        }
        
        const newImage: DraggableImage = {
          id: storedImage.id,
          node,
          x: node.x,
          y: node.y,
          scale: node.getScale(),
          imageUrl: storedImage.imageUrl
        };
        
        loadedImages.push(newImage);
      } catch (error) {
        console.error('Error loading image:', storedImage.id, error);
      }
    }
    
    setImages(loadedImages);

    // Load texts
    const loadedTexts: DraggableText[] = [];
    for (const storedText of canvasData.texts || []) {
      try {
        if (!storedText.text) {
          console.warn('Skipping text with no content:', storedText.id);
          continue;
        }

        // Load Google Font if needed
        let fontFamily = storedText.fontFamily || editorState.fontFamily;
        if (fontFamily !== 'Roboto' && fontFamily !== 'Arial' && fontFamily !== 'Helvetica') {
          try {
            // Load Google Font
            const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400&display=swap`;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = fontUrl;
            document.head.appendChild(link);
          } catch (error) {
            console.warn('Failed to load Google Font:', fontFamily, error);
            fontFamily = 'Arial'; // Fallback
          }
        }

        // Create DraggableResizableText
        const textNode = new DraggableResizableText(
          storedText.text, 
          storedText.id, 
          fontFamily, 
          storedText.color || editorState.color
        );
        textNode.x = storedText.x;
        textNode.y = storedText.y;
        if (storedText.scale) {
          textNode.setScale(storedText.scale);
        }

        // Add click handler for selection after text is created
        const addClickHandler = () => {
          if (textNode.text) {
            textNode.text.on('pointerdown', (event) => {
              event.stopPropagation();
              
              // Clear previous selections
              if (selectedImage) {
                selectedImage.node.hideSelection();
                setSelectedImage(null);
              }
              if (selectedText) {
                selectedText.node.hideSelection();
                setSelectedText(null);
              }

              // Show selection for this text
              textNode.showSelection();

              // Select this text
              setSelectedText({
                id: storedText.id,
                node: textNode,
                x: textNode.x,
                y: textNode.y,
                text: storedText.text,
                color: storedText.color,
                fontFamily: storedText.fontFamily
              });
            });
            
            // Add event listeners for state management
            textNode.on('moved', ({ x, y }: { x: number; y: number }) => {
              console.log('Loaded text moved:', storedText.id, 'to', x, y);
              setTexts(prev => prev.map(t => t.id === storedText.id ? { ...t, x, y } : t));
              setSelectedText(st => st && st.id === storedText.id ? { ...st, x, y } : st);
              debouncedAutoSaveRef.current?.();
            });
            
            textNode.on('scaled', ({ scale }: { scale: number }) => {
              console.log('Loaded text scaled:', storedText.id, 'to', scale);
              setTexts(prev => prev.map(t => t.id === storedText.id ? { ...t, scale } : t));
              setSelectedText(st => st && st.id === storedText.id ? { ...st, scale } : st);
              debouncedAutoSaveRef.current?.();
            });
          } else {
            // Retry after a short delay if text isn't ready yet
            setTimeout(addClickHandler, 100);
          }
        };
        
        // Start trying to add the click handler
        addClickHandler();

        // Add to container
        if (containerRef.current) {
          containerRef.current.addChild(textNode);
        }

        // Add to state
        const newText: DraggableText = {
          id: storedText.id,
          node: textNode,
          x: textNode.x,
          y: textNode.y,
          text: storedText.text,
          color: storedText.color,
          fontFamily: storedText.fontFamily
        };

        loadedTexts.push(newText);
      } catch (error) {
        console.error('Error loading text:', storedText.id, error);
      }
    }
    
    setTexts(loadedTexts);
  };

  const importFromJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        await loadCanvasData(jsonData);
      } catch (error) {
        console.error('Error parsing JSON file:', error);
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const loadFromAPI = useCallback(async () => {
    try {
      const response = await fetch('/api/canvas');
      if (!response.ok) {
        throw new Error('Failed to load canvas data');
      }

      const canvasData: CanvasData = await response.json();
      console.log('Loaded canvas data:', canvasData);
      
      if (!canvasData.images || !Array.isArray(canvasData.images)) {
        throw new Error('Invalid canvas data format');
      }

      // Clear existing images
      images.forEach(img => {
        if (img.node) {
          img.node.destroy();
        }
      });
      setImages([]);
      setSelectedImage(null);

      // Restore canvas position
      if (containerRef.current && canvasData.canvasPosition) {
        containerRef.current.x = canvasData.canvasPosition.x;
        containerRef.current.y = canvasData.canvasPosition.y;
      }

      // Load images
      const loadedImages: DraggableImage[] = [];
      for (const storedImage of canvasData.images) {
        try {
          if (!storedImage.imageUrl || typeof storedImage.imageUrl !== 'string') {
            console.warn('Skipping image with invalid URL:', storedImage.id, storedImage.imageUrl);
            continue;
          }

          // Load via Assets to ensure the texture is fully ready in Pixi v8
          let texture: PIXI.Texture | null = null;
          try {
            texture = await Assets.load(storedImage.imageUrl);

            // Enable mipmapping for smooth scaling at all zoom levels
            if (texture && texture.source) {
              texture.source.autoGenerateMipmaps = true;
              texture.source.scaleMode = 'linear';
            }
          } catch (e) {
            console.error('Failed to load texture via Assets:', e);
          }

          if (!texture) {
            console.warn('Failed to obtain texture for:', storedImage.imageUrl);
            continue;
          }
          // Assets.load resolves when the texture is usable; no extra waiting needed

          // Create the draggable resizable node
          const node = new DraggableResizable(texture, storedImage.id);

          // Position the node at pixel-perfect coordinates for crisp rendering
          if (node) {
            node.x = Math.round(storedImage.x);
            node.y = Math.round(storedImage.y);
            node.setScale(storedImage.scale);
          }
          
          // Hide selection by default
          if (node) {
            node.hideSelection();
            
            // Add click handler for selection and double-click for Gemini prompt
            let clickTimeout: number | null = null;
            node.sprite.on('pointerdown', (event) => {
            event.stopPropagation(); // Prevent container click event
            
            // Clear any existing timeout
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              clickTimeout = null;
              // This is a double-click
              handleImageDoubleClickRef.current?.(storedImage.id);
              return;
            }
            
            // Set timeout for single click
            clickTimeout = window.setTimeout(() => {
              // Hide selection for previously selected image
              if (selectedImage?.node && selectedImage.id !== storedImage.id) {
                selectedImage.node.hideSelection();
              }
              
              // Show selection for newly selected image
              node.showSelection();
              setSelectedImage({
                id: storedImage.id,
                node,
                x: node.x,
                y: node.y,
                scale: node.getScale(),
                imageUrl: storedImage.imageUrl
              });
              clickTimeout = null;
            }, 300);
            });
          }
          
          if (containerRef.current && node) {
            containerRef.current.addChild(node);
          }
          
          if (node) {
            const newImage: DraggableImage = {
              id: storedImage.id,
              node,
              x: node.x,
              y: node.y,
              scale: node.getScale(),
              imageUrl: storedImage.imageUrl
            };
          
            loadedImages.push(newImage);

            // Listen for node resize and move events to persist state
            node.on('resized', (scale: number) => {
              setImages(prev => prev.map(img => img.id === storedImage.id ? { ...img, scale } : img));
              setSelectedImage(si => si && si.id === storedImage.id ? { ...si, scale } as DraggableImage : si);
              debouncedAutoSaveRef.current?.();
            });
            node.on('moved', ({ x, y }: { x: number; y: number }) => {
              setImages(prev => prev.map(img => img.id === storedImage.id ? { ...img, x, y } : img));
              setSelectedImage(si => si && si.id === storedImage.id ? { ...si, x, y } as DraggableImage : si);
              debouncedAutoSaveRef.current?.();
            });
          }
        } catch (error) {
          console.error('Error loading image:', storedImage.id, error);
        }
      }
      
      setImages(loadedImages);
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // Clean up invalid images
  const cleanupInvalidImages = useCallback(() => {
    const validImages = images.filter(img => 
      img.imageUrl && 
      typeof img.imageUrl === 'string' && 
      img.imageUrl.trim() !== ''
    );
    
    if (validImages.length !== images.length) {
      console.log(`Cleaned up ${images.length - validImages.length} invalid images`);
      setImages(validImages);
    }
  }, [images]);

  // Auto-save functionality - debounced to avoid excessive saves during interactions
  useEffect(() => {
    if (images.length > 0) {
      debouncedAutoSave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]); // Only depend on images.length, not the entire images array

  // Canvas position changes are already handled by debouncedAutoSave() in the pointermove handler

  // Load from API on component mount
  useEffect(() => {
    loadFromAPI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Clean up invalid images on mount
  useEffect(() => {
    cleanupInvalidImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle Gemini image generation
  const handleGeminiImageGenerated = async (imageUrl: string, x: number, y: number) => {
    if (!containerRef.current) return;
    
    // Convert screen coordinates to container's local coordinate space
    const globalPoint = new PIXI.Point(x, y);
    const localPoint = containerRef.current.toLocal(globalPoint);
    
    await addImageAtPosition(imageUrl, localPoint.x, localPoint.y);
  };

  // Handle Gemini image update
  const handleGeminiImageUpdated = (imageId: string, newImageUrl: string) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, imageUrl: newImageUrl } : img
    ));
    
    // Update the selected image if it's the one being updated
    if (selectedImage?.id === imageId) {
      setSelectedImage(prev => prev ? { ...prev, imageUrl: newImageUrl } : null);
    }
    
    // Update the PixiJS sprite texture
    const imageToUpdate = images.find(img => img.id === imageId);
    if (imageToUpdate?.node) {
      // Create new texture from the updated image URL
      try {
        const texture = PIXI.Texture.from(newImageUrl);
        imageToUpdate.node.sprite.texture = texture;
        imageToUpdate.node._redrawFrame();
      } catch (error) {
        console.error('Error updating texture:', error);
      }
    }
    
    debouncedAutoSave();
  };

  // Handle double-click on image to open Gemini prompt
  const handleImageDoubleClick = useCallback((imageId: string) => {
    const foundImage = images.find(img => img.id === imageId);
    setSelectedImage(foundImage || null);
    setShowGeminiPrompt(true);
  }, [images]);

  // Handle deleting an image
  const handleDeleteImage = useCallback((imageId: string) => {
    // Remove from PixiJS container
    const imageToDelete = images.find(img => img.id === imageId);
    if (imageToDelete?.node && containerRef.current) {
      containerRef.current.removeChild(imageToDelete.node);
      imageToDelete.node.destroy();
    }

    // Remove from images state
    setImages(prevImages => prevImages.filter(img => img.id !== imageId));

    // Clear selection if this image was selected
    if (selectedImage?.id === imageId) {
      setSelectedImage(null);
    }

    // Auto-save after deletion
    debouncedAutoSaveRef.current?.();
  }, [images, selectedImage]);

  // Handle deleting text
  const handleDeleteText = useCallback((textId: string) => {
    // Remove from PixiJS container
    const textToDelete = texts.find(text => text.id === textId);
    if (textToDelete?.node && containerRef.current) {
      containerRef.current.removeChild(textToDelete.node);
      textToDelete.node.destroy();
    }

    // Remove from texts state
    setTexts(prevTexts => prevTexts.filter(text => text.id !== textId));

    // Clear selection if this text was selected
    if (selectedText?.id === textId) {
      setSelectedText(null);
    }

    // Auto-save after deletion
    debouncedAutoSaveRef.current?.();
  }, [texts, selectedText]);

  // Create text element
  const createTextElement = useCallback(async (text: string, x: number, y: number) => {
    console.log('createTextElement called with:', { text, x, y });
    if (!containerRef.current) {
      console.log('No container ref, returning early');
      return;
    }

    const textId = Date.now().toString();
    console.log('Creating text with ID:', textId);
    
    // Load Google Font if needed
    let fontFamily = editorState.fontFamily;
    if (fontFamily !== 'Roboto' && fontFamily !== 'Arial' && fontFamily !== 'Helvetica' && fontFamily !== 'Times New Roman') {
      try {
        // Check if font is already loaded
        const existingLink = document.querySelector(`link[href*="${fontFamily.replace(/\s+/g, '+')}"]`);
        if (!existingLink) {
          // Load Google Font
          const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400&display=swap`;
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = fontUrl;
          document.head.appendChild(link);
          
          // Wait longer for font to load
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn('Failed to load Google Font:', fontFamily, error);
        fontFamily = 'Arial'; // Fallback
      }
    }
    
    // Create DraggableResizableText
    console.log('Creating text with font:', fontFamily, 'color:', editorState.color);
    const textNode = new DraggableResizableText(text, textId, fontFamily, editorState.color);
    textNode.x = x;
    textNode.y = y;

    // Add click handler for selection after text is created
    const addClickHandler = () => {
      if (textNode.text) {
        textNode.text.on('pointerdown', (event) => {
          event.stopPropagation();
          
          // Clear previous selections
          if (selectedImage) {
            selectedImage.node.hideSelection();
            setSelectedImage(null);
          }
          if (selectedText) {
            selectedText.node.hideSelection();
            setSelectedText(null);
          }

          // Show selection for this text
          textNode.showSelection();

          // Select this text
          setSelectedText({
            id: textId,
            node: textNode,
            x: textNode.x,
            y: textNode.y,
            text: text,
            color: editorState.color,
            fontFamily: editorState.fontFamily
          });
        });
        
        // Add event listeners for state management
        textNode.on('moved', ({ x, y }: { x: number; y: number }) => {
          console.log('Text moved:', textId, 'to', x, y);
          setTexts(prev => prev.map(t => t.id === textId ? { ...t, x, y } : t));
          setSelectedText(st => st && st.id === textId ? { ...st, x, y } : st);
          debouncedAutoSaveRef.current?.();
        });
        
        textNode.on('scaled', ({ scale }: { scale: number }) => {
          console.log('Text scaled:', textId, 'to', scale);
          setTexts(prev => prev.map(t => t.id === textId ? { ...t, scale } : t));
          setSelectedText(st => st && st.id === textId ? { ...st, scale } : st);
          debouncedAutoSaveRef.current?.();
        });
      } else {
        // Retry after a short delay if text isn't ready yet
        setTimeout(addClickHandler, 100);
      }
    };
    
    // Start trying to add the click handler
    addClickHandler();

    // Add to container
    containerRef.current.addChild(textNode);
    console.log('Text added to container at position:', textNode.x, textNode.y);

    // Add to state
    const newText: DraggableText = {
      id: textId,
      node: textNode,
      x: textNode.x,
      y: textNode.y,
      text: text,
      color: editorState.color,
      fontFamily: editorState.fontFamily
    };

    console.log('Adding text to state:', newText);
    setTexts(prevTexts => {
      const updated = [...prevTexts, newText];
      console.log('Updated texts state:', updated);
      console.log('Total texts now:', updated.length);
      return updated;
    });
    
    // Auto-save
    console.log('Calling auto-save after text creation');
    console.log('Current texts count:', texts.length + 1);
    debouncedAutoSaveRef.current?.();
  }, [editorState, selectedImage, selectedText]);

  // Keep refs in sync
  useEffect(() => {
    selectedImageRef.current = selectedImage;
    selectedTextRef.current = selectedText;
    saveToAPIRef.current = saveToAPI;
    debouncedAutoSaveRef.current = debouncedAutoSave;
    handleImageDoubleClickRef.current = handleImageDoubleClick;
    handleDeleteImageRef.current = handleDeleteImage;
    handleDeleteTextRef.current = handleDeleteText;
    createTextElementRef.current = createTextElement;
  }, [selectedImage, selectedText, saveToAPI, debouncedAutoSave, handleImageDoubleClick, handleDeleteImage, handleDeleteText, createTextElement]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key to close Gemini prompt
      if (event.key === 'Escape' && showGeminiPrompt) {
        setShowGeminiPrompt(false);
        return;
      }

      // Handle Delete/Backspace key to delete selected image or text
      if ((event.key === 'Delete' || event.key === 'Backspace') && !showGeminiPrompt) {
        if (selectedImage) {
          event.preventDefault();
          handleDeleteImageRef.current?.(selectedImage.id);
        } else if (selectedText) {
          event.preventDefault();
          handleDeleteTextRef.current?.(selectedText.id);
        }
      }

      // Handle T key to start typing
      if (event.key === 't' || event.key === 'T') {
        if (!showGeminiPrompt && !isTyping) {
          event.preventDefault();
          // Start typing at center of viewport
          const centerX = containerRef.current ? -containerRef.current.x + window.innerWidth / 2 : window.innerWidth / 2;
          const centerY = containerRef.current ? -containerRef.current.y + window.innerHeight / 2 : window.innerHeight / 2;
          setTypingPosition({ x: centerX, y: centerY });
          setCurrentText('');
          setIsTyping(true);
        }
      }

      // Handle typing when in typing mode
      if (isTyping) {
        if (event.key === 'Enter') {
          // Finish typing and create text element
          if (currentText.trim()) {
            createTextElementRef.current?.(currentText.trim(), typingPosition.x, typingPosition.y);
          }
          setIsTyping(false);
          setCurrentText('');
        } else if (event.key === 'Escape') {
          // Cancel typing
          setIsTyping(false);
          setCurrentText('');
        } else if (event.key === 'Backspace') {
          // Handle backspace
          setCurrentText(prev => prev.slice(0, -1));
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          // Add character to current text
          setCurrentText(prev => prev + event.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGeminiPrompt, selectedImage, selectedText, isTyping, currentText]);

  // Handle clicking outside to finish typing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isTyping && currentText.trim()) {
        // Check if click is on empty canvas space
        const target = event.target as HTMLElement;
        const canvasElement = target.closest('.canvas-container');
        
        // If clicking on the canvas container itself (empty space), finish typing
        if (canvasElement && canvasElement === target) {
          console.log('Clicking outside text preview, finishing typing');
          createTextElementRef.current?.(currentText.trim(), typingPosition.x, typingPosition.y);
          setIsTyping(false);
          setCurrentText('');
        }
      }
    };

    if (isTyping) {
      // Add a small delay to avoid immediate triggering
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isTyping, currentText, typingPosition]);

  return (
    <div className="w-full h-screen relative canvas-container">
      {/* Control buttons */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {/* Typing indicator */}
        {isTyping && (
          <div className="bg-blue-500 text-white px-3 py-1 rounded text-sm">
            Typing mode - Press Enter to finish
          </div>
        )}
        <button 
          onClick={() => setShowGeminiPrompt(true)}
          className="bg-purple-500 text-white px-3 py-1 rounded text-sm"
        >
          Generate Image
        </button>
        <button 
          onClick={saveToAPI}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          Save to API
        </button>
        <label className="bg-green-500 text-white px-3 py-1 rounded text-sm cursor-pointer">
          Load JSON
          <input
            type="file"
            accept=".json"
            onChange={importFromJSON}
            className="hidden"
          />
        </label>
      </div>
      
      {/* Canvas container */}
      <div 
        ref={canvasRef} 
        className="w-full h-full transition-all duration-200"
        style={{
          background: 'transparent'
        }}
      />
      
      {/* Gemini Image Prompt */}
      {showGeminiPrompt && (
        <GeminiImagePrompt
          selectedImageId={selectedImage?.id || null}
          selectedImageUrl={selectedImage?.imageUrl || null}
          onImageGenerated={handleGeminiImageGenerated}
          onImageUpdated={handleGeminiImageUpdated}
          onClose={() => setShowGeminiPrompt(false)}
        />
      )}

      {/* Live Text Preview */}
      {isTyping && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${typingPosition.x + (containerRef.current?.x || 0)}px`,
            top: `${typingPosition.y + (containerRef.current?.y || 0)}px`,
            transform: 'translate(-50%, -50%)',
            fontFamily: `"${editorState.fontFamily}", Arial, sans-serif`,
            color: editorState.color,
            fontSize: '24px',
            fontWeight: 'normal',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '2px solid #007AFF',
            minWidth: '20px',
            minHeight: '24px',
            whiteSpace: 'nowrap'
          }}
        >
          {currentText || 'Type here...'}
          <div 
            className="inline-block w-0.5 h-6 bg-current animate-pulse ml-1"
            style={{ animationDuration: '1s' }}
          />
        </div>
      )}
    </div>
  );
}
