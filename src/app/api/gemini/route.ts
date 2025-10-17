import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: NextRequest) {
  try {
    const { prompt, styleImage, selectedImage, intent } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const contents: Array<{
      inlineData?: {
        mimeType: string;
        data: string;
      };
      text?: string;
    }> = [];

    // Add style reference image if provided
    if (styleImage) {
      let imageData: string;
      let mimeType: string;
      
      if (styleImage.startsWith('data:')) {
        // Handle base64 data URL
        const [header, data] = styleImage.split(',');
        imageData = data;
        mimeType = header.split(';')[0].split(':')[1] || 'image/png';
      } else {
        // Handle external URL - fetch and convert to base64
        try {
          const response = await fetch(styleImage);
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          imageData = base64;
          mimeType = response.headers.get('content-type') || 'image/png';
        } catch (error) {
          console.error('Error fetching style image:', error);
          return NextResponse.json(
            { error: 'Failed to fetch style image' },
            { status: 400 }
          );
        }
      }
      
      contents.push({
        inlineData: {
          mimeType,
          data: imageData
        }
      });
    }

    // Add selected image for editing/updating
    if (selectedImage) {
      let imageData: string;
      let mimeType: string;
      
      if (selectedImage.startsWith('data:')) {
        // Handle base64 data URL
        const [header, data] = selectedImage.split(',');
        imageData = data;
        mimeType = header.split(';')[0].split(':')[1] || 'image/png';
      } else {
        // Handle external URL - fetch and convert to base64
        try {
          const response = await fetch(selectedImage);
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          imageData = base64;
          mimeType = response.headers.get('content-type') || 'image/png';
        } catch (error) {
          console.error('Error fetching image:', error);
          return NextResponse.json(
            { error: 'Failed to fetch selected image' },
            { status: 400 }
          );
        }
      }
      
      contents.push({
        inlineData: {
          mimeType,
          data: imageData
        }
      });
    }

    // Construct the final prompt
    let finalPrompt = prompt;
    if (styleImage && selectedImage) {
      if (intent === 'update') {
        finalPrompt = `Use the first image as style reference and update the second image with: ${prompt}. Preserve the original composition and subjects from the second image while applying the style from the first image.`;
      } else {
        finalPrompt = `Use the first image as style reference and create variations of the second image with: ${prompt}. Match the style of the first image but create new content based on the second image.`;
      }
    } else if (styleImage) {
      finalPrompt = `Use this image as style reference and create: ${prompt}. Match the style of the reference image but create new content as described.`;
    } else if (selectedImage) {
      if (intent === 'update') {
        finalPrompt = `Update this image with: ${prompt}. Preserve the original composition and style while making the requested changes.`;
      } else {
        finalPrompt = `Create variations of this image with: ${prompt}. Use the image as inspiration but create new content as described.`;
      }
    }

    contents.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents
    });

    // Extract image from response
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        console.log(part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const imageUrl = `data:image/png;base64,${imageData}`;
        
        return NextResponse.json({
          success: true,
          imageUrl
        });
      }
    }

    return NextResponse.json(
      { error: 'No image generated' },
      { status: 500 }
    );

  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}
