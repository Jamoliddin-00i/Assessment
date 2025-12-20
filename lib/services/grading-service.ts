/**
 * Grading Service - Text Comparison with Gemini 2.5 Flash
 *
 * Pipeline:
 * 1. Receives student's extracted handwritten text (from QVQ-Max OCR)
 * 2. Receives mark scheme's extracted text (OCR'd when assessment was created)
 * 3. Uses Gemini 2.5 Flash to compare and grade
 */

import { GoogleGenAI } from "@google/genai";

// Gemini 2.5 Flash for grading (high-speed, complex reasoning)
const GEMINI_GRADING_MODEL = "gemini-2.5-flash";

export interface QuestionBreakdown {
  questionId: string; // e.g., "1", "1a", "1a)i", "2b)ii"
  points: number;
  maxPoints: number;
  status: "correct" | "partial" | "incorrect" | "unanswered";
  feedback: string;
  deductions?: {
    reason: string;
    pointsLost: number;
  }[];
}

export interface GradingResult {
  score: number;
  maxScore: number;
  feedback: string;
  breakdown: QuestionBreakdown[];
}

// QVQ-Max model from Alibaba/Qwen - best for visual reasoning
const QVQ_MODEL = "qvq-max";

// DashScope API endpoint
const DASHSCOPE_API_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

// Get API key
function getApiKey(): string {
  const apiKey = process.env.QVQ_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("QVQ_API_KEY or DASHSCOPE_API_KEY is not configured");
  }
  return apiKey;
}

/**
 * Make a streaming request to QVQ-Max API and get the answer content
 */
async function callQvqApi(messages: Array<{role: string; content: unknown}>): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(DASHSCOPE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: QVQ_MODEL,
      messages: messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("QVQ API Error:", response.status, errorText);
    throw new Error(`QVQ API error: ${response.status} - ${errorText}`);
  }

  // Process SSE stream
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  const decoder = new TextDecoder();
  let answerContent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            // Collect the answer content (not reasoning_content)
            if (delta?.content) {
              answerContent += delta.content;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return answerContent.trim();
}

// Get MIME prefix for base64 data URL
function getMimePrefix(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("png")) return "data:image/png;base64,";
  if (type.includes("gif")) return "data:image/gif;base64,";
  if (type.includes("webp")) return "data:image/webp;base64,";
  if (type.includes("pdf")) return "data:application/pdf;base64,";
  return "data:image/jpeg;base64,";
}

// Get Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Attempt to recover grading data from truncated JSON response
 * Extracts score and feedback using regex if JSON parsing fails
 */
function attemptTruncationRecovery(
  responseText: string,
  totalMarks: number
): GradingResult | null {
  try {
    // Try to extract score
    const scoreMatch = responseText.match(/"score"\s*:\s*(\d+)/);
    if (!scoreMatch) {
      console.log("Could not extract score from truncated response");
      return null;
    }
    const score = parseInt(scoreMatch[1], 10);

    // Try to extract feedback
    const feedbackMatch = responseText.match(/"feedback"\s*:\s*"([^"]+)"/);
    const feedback = feedbackMatch
      ? feedbackMatch[1]
      : `Score: ${score}/${totalMarks} (response was truncated, detailed breakdown unavailable)`;

    // Try to extract any complete breakdown items
    const breakdown: QuestionBreakdown[] = [];
    const breakdownRegex = /\{\s*"questionId"\s*:\s*"([^"]+)"\s*,\s*"points"\s*:\s*(\d+)\s*,\s*"maxPoints"\s*:\s*(\d+)\s*,\s*"status"\s*:\s*"(correct|partial|incorrect|unanswered)"\s*,\s*"feedback"\s*:\s*"([^"]+)"\s*\}/g;

    let match;
    while ((match = breakdownRegex.exec(responseText)) !== null) {
      breakdown.push({
        questionId: match[1],
        points: parseInt(match[2], 10),
        maxPoints: parseInt(match[3], 10),
        status: match[4] as "correct" | "partial" | "incorrect" | "unanswered",
        feedback: match[5],
      });
    }

    console.log(`Recovered ${breakdown.length} complete breakdown items from truncated response`);

    return {
      score: Math.min(Math.max(0, score), totalMarks),
      maxScore: totalMarks,
      feedback: feedback + (breakdown.length === 0 ? " (Note: Detailed question breakdown was truncated)" : ""),
      breakdown,
    };
  } catch (error) {
    console.error("Truncation recovery failed:", error);
    return null;
  }
}

/**
 * Grade submission using TEXT COMPARISON with Gemini 2.5 Flash
 *
 * @param studentText - Student's extracted handwritten text (from QVQ-Max OCR)
 * @param markSchemeText - Mark scheme's extracted text (OCR'd when assessment was created)
 * @param totalMarks - Total marks available
 */
export async function gradeSubmissionWithText(
  studentText: string,
  markSchemeText: string,
  totalMarks: number
): Promise<GradingResult> {
  const hasGeminiKey = process.env.GEMINI_API_KEY;
  if (!hasGeminiKey) {
    console.warn("No GEMINI_API_KEY set, using mock grading");
    return mockGrading(totalMarks);
  }

  if (!studentText || studentText.trim().length === 0) {
    return {
      score: 0,
      maxScore: totalMarks,
      feedback: "No handwritten content could be extracted from the student's submission.",
      breakdown: [{
        questionId: "All",
        points: 0,
        maxPoints: totalMarks,
        status: "unanswered",
        feedback: "No handwritten answers were detected in the submission.",
      }],
    };
  }

  if (!markSchemeText || markSchemeText.trim().length === 0) {
    return {
      score: 0,
      maxScore: totalMarks,
      feedback: "No mark scheme text available for grading.",
      breakdown: [{
        questionId: "All",
        points: 0,
        maxPoints: totalMarks,
        status: "unanswered",
        feedback: "Mark scheme text is missing. Please ensure the assessment has a valid mark scheme.",
      }],
    };
  }

  try {
    const ai = getGeminiClient();

    const prompt = `You are grading a student's answers against a mark scheme.

═══════════════════════════════════════════════════════════════════════════════
                         TEXT-BASED GRADING
═══════════════════════════════════════════════════════════════════════════════

MARK SCHEME (extracted from the original document):
${markSchemeText}

═══════════════════════════════════════════════════════════════════════════════

STUDENT'S ANSWERS (extracted handwritten content only):
${studentText}

═══════════════════════════════════════════════════════════════════════════════
                    HOW TO INTERPRET THE MARK SCHEME
═══════════════════════════════════════════════════════════════════════════════

The mark scheme contains:
1. CRITERIA/EXPLANATIONS: Describes what makes an answer correct
2. EXAMPLE ANSWERS: May show sample answers (marked with ★EXPECTED: ...★)

⚠️ IMPORTANT: Example answers are just EXAMPLES, not the only correct answers!
The student's answer does NOT need to match the example word-for-word.
You must REASON whether the student's answer satisfies the CRITERIA.

═══════════════════════════════════════════════════════════════════════════════
                         FLEXIBLE GRADING RULES
═══════════════════════════════════════════════════════════════════════════════

1. READ the mark scheme criteria/explanation for each question
2. EVALUATE if the student's answer meets the criteria, even if:
   - Worded differently from the example
   - Uses different but equivalent expressions
   - Provides additional correct information

3. ANSWERS THAT MUST MATCH EXACTLY (no flexibility):
   - Binary/truth tables (0s and 1s must match exactly)
   - Pseudocode/code statements (logic must be correct)
   - Specific numerical values without ranges
   - Multiple choice answers (A, B, C, D)
   - Chemical formulas and equations

4. ANSWERS WHERE FLEXIBILITY IS ALLOWED:
   - Definitions and explanations (meaning matters, not exact words)
   - Essay/short answer questions (assess understanding)
   - Mathematical solutions (correct method + answer, even if steps differ)
   - Diagrams (all required components present)
   - Any question with criteria like "accept any valid answer"

5. For "[BLANK - no answer]", award 0 marks (unanswered)

6. Be lenient with:
   - Minor spelling variations
   - Equivalent mathematical expressions
   - Synonyms and paraphrasing
   - Alternative valid methods

Total marks available: ${totalMarks}

═══════════════════════════════════════════════════════════════════════════════
                         WORKING OUT / CALCULATION QUESTIONS
═══════════════════════════════════════════════════════════════════════════════

For questions requiring working/calculations:
1. The student's answer does NOT need to match the example step-by-step
2. If student wrote relevant workings AND got correct answer → REASON through their solution
3. If mark scheme explanation is unclear → REASON about the student's answer yourself
4. Students may show abbreviated or different (but valid) methods

REASONING APPROACH:
- Look at what the student actually wrote
- If they wrote workings that lead logically to the answer → valid
- If they skipped some steps but showed key parts → reason if the logic holds
- Don't require exact match to example - assess the LOGIC of their approach

Example: Mark scheme shows "5 + 3 = 8, 8 × 2 = 16, Answer: 16"
Student writes: "8 × 2 = 16" (skipped first step)
→ REASON: They likely computed 5+3=8 mentally, then wrote 8×2=16. Logic is valid. Award marks.

Example: Student shows different but valid method
→ Assess if the logic is sound and leads to correct answer

═══════════════════════════════════════════════════════════════════════════════
                           OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Respond in JSON format ONLY (no markdown code blocks):
{
  "score": <total marks awarded (0 to ${totalMarks})>,
  "maxScore": ${totalMarks},
  "feedback": "<2-3 sentence summary>",
  "breakdown": [
    {
      "questionId": "1a",
      "points": 2,
      "maxPoints": 3,
      "status": "partial",
      "feedback": "<DETAILED: explain what was correct, what was wrong, and why>"
    }
  ]
}

⚠️ FEEDBACK REQUIREMENTS:
- Be DETAILED and HELPFUL in each question's feedback
- Explain what the student got right
- Explain what was wrong and why
- For partial marks: explain what earned marks and what didn't
- For calculation questions: note if method was valid even if steps were skipped

IMPORTANT:
- Only respond with valid JSON
- Ensure score does not exceed ${totalMarks}
- Include ALL questions in the breakdown`;

    let response;
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Gemini API call attempt ${attempt}/${maxRetries}...`);
        response = await ai.models.generateContent({
          model: GEMINI_GRADING_MODEL,
          contents: prompt,
        });
        break; // Success, exit retry loop
      } catch (apiError) {
        lastError = apiError instanceof Error ? apiError : new Error(String(apiError));
        console.error(`Gemini API call attempt ${attempt} failed:`, lastError.message);

        // Check if it's a retryable error (network/timeout)
        const isRetryable = lastError.message.includes('fetch failed') ||
                           lastError.message.includes('ECONNRESET') ||
                           lastError.message.includes('ETIMEDOUT') ||
                           lastError.message.includes('network') ||
                           lastError.message.includes('timeout');

        if (isRetryable && attempt < maxRetries) {
          const delay = attempt * 2000; // 2s, 4s, 6s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (!isRetryable) {
          // Non-retryable error, fail immediately
          throw new Error(`Gemini API call failed: ${lastError.message}`);
        }
      }
    }

    if (!response && lastError) {
      throw new Error(`Gemini API call failed after ${maxRetries} attempts: ${lastError.message}`);
    }

    if (!response) {
      throw new Error("Gemini API returned null response");
    }

    let responseText = "";
    try {
      responseText = response.text || "";
    } catch (textError) {
      console.error("Failed to get text from response:", textError);
      console.error("Response object:", JSON.stringify(response, null, 2).substring(0, 1000));
      throw new Error(`Failed to extract text from Gemini response: ${textError instanceof Error ? textError.message : 'Unknown error'}`);
    }

    // Clean up the response
    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith("```")) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith("```")) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON parse error. Response text was:", responseText.substring(0, 500));
      console.log("Attempting truncation recovery...");

      // Try to recover from truncated JSON
      result = attemptTruncationRecovery(responseText, totalMarks);

      if (!result) {
        throw new Error(`Failed to parse grading response as JSON: ${parseError}`);
      }
      console.log("Truncation recovery successful - extracted score:", result.score);
    }

    const validatedScore = Math.min(Math.max(0, result.score || 0), totalMarks);

    console.log(`Grading complete: ${validatedScore}/${totalMarks}`);

    return {
      score: validatedScore,
      maxScore: totalMarks,
      feedback: result.feedback || `Score: ${validatedScore}/${totalMarks}`,
      breakdown: result.breakdown || [],
    };
  } catch (error) {
    console.error("Gemini grading error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw new Error(`Failed to grade submission with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Check if any files are PDFs (kept for backwards compatibility)
function hasPdfFiles(files: { buffer: Buffer; mimeType: string }[]): boolean {
  return files.some(f => f.mimeType.includes("pdf"));
}

/**
 * Grade a single student image against mark scheme images
 */
async function gradeImageVisually(
  studentImage: { buffer: Buffer; mimeType: string },
  markSchemeImages: { buffer: Buffer; mimeType: string }[],
  pageNumber: number,
  totalPages: number,
  totalMarks: number
): Promise<{ questionsFound: QuestionBreakdown[] }> {

  const prompt = `You are grading page ${pageNumber} of ${totalPages} from a student's answer sheet.

═══════════════════════════════════════════════════════════════════════════════
                         VISUAL COMPARISON GRADING
═══════════════════════════════════════════════════════════════════════════════

I am providing you with:
1. MARK SCHEME IMAGE(S) - These show the correct answers and marking criteria
2. STUDENT ANSWER SHEET - This is page ${pageNumber} of the student's work

YOUR TASK:
Look at the MARK SCHEME to understand what the correct answers should be.
Then look at the STUDENT'S ANSWER SHEET and find what they actually wrote.
Compare them and award marks accordingly.

═══════════════════════════════════════════════════════════════════════════════
                    HOW TO IDENTIFY EXPECTED ANSWERS
═══════════════════════════════════════════════════════════════════════════════

In the mark scheme, expected answers may be shown as:
- Bold or highlighted text
- Text after "Answer:", "Ans:", "A:"
- Numbers in boxes or underlined
- Worked examples or solutions
- For fill-in-the-blank questions: the complete sentence with blanks filled in
  (identify which parts are the filled answers vs the given text)

If the mark scheme shows an example or worked solution, use that to determine
what the student's answer should look like.

═══════════════════════════════════════════════════════════════════════════════
                    HOW TO IDENTIFY STUDENT'S ANSWERS
═══════════════════════════════════════════════════════════════════════════════

On the student's answer sheet, their answers are what they have ADDED:
- Handwritten text (pen/pencil)
- Filled boxes or blanks
- Calculations and working
- Circled or ticked options

⚠️ IMPORTANT: If the answer area is BLANK (no writing by student),
that question is UNANSWERED = 0 marks.

Do NOT confuse pre-printed question text with student answers.

═══════════════════════════════════════════════════════════════════════════════
                         GRADING RULES
═══════════════════════════════════════════════════════════════════════════════

1. For each question on this page:
   - Find the expected answer in the mark scheme
   - Find what the student wrote
   - Compare them

2. Award marks based on:
   - Correct answer matching mark scheme = full marks
   - Partially correct = partial marks (if allowed)
   - Incorrect or blank = 0 marks

3. MATHEMATICAL GRADING:
   - M marks (Method): Correct approach/formula
   - A marks (Accuracy): Correct numerical answer
   - B marks: Independent marks for specific values
   - ft (follow through): Only if mark scheme allows

═══════════════════════════════════════════════════════════════════════════════
                           OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Respond in JSON format ONLY (no markdown, no code blocks):
{
  "questionsFound": [
    {
      "questionId": "<question number like '1a' or '2b)ii'>",
      "points": <marks awarded>,
      "maxPoints": <max marks for this question>,
      "status": "correct" | "partial" | "incorrect" | "unanswered",
      "feedback": "<describe: expected answer from mark scheme vs what student wrote>",
      "deductions": [
        {
          "reason": "<why marks were lost>",
          "pointsLost": <marks deducted>
        }
      ]
    }
  ]
}

RULES:
- Only grade questions visible on THIS page
- "unanswered" = student left it blank = 0 marks
- "incorrect" = student wrote something but it doesn't match expected answer
- Always describe what was expected vs what student wrote
- If no questions found on this page, return {"questionsFound": []}

Total marks for the entire assessment: ${totalMarks}

IMPORTANT: Only respond with valid JSON.`;

  // Build content array: prompt + mark scheme images + student image
  const content: Array<{type: string; text?: string; image_url?: {url: string}}> = [
    { type: "text", text: prompt },
    { type: "text", text: "=== MARK SCHEME (reference for correct answers) ===" },
  ];

  // Add mark scheme images
  for (let i = 0; i < markSchemeImages.length; i++) {
    const ms = markSchemeImages[i];
    // Skip PDFs for now since QVQ-Max doesn't support them
    if (ms.mimeType.includes("pdf")) {
      continue;
    }
    const base64Data = ms.buffer.toString("base64");
    const imageUrl = `${getMimePrefix(ms.mimeType)}${base64Data}`;
    content.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  // Add student image
  content.push({ type: "text", text: `=== STUDENT ANSWER SHEET (Page ${pageNumber}) ===` });
  const studentBase64 = studentImage.buffer.toString("base64");
  const studentUrl = `${getMimePrefix(studentImage.mimeType)}${studentBase64}`;
  content.push({
    type: "image_url",
    image_url: { url: studentUrl },
  });

  let responseText = await callQvqApi([
    { role: "user", content: content },
  ]);

  if (!responseText) {
    return { questionsFound: [] };
  }

  // Clean up the response
  responseText = responseText.trim();
  if (responseText.startsWith("```json")) {
    responseText = responseText.slice(7);
  } else if (responseText.startsWith("```")) {
    responseText = responseText.slice(3);
  }
  if (responseText.endsWith("```")) {
    responseText = responseText.slice(0, -3);
  }
  responseText = responseText.trim();

  try {
    return JSON.parse(responseText);
  } catch {
    console.error("Failed to parse grading response for page", pageNumber);
    return { questionsFound: [] };
  }
}

/**
 * Grade using Gemini (supports PDFs)
 * Used when mark scheme is a PDF
 */
async function gradeWithGemini(
  studentImages: { buffer: Buffer; mimeType: string }[],
  markSchemeFiles: { buffer: Buffer; mimeType: string }[],
  totalMarks: number
): Promise<GradingResult> {
  const ai = getGeminiClient();

  const prompt = `You are grading a student's answer sheet against a mark scheme.

═══════════════════════════════════════════════════════════════════════════════
                         VISUAL COMPARISON GRADING
═══════════════════════════════════════════════════════════════════════════════

I am providing you with:
1. MARK SCHEME (PDF/images) - Shows the correct answers and marking criteria
2. STUDENT ANSWER SHEETS - ${studentImages.length} page(s) of the student's work

YOUR TASK:
Look at the MARK SCHEME to understand what the correct answers should be.
Then look at each STUDENT ANSWER SHEET page and find what they actually wrote.
Compare them and award marks accordingly.

═══════════════════════════════════════════════════════════════════════════════
                    HOW TO IDENTIFY EXPECTED ANSWERS
═══════════════════════════════════════════════════════════════════════════════

In the mark scheme, expected answers may be shown as:
- Bold or highlighted text
- Text after "Answer:", "Ans:", "A:"
- Numbers in boxes or underlined
- Worked examples or solutions
- For fill-in-the-blank: the complete sentence with blanks filled in

If the mark scheme shows an example or worked solution, use that to determine
what the student's answer should look like.

═══════════════════════════════════════════════════════════════════════════════
                    HOW TO IDENTIFY STUDENT'S ANSWERS
═══════════════════════════════════════════════════════════════════════════════

On the student's answer sheet, their answers are what they have ADDED:
- Handwritten text (pen/pencil)
- Filled boxes or blanks
- Calculations and working
- Circled or ticked options

⚠️ IMPORTANT: If the answer area is BLANK (no writing by student),
that question is UNANSWERED = 0 marks.

═══════════════════════════════════════════════════════════════════════════════
                         GRADING RULES
═══════════════════════════════════════════════════════════════════════════════

1. For each question:
   - Find the expected answer in the mark scheme
   - Find what the student wrote
   - Compare them

2. Award marks based on:
   - Correct answer = full marks
   - Partially correct = partial marks (if allowed)
   - Incorrect or blank = 0 marks

Total marks: ${totalMarks}

═══════════════════════════════════════════════════════════════════════════════
                           OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Respond in JSON format ONLY:
{
  "score": <total marks awarded>,
  "maxScore": ${totalMarks},
  "feedback": "<2-3 sentence summary>",
  "breakdown": [
    {
      "questionId": "<question number>",
      "points": <marks awarded>,
      "maxPoints": <max marks>,
      "status": "correct" | "partial" | "incorrect" | "unanswered",
      "feedback": "<expected vs actual answer>"
    }
  ]
}

IMPORTANT: Only respond with valid JSON.`;

  // Build contents array
  const contents: (string | { inlineData: { data: string; mimeType: string } })[] = [
    prompt,
    "=== MARK SCHEME ===",
  ];

  // Add mark scheme files
  for (const ms of markSchemeFiles) {
    contents.push({
      inlineData: {
        data: ms.buffer.toString("base64"),
        mimeType: ms.mimeType,
      },
    });
  }

  // Add student images
  contents.push("=== STUDENT ANSWER SHEETS ===");
  for (let i = 0; i < studentImages.length; i++) {
    contents.push(`Page ${i + 1}:`);
    contents.push({
      inlineData: {
        data: studentImages[i].buffer.toString("base64"),
        mimeType: studentImages[i].mimeType,
      },
    });
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: contents,
    });
  } catch (apiError) {
    console.error("Gemini visual grading API call failed:", apiError);
    throw new Error(`Gemini visual grading API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`);
  }

  if (!response) {
    throw new Error("Gemini visual grading API returned null response");
  }

  let responseText = "";
  try {
    responseText = response.text || "";
  } catch (textError) {
    console.error("Failed to get text from visual grading response:", textError);
    throw new Error(`Failed to extract text from Gemini visual grading response: ${textError instanceof Error ? textError.message : 'Unknown error'}`);
  }

  // Clean up the response
  responseText = responseText.trim();
  if (responseText.startsWith("```json")) {
    responseText = responseText.slice(7);
  } else if (responseText.startsWith("```")) {
    responseText = responseText.slice(3);
  }
  if (responseText.endsWith("```")) {
    responseText = responseText.slice(0, -3);
  }
  responseText = responseText.trim();

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (parseError) {
    console.error("JSON parse error in visual grading. Response text was:", responseText.substring(0, 500));
    throw new Error(`Failed to parse visual grading response as JSON: ${parseError}`);
  }

  const validatedScore = Math.min(Math.max(0, result.score || 0), totalMarks);

  return {
    score: validatedScore,
    maxScore: totalMarks,
    feedback: result.feedback || `Score: ${validatedScore}/${totalMarks}`,
    breakdown: result.breakdown || [],
  };
}

/**
 * Grade submission using VISUAL COMPARISON
 *
 * @param studentImages - Array of student answer sheet images (sorted by page order)
 * @param markSchemeImages - Array of mark scheme images/PDFs
 * @param totalMarks - Total marks available
 */
export async function gradeSubmission(
  studentImages: { buffer: Buffer; mimeType: string }[],
  markSchemeImages: { buffer: Buffer; mimeType: string }[],
  totalMarks: number
): Promise<GradingResult> {
  // If mark scheme contains PDFs, use Gemini (QVQ-Max doesn't support PDFs)
  if (hasPdfFiles(markSchemeImages)) {
    console.log("Mark scheme contains PDF(s), using Gemini for grading...");
    const hasGeminiKey = process.env.GEMINI_API_KEY;
    if (!hasGeminiKey) {
      console.warn("No GEMINI_API_KEY set for PDF grading");
      return mockGrading(totalMarks);
    }
    return gradeWithGemini(studentImages, markSchemeImages, totalMarks);
  }

  // Use QVQ-Max for image-based mark schemes
  const hasApiKey = process.env.QVQ_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!hasApiKey) {
    console.warn("No QVQ/DashScope API key set, using mock grading");
    return mockGrading(totalMarks);
  }

  try {
    console.log(`Grading ${studentImages.length} student images against ${markSchemeImages.length} mark scheme images with QVQ-Max...`);

    // Process each student image individually
    const allBreakdowns: QuestionBreakdown[] = [];

    for (let i = 0; i < studentImages.length; i++) {
      const pageNumber = i + 1;
      console.log(`  Grading page ${pageNumber}/${studentImages.length}...`);

      const result = await gradeImageVisually(
        studentImages[i],
        markSchemeImages,
        pageNumber,
        studentImages.length,
        totalMarks
      );

      if (result.questionsFound && result.questionsFound.length > 0) {
        allBreakdowns.push(...result.questionsFound);
      }
    }

    // Calculate total score
    const totalScore = allBreakdowns.reduce((sum, q) => sum + (q.points || 0), 0);
    const validatedScore = Math.min(Math.max(0, totalScore), totalMarks);

    // Generate overall feedback
    const correctCount = allBreakdowns.filter(q => q.status === "correct").length;
    const partialCount = allBreakdowns.filter(q => q.status === "partial").length;
    const incorrectCount = allBreakdowns.filter(q => q.status === "incorrect").length;
    const unansweredCount = allBreakdowns.filter(q => q.status === "unanswered").length;

    let feedback = `Score: ${validatedScore}/${totalMarks}. `;
    if (correctCount > 0) feedback += `${correctCount} correct. `;
    if (partialCount > 0) feedback += `${partialCount} partial. `;
    if (incorrectCount > 0) feedback += `${incorrectCount} incorrect. `;
    if (unansweredCount > 0) feedback += `${unansweredCount} unanswered.`;

    console.log(`Grading complete: ${validatedScore}/${totalMarks}`);

    return {
      score: validatedScore,
      maxScore: totalMarks,
      feedback: feedback.trim(),
      breakdown: allBreakdowns,
    };
  } catch (error) {
    console.error("Grading error:", error);
    throw new Error("Failed to grade submission with AI");
  }
}

function mockGrading(totalMarks: number): GradingResult {
  return {
    score: 0,
    maxScore: totalMarks,
    feedback: "Unable to grade submission. Please ensure API keys are configured (QVQ_API_KEY for images, GEMINI_API_KEY for PDFs).",
    breakdown: [
      {
        questionId: "All",
        points: 0,
        maxPoints: totalMarks,
        status: "unanswered",
        feedback: "Grading requires API keys to be configured. Please check your environment variables.",
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
    markdown += `### Question-by-Question Breakdown\n\n`;

    for (const item of result.breakdown) {
      // Status emoji
      const statusEmoji = {
        correct: "\u2705", // green check
        partial: "\u26a0\ufe0f", // warning
        incorrect: "\u274c", // red X
        unanswered: "\u2b55", // hollow circle
      }[item.status] || "";

      markdown += `#### ${statusEmoji} Question ${item.questionId}\n`;
      markdown += `**Score:** ${item.points}/${item.maxPoints}\n\n`;
      markdown += `${item.feedback}\n\n`;

      // Show deductions if any
      if (item.deductions && item.deductions.length > 0) {
        markdown += `**Deductions:**\n`;
        for (const deduction of item.deductions) {
          markdown += `- \u2212${deduction.pointsLost} mark${deduction.pointsLost !== 1 ? 's' : ''}: ${deduction.reason}\n`;
        }
        markdown += `\n`;
      }
    }
  }

  return markdown;
}
