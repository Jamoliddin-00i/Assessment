import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GradingResult {
  score: number;
  maxScore: number;
  feedback: string;
  breakdown: {
    criterion: string;
    points: number;
    maxPoints: number;
    comment: string;
  }[];
}

export async function gradeSubmission(
  extractedText: string,
  markScheme: string,
  totalMarks: number
): Promise<GradingResult> {
  // If no Gemini API key is set, use mock grading
  if (!process.env.GEMINI_API_KEY) {
    console.warn("No Gemini API key set, using mock grading");
    return mockGrading(extractedText, totalMarks);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are an experienced A Level Mathematics teacher grading a student's handwritten assessment.

MARK SCHEME:
${markScheme}

TOTAL MARKS AVAILABLE: ${totalMarks}

STUDENT'S ANSWER (extracted via OCR - may contain minor recognition errors):
${extractedText}

Please grade this submission according to the mark scheme. Be fair but thorough.

GRADING GUIDELINES:
1. The student may have written more than the OCR captured - be lenient with missing steps
2. Handwriting recognition may have introduced minor errors in symbols/numbers
3. Focus on mathematical understanding and method, not just final answers
4. For mathematics specifically:
   - Award METHOD marks (M) for correct approach even if arithmetic is wrong
   - Award ACCURACY marks (A) for correct calculations following correct method
   - Award marks for FOLLOW THROUGH if the method is correct but based on earlier error
   - Recognize equivalent forms of answers (e.g., 1/2 = 0.5 = 50%)
   - Accept mathematically equivalent expressions
   - Check the WORKING shown, not just final answers
   - Partial credit for partially correct solutions

Provide your response in the following JSON format ONLY (no markdown, no code blocks, just pure JSON):
{
  "score": <total score awarded as a number>,
  "maxScore": ${totalMarks},
  "feedback": "<overall feedback for the student - be constructive, mention what was done well and areas for improvement>",
  "breakdown": [
    {
      "criterion": "<question number or topic being assessed>",
      "points": <points awarded as a number>,
      "maxPoints": <max points for this criterion as a number>,
      "comment": "<specific feedback - what was correct, what was wrong, how to improve>"
    }
  ]
}

IMPORTANT: Only respond with valid JSON, no additional text, no markdown formatting.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let content = response.text();

    if (!content) {
      throw new Error("No response from AI");
    }

    // Clean up the response - remove markdown code blocks if present
    content = content.trim();
    if (content.startsWith("```json")) {
      content = content.slice(7);
    } else if (content.startsWith("```")) {
      content = content.slice(3);
    }
    if (content.endsWith("```")) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    // Parse the JSON response
    const parsedResult = JSON.parse(content);

    return {
      score: Math.min(parsedResult.score, totalMarks),
      maxScore: totalMarks,
      feedback: parsedResult.feedback,
      breakdown: parsedResult.breakdown || [],
    };
  } catch (error) {
    console.error("Grading error:", error);

    // If parsing fails or API error, return a fallback
    if (error instanceof SyntaxError) {
      console.error("Failed to parse AI response as JSON");
      return mockGrading(extractedText, totalMarks);
    }

    throw new Error("Failed to grade submission with AI");
  }
}

function mockGrading(extractedText: string, totalMarks: number): GradingResult {
  // Simple mock grading based on text length and content
  const wordCount = extractedText.split(/\s+/).filter((w) => w.length > 0).length;
  const hasNumbers = /\d/.test(extractedText);
  const hasFormulas = /[=+\-*/^]/.test(extractedText);

  let scorePercentage = 0.5; // Base 50%

  if (wordCount > 50) scorePercentage += 0.15;
  if (wordCount > 100) scorePercentage += 0.1;
  if (hasNumbers) scorePercentage += 0.1;
  if (hasFormulas) scorePercentage += 0.1;

  // Add some randomness
  scorePercentage += (Math.random() - 0.5) * 0.1;

  // Clamp between 0.3 and 0.95
  scorePercentage = Math.max(0.3, Math.min(0.95, scorePercentage));

  const score = Math.round(totalMarks * scorePercentage);

  return {
    score,
    maxScore: totalMarks,
    feedback: `Your submission has been reviewed. You demonstrated understanding of the key concepts. ${
      score >= totalMarks * 0.7
        ? "Good work! Keep up the effort."
        : "Consider reviewing the material and practicing more problems."
    } (Note: This is mock grading - configure GEMINI_API_KEY for AI-powered grading)`,
    breakdown: [
      {
        criterion: "Content Understanding",
        points: Math.round(score * 0.4),
        maxPoints: Math.round(totalMarks * 0.4),
        comment: "Shows understanding of core concepts",
      },
      {
        criterion: "Accuracy",
        points: Math.round(score * 0.3),
        maxPoints: Math.round(totalMarks * 0.3),
        comment: "Calculations and answers are mostly correct",
      },
      {
        criterion: "Presentation",
        points: Math.round(score * 0.3),
        maxPoints: Math.round(totalMarks * 0.3),
        comment: "Work is reasonably organized",
      },
    ],
  };
}

export function formatFeedbackAsMarkdown(result: GradingResult): string {
  let markdown = `## Grading Results\n\n`;
  markdown += `**Score: ${result.score}/${result.maxScore}** (${Math.round(
    (result.score / result.maxScore) * 100
  )}%)\n\n`;
  markdown += `### Overall Feedback\n${result.feedback}\n\n`;

  if (result.breakdown.length > 0) {
    markdown += `### Detailed Breakdown\n\n`;
    for (const item of result.breakdown) {
      markdown += `#### ${item.criterion}\n`;
      markdown += `- **Points:** ${item.points}/${item.maxPoints}\n`;
      markdown += `- ${item.comment}\n\n`;
    }
  }

  return markdown;
}
