'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Assets } from 'pixi.js';
import { EditorState, Tool } from '@/app/page';
import GeminiImagePrompt from './GeminiImagePrompt';

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

interface StoredImageData {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
}

interface CanvasData {
  images: StoredImageData[];
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
  const [selectedImage, setSelectedImage] = useState<DraggableImage | null>(null);
  const selectedImageRef = useRef<DraggableImage | null>(null);
  const saveDebounceRef = useRef<number | null>(null);
  const [showGeminiPrompt, setShowGeminiPrompt] = useState(false);
  const saveToAPIRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const debouncedAutoSaveRef = useRef<() => void>(() => {});
  const handleImageDoubleClickRef = useRef<(imageId: string) => void>(() => {});
  const handleDeleteImageRef = useRef<(imageId: string) => void>(() => {});


  const debouncedAutoSave = useCallback(() => {
    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
    }
    // Debounce saves to avoid excessive POSTs while interacting
    saveDebounceRef.current = window.setTimeout(() => {
      if (images.length > 0) {
        saveToAPIRef.current?.();
      }
    }, 2000);
  }, [images.length]);

  // Store currentTool and editorState in refs to avoid recreating the entire canvas
  const currentToolRef = useRef<Tool>(currentTool);
  const editorStateRef = useRef<EditorState>(editorState);

  // Update refs when props change
  useEffect(() => {
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
        if (currentToolRef.current === 'text') {
          const localPoint = container.toLocal(event.global);
          addTextAtPosition("Hello World", localPoint.x, localPoint.y, editorStateRef.current);
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
  }, [images, containerRef]);

  const loadCanvasData = async (canvasData: CanvasData) => {
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

  // Keep refs in sync
  useEffect(() => {
    selectedImageRef.current = selectedImage;
    saveToAPIRef.current = saveToAPI;
    debouncedAutoSaveRef.current = debouncedAutoSave;
    handleImageDoubleClickRef.current = handleImageDoubleClick;
    handleDeleteImageRef.current = handleDeleteImage;
  }, [selectedImage, saveToAPI, debouncedAutoSave, handleImageDoubleClick, handleDeleteImage]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key to close Gemini prompt
      if (event.key === 'Escape' && showGeminiPrompt) {
        setShowGeminiPrompt(false);
        return;
      }

      // Handle Delete/Backspace key to delete selected image
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedImage && !showGeminiPrompt) {
        event.preventDefault();
        handleDeleteImageRef.current?.(selectedImage.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGeminiPrompt, selectedImage]);

  return (
    <div className="w-full h-screen relative">
      {/* Control buttons */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
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
    </div>
  );
}
