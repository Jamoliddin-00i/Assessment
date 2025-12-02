export interface OcrResult {
    text: string;
}

export const OcrService = {
    async extractTextFromFiles(_files: Buffer[]): Promise<OcrResult> {
        // TODO: integrate real OCR API here (Google Cloud Vision, AWS Textract, etc.)
        return {
            text: "Mocked OCR text from submission files",
        };
    },
};
