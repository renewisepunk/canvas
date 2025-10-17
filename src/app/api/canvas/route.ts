import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const CANVAS_DATA_PATH = join(process.cwd(), 'public', 'canvas-data.json');

export async function GET() {
  try {
    const data = await readFile(CANVAS_DATA_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    // Return empty canvas if file doesn't exist
    return NextResponse.json({
      images: [],
      canvasPosition: { x: 0, y: 0 }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const canvasData = await request.json();
    
    // Validate the data structure
    if (!canvasData.images || !Array.isArray(canvasData.images)) {
      return NextResponse.json(
        { error: 'Invalid canvas data format' },
        { status: 400 }
      );
    }

    // Write to file
    await writeFile(CANVAS_DATA_PATH, JSON.stringify(canvasData, null, 2));
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save canvas data' },
      { status: 500 }
    );
  }
}
