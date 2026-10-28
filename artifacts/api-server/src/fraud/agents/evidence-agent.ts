import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

export type EvidenceExtraction = {
  sha256: string;
  extractedText: string | null;
  extractionStatus: string;
  amount?: number;
  reference?: string;
};

let workerPromise: ReturnType<typeof createWorker> | null = null;

async function recognizeImage(bytes: Uint8Array): Promise<string> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  const worker = await workerPromise;
  const result = await worker.recognize(bytes);
  return result.data.text.trim();
}

export async function inspectEvidence(
  bytes: Buffer,
  mimeType: string,
): Promise<EvidenceExtraction> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let extractedText: string | null = null;
  let extractionStatus = "metadata_only";
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    extractedText = bytes.toString("utf8").slice(0, 30_000);
    extractionStatus = "text_extracted";
  } else if (mimeType === "application/pdf") {
    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: new Uint8Array(bytes) });
      const result = await parser.getText();
      extractedText = result.text.slice(0, 30_000);
      if (extractedText.trim().length < 40) {
        const screenshots = await parser.getScreenshot({
          first: 3,
          scale: 1.5,
          imageBuffer: true,
          imageDataUrl: false,
        });
        const scannedPages: string[] = [];
        for (const page of screenshots.pages) {
          const pageText = await recognizeImage(page.data);
          if (pageText) scannedPages.push(pageText);
        }
        if (scannedPages.length) {
          extractedText = [extractedText.trim(), ...scannedPages]
            .filter(Boolean)
            .join("\n")
            .slice(0, 30_000);
        }
      }
      extractionStatus = extractedText.trim() ? "text_extracted" : "no_readable_text";
    } catch {
      extractionStatus = "extraction_failed";
    } finally {
      await parser?.destroy().catch(() => undefined);
    }
  } else if (mimeType.startsWith("image/")) {
    try {
      extractedText = (await recognizeImage(bytes)).slice(0, 30_000);
      extractionStatus = extractedText.trim() ? "text_extracted" : "no_readable_text";
    } catch {
      extractionStatus = "ocr_failed";
    }
  }
  const amountMatch = extractedText?.match(
    /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  const referenceMatch = extractedText?.match(
    /(?:utr|transaction\s*(?:id|ref(?:erence)?))\s*[:#-]?\s*([A-Z0-9-]{6,32})/i,
  );
  return {
    sha256,
    extractedText,
    extractionStatus,
    ...(amountMatch?.[1]
      ? { amount: Number(amountMatch[1].replaceAll(",", "")) }
      : {}),
    ...(referenceMatch?.[1] ? { reference: referenceMatch[1] } : {}),
  };
}
