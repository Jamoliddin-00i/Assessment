export interface GradeArgs {
    assessmentId: string;
    submissionId: string;
    ocrText: string;
}

export type GradedQuestion = {
    questionId: string;
    awardedMarks: number;
    aiConfidence?: number | null;
    ocrText?: string | null;
    feedback?: string | null;
};

export const GradingService = {
    async gradeSubmission(_args: GradeArgs): Promise<GradedQuestion[]> {
        // TODO: integrate real grading API here
        return [];
    },
};
