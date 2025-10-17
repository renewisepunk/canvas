# STANDARD SAMPLE CODE

import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";

async function main() {

  const ai = new GoogleGenAI({});

  const prompt =
    "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme";

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
  });
  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text);
    } else if (part.inlineData) {
      const imageData = part.inlineData.data;
      const buffer = Buffer.from(imageData, "base64");
      fs.writeFileSync("gemini-native-image.png", buffer);
      console.log("Image saved as gemini-native-image.png");
    }
  }
}

main();

# FURTHER RESEARCH INTO HOW TO USE IMAGES AS REFERENCE

Short answer: yes—Gemini 2.5 Flash Image supports using one (or several) images as style references. You attach the image(s) alongside your text prompt; there isn’t a special style_image parameter—the ordering and your phrasing tell the model which image to copy stylistically and which content to render.

How it works (TL;DR)
	•	Pass images in contents (base64 or file handle) together with your text.
	•	Say explicitly what each image is for: e.g., “Use the first image strictly as a style reference (palette, brushwork, line weight). Render the content I describe in that style.”
	•	You can include up to 3 input images (max ~7 MB each; PNG/JPEG/WebP). Aspect ratio often follows the last image unless you override it.  ￼
	•	Supported modes include multi-image style transfer and editing (add/remove elements, inpaint specific areas) — all via text instructions.  ￼

Minimal prompt patterns

Single style ref → new content

(1) [style_ref_image]
(2) “Create [describe scene/content]. Match the style of the first image: [call out traits—color palette, texture, linework, lighting]. Keep composition and subjects from my text, not the reference.”

Two refs (style + composition)

(1) [style_ref_image] (2) [layout_ref_image]
“Combine: use the first image only for style, and the second for composition/lighting. Now render [your content].”

Editing with consistent style

(1) [image_to_edit]
“Replace the background with [X] and preserve the original style/lighting.”

Google’s official guidance calls these “composition & style transfer” and shows examples of multi-image prompts for style transfer and explicit phrasing.  ￼

Gotchas & knobs that matter
	•	Be explicit about what to copy (“color palette, brush stroke density, grain, line weight, halftone dots, lens bloom”) and what not to copy (e.g., “do not copy subjects or layout from the style image”).  ￼
	•	Aspect ratio control: the model may adopt the last image’s ratio; either provide a dummy ref with your desired dimensions or set the aspect ratio in the request config.  ￼
	•	Limits: max 3 input images, output up to 10 images per prompt; inputs up to 7 MB each.  ￼
	•	Watermark: output images include invisible SynthID.  ￼

Micro examples (copy-paste logic; pseudo-JS)

await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: [
    // 1) Style reference image
    { inlineData: { mimeType: "image/png", data: STYLE_BASE64 } },
    // 2) Your instruction
    { text:
      "Generate a city skyline at dusk with neon reflections on wet streets. \
       Match the FIRST image's style: bold neon palette, thick inked outlines, paper texture. \
       Do NOT copy the reference layout or subjects." }
  ],
  // (optional) ask for only image outputs and set aspect ratio
  config: { responseModalities: ["Image"], imageConfig: { aspectRatio: "16:9" } }
});

This mirrors Google’s docs: images + text interleaved in contents, with explicit role-setting via prompt.  ￼

When to use Imagen instead

If you need stronger, repeatable brand style across large sets (or template-like customization), Google also offers Imagen style customization workflows (separate model family). Gemini’s method is prompt-only; Imagen can train a custom style profile.  ￼

Sources
	•	Official Gemini image generation guide (multi-image style transfer, editing, aspect-ratio tips).  ￼
	•	Google Developers Blog: “How to prompt Gemini 2.5 Flash Image” (style transfer & multi-image guidance).  ￼
	•	Vertex AI model page for gemini-2.5-flash-image (limits, inputs/outputs, regions).  ￼

If you want, I can draft a tiny SDK helper that takes {styleRef, contentPrompt, aspect} and builds the right contents[] payload for your app.