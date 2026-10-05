const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai")
const puppeteer = require("puppeteer")

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY)


// Define the response schema compatible with Google's API
const interviewReportSchema = {
    type: SchemaType.OBJECT,
    properties: {
        matchScore: {
            type: SchemaType.NUMBER,
            description: "A score between 0 and 100 indicating how well the candidate's profile matches the job"
        },
        technicalQuestions: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    question: { type: SchemaType.STRING, description: "The technical question" },
                    intention: { type: SchemaType.STRING, description: "The intention of the interviewer" },
                    answer: { type: SchemaType.STRING, description: "How to answer this question" }
                },
                required: ["question", "intention", "answer"]
            },
            description: "Technical questions that can be asked in the interview"
        },
        behavioralQuestions: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    question: { type: SchemaType.STRING, description: "The behavioral question" },
                    intention: { type: SchemaType.STRING, description: "The intention of the interviewer" },
                    answer: { type: SchemaType.STRING, description: "How to answer this question" }
                },
                required: ["question", "intention", "answer"]
            },
            description: "Behavioral questions that can be asked in the interview"
        },
        skillGaps: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    skill: { type: SchemaType.STRING, description: "The skill which the candidate is lacking" },
                    severity: { type: SchemaType.STRING, enum: ["low", "medium", "high"], description: "The severity of this skill gap" }
                },
                required: ["skill", "severity"]
            },
            description: "List of skill gaps in the candidate's profile"
        },
        preparationPlan: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    day: { type: SchemaType.NUMBER, description: "The day number in the preparation plan" },
                    focus: { type: SchemaType.STRING, description: "The main focus of this day" },
                    tasks: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING },
                        description: "List of tasks to be done on this day"
                    }
                },
                required: ["day", "focus", "tasks"]
            },
            description: "A day-wise preparation plan for the candidate"
        },
        title: {
            type: SchemaType.STRING,
            description: "The title of the job for which the interview report is generated"
        }
    },
    required: ["matchScore", "technicalQuestions", "behavioralQuestions", "skillGaps", "preparationPlan", "title"]
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

    const prompt = `You are an expert technical interview coach. Generate a comprehensive interview preparation report for a candidate applying for a job in valid JSON format.

Candidate Information:
Resume: ${resume}

Self Description: ${selfDescription}

Job Description: ${jobDescription}

Return ONLY valid JSON (no markdown, no explanations) with this exact structure:
{
  "matchScore": <number 0-100>,
  "technicalQuestions": [
    {"question": <string>, "intention": <string>, "answer": <string>},
    ...
  ],
  "behavioralQuestions": [
    {"question": <string>, "intention": <string>, "answer": <string>},
    ...
  ],
  "skillGaps": [
    {"skill": <string>, "severity": "low|medium|high"},
    ...
  ],
  "preparationPlan": [
    {"day": <number>, "focus": <string>, "tasks": [<string>, ...]},
    ...
  ],
  "title": <string>
}`

    try {
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
        })
        
        const response = await model.generateContent(prompt)
        
        const result = response.response
        const responseText = result.candidates[0].content.parts[0].text
        
        console.log("Raw AI Response:", responseText)
        const jsonResponse = responseText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim()
        const parsedResponse = JSON.parse(jsonResponse)
        console.log("Parsed AI Response:", parsedResponse)
        
        return parsedResponse
    } catch (error) {
        console.error("AI Service Error:", error)
        throw new Error(`Failed to generate interview report: ${error.message}`)
    }
}



async function generatePdfFromHtml(htmlContent) {
    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "domcontentloaded" })

        const pdfBuffer = await page.pdf({
            format: "A4", margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        })

        await browser.close()

        return pdfBuffer
    } catch (error) {
        console.error("PDF generation error:", error)
        throw new Error(`Failed to generate PDF: ${error.message}`)
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate a professional resume for a candidate with the following details:

Resume: ${resume}

Self Description: ${selfDescription}

Job Description: ${jobDescription}

Requirements:
- Return ONLY a JSON object with a single field "html" containing the complete HTML content
- The HTML must be self-contained with inline CSS (no external dependencies)
- Tailor the resume for the given job description
- Make it look professional but simple
- Keep it to 1-2 pages when printed
- Use semantic HTML5
- Include inline styles only
- Make it ATS-friendly (use standard formatting, avoid complex layouts)
- Do NOT sound like AI-generated content

Important: Return ONLY valid JSON with the html field.`

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(resumePdfSchema),
            }
        })

        console.log("Resume PDF AI Response:", response.text)
        const jsonContent = JSON.parse(response.text)

        if (!jsonContent.html) {
            throw new Error("No HTML content in AI response")
        }

        const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

        return pdfBuffer
    } catch (error) {
        console.error("Resume PDF generation error:", error)
        throw new Error(`Failed to generate resume PDF: ${error.message}`)
    }

}

module.exports = { generateInterviewReport, generateResumePdf }
