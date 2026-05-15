const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {

    try {
        const { selfDescription, jobDescription } = req.body

        // Validate that job description is provided
        if (!jobDescription) {
            return res.status(400).json({
                message: "Job description is required"
            })
        }

        // Validate that either resume file or self description is provided
        if (!req.file && !selfDescription) {
            return res.status(400).json({
                message: "Either a resume file or self description is required"
            })
        }

        // Extract resume text if file is provided
        let resumeContent = ""
        if (req.file) {
            const pdfParseResult = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
            resumeContent = pdfParseResult.text
        }

        console.log("Generating AI report...")
        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContent,
            selfDescription: selfDescription || "",
            jobDescription
        })

        console.log("AI Response:", JSON.stringify(interViewReportByAi, null, 2))

        // Validate AI response has required fields
        if (!interViewReportByAi) {
            throw new Error("AI service returned no data")
        }

        // Ensure arrays exist
        const reportData = {
            user: req.user.id,
            resume: resumeContent,
            selfDescription: selfDescription || "",
            jobDescription,
            title: interViewReportByAi.title || jobDescription.split('\n')[0].substring(0, 100),
            matchScore: interViewReportByAi.matchScore || 0,
            technicalQuestions: interViewReportByAi.technicalQuestions || [],
            behavioralQuestions: interViewReportByAi.behavioralQuestions || [],
            skillGaps: interViewReportByAi.skillGaps || [],
            preparationPlan: interViewReportByAi.preparationPlan || []
        }

        console.log("Creating interview report with data:", JSON.stringify(reportData, null, 2))

        const interviewReport = await interviewReportModel.create(reportData)

        console.log("Interview report created successfully")

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })

    } catch (error) {
        console.error("Error generating interview report:", error)
        res.status(500).json({
            message: "Failed to generate interview report",
            error: error.message
        })
    }

}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }