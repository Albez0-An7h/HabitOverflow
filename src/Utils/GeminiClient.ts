import { GoogleGenerativeAI } from '@google/generative-ai';

// Use environment variable for API key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Check if API key is available
if (!API_KEY) {
  console.error("Gemini API key is missing. Please set VITE_GEMINI_API_KEY in your .env file.");
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

interface VerificationResult {
  isVerified: boolean;
  confidence: number;
  explanation: string;
}

// Function to verify habit completion using image
export async function verifyHabitWithImage(
  habitName: string, 
  habitDescription: string | undefined, 
  imageBase64: string
): Promise<VerificationResult> {
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    // Prepare the prompt
    const prompt = `Verify if this image shows evidence of completing the habit: "${habitName}". 
    ${habitDescription ? `Additional context: ${habitDescription}` : ''}
    
    Focus ONLY on the core action being performed by the subject/person in the image.
    Verify the habit if the essential action is clearly visible, even if common props or environmental elements are missing.
    Accept common variations of how the habit might be performed (e.g., brushing teeth without a bucket, exercising without equipment).
    Do NOT reject the verification just because certain props or environmental elements are missing if the main action is visible.
    Be reasonably lenient - if there's evidence the core habit action was completed, verify it.
    
    Please respond with a JSON object only, following this exact format:
    {
      "isVerified": true/false,
      "confidence": [number between 0-1],
      "explanation": "brief explanation of verification decision"
    }`;

    // Parse the base64 image
    const imageData = imageBase64.split(',')[1]; 
    
    // Detect image type from base64 string
    let mimeType = "image/jpeg"; // Default
    if (imageBase64.startsWith('data:image/png;')) {
      mimeType = "image/png";
    } else if (imageBase64.startsWith('data:image/gif;')) {
      mimeType = "image/gif";
    } else if (imageBase64.startsWith('data:image/webp;')) {
      mimeType = "image/webp";
    }
    
    // Create parts with the image
    const imageParts = [
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType
        }
      },
      { text: prompt }
    ];

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: imageParts }],
    });
    
    const response = result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse verification result");
    }

    const jsonResult = JSON.parse(jsonMatch[0]) as VerificationResult;
    return jsonResult;

  } catch (error) {
    console.error("Error verifying habit with Gemini:", error);
    return {
      isVerified: false,
      confidence: 0,
      explanation: "Verification failed due to technical error"
    };
  }
}
