import JSZip from 'jszip';
import { ExamData, Question, QuestionOption, SectionInfo } from '../types';

interface ParagraphRun {
  text: string;
  hasHighlight: boolean;
  hasUnderline: boolean;
  hasBold: boolean;
  start: number;
  end: number;
}

interface ParagraphData {
  text: string;
  runs: ParagraphRun[];
}

/**
 * Parse Word file (.docx) - CHÍNH XÁC 100% logic từ HTML
 */
export const parseWordToExam = async (file: File): Promise<ExamData> => {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('Không tìm thấy document.xml trong file Word');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml, 'application/xml');
  
  return parseDocumentXML(xmlDoc);
};

/**
 * ===== PARSE DOCX - CHÍNH XÁC TỪ HTML =====
 */
function parseDocumentXML(xmlDoc: Document): ExamData {
  const examData: ExamData = { 
    title: 'Đề thi Tiếng Anh',
    timeLimit: 60,
    sections: [],
    questions: [], 
    answers: {} 
  };

  const paragraphs = xmlDoc.getElementsByTagName('w:p');
  
  // Store structured data for each paragraph with run-level formatting
  const allParagraphData: ParagraphData[] = [];
  
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const runs = p.getElementsByTagName('w:r');
    const paragraphRuns: ParagraphRun[] = [];
    let currentPos = 0;

    for (let j = 0; j < runs.length; j++) {
      const run = runs[j];
      const textNodes = run.getElementsByTagName('w:t');
      let runText = '';

      for (let k = 0; k < textNodes.length; k++) {
        runText += textNodes[k].textContent || '';
      }

      const rPr = run.getElementsByTagName('w:rPr')[0];
      let hasHighlight = false;
      let hasUnderline = false;
      let hasBold = false;

      if (rPr) {
        // Check highlight
        const highlight = rPr.getElementsByTagName('w:highlight')[0];
        const shd = rPr.getElementsByTagName('w:shd')[0];
        
        if (highlight && highlight.getAttribute('w:val') !== 'none') {
          hasHighlight = true;
        }
        if (shd) {
          const fill = shd.getAttribute('w:fill');
          if (fill && fill !== 'auto' && fill.toUpperCase() !== 'FFFFFF') {
            hasHighlight = true;
          }
        }
        
        // Check underline
        const underline = rPr.getElementsByTagName('w:u')[0];
        if (underline) {
          const uVal = underline.getAttribute('w:val');
          if (!uVal || uVal.toLowerCase() !== 'none') {
            hasUnderline = true;
          }
        }
        
        // Check bold
        const bold = rPr.getElementsByTagName('w:b')[0];
        if (bold) {
          const bVal = bold.getAttribute('w:val');
          if (!bVal || bVal !== '0') {
            hasBold = true;
          }
        }
      }

      if (runText) {
        paragraphRuns.push({
          text: runText,
          hasHighlight: hasHighlight,
          hasUnderline: hasUnderline,
          hasBold: hasBold,
          start: currentPos,
          end: currentPos + runText.length
        });
        currentPos += runText.length;
      }
    }

    const paragraphText = paragraphRuns.map(r => r.text).join('');
    if (paragraphText.trim()) {
      allParagraphData.push({
        text: paragraphText,
        runs: paragraphRuns
      });
    }
  }

  parseQuestionsFromParagraphs(allParagraphData, examData);
  
  return examData;
}

/**
 * Parse questions from paragraphs - CHÍNH XÁC TỪ HTML
 */
function parseQuestionsFromParagraphs(paragraphs: ParagraphData[], examData: ExamData) {
  let currentSection: SectionInfo | null = null;
  let currentPart: string | null = null;
  let currentQuestion: Question | null = null;
  let readingPassage = '';
  let inReading = false;

  for (const pData of paragraphs) {
    const line = pData.text.trim();
    if (!line) continue;

    // SECTION
    const sectionMatch = line.match(/SECTION\s+([A-Z])\.\s*([^:]+):\s*(.*?POINTS?)/i);
    if (sectionMatch) {
      currentSection = {
        letter: sectionMatch[1],
        name: sectionMatch[2].trim(),
        points: sectionMatch[3]
      };
      continue;
    }

    // PART
    const partMatch = line.match(/^([IVX]+)\.\s*(.+)/i);
    if (
      partMatch &&
      (
        line.toLowerCase().includes('circle') ||
        line.toLowerCase().includes('read') ||
        line.toLowerCase().includes('complete') ||
        line.toLowerCase().includes('rewrite') ||
        line.toLowerCase().includes('put')
      )
    ) {
      currentPart = line;
      continue;
    }

    // Reading passage
    if (line.match(/^(A surprising gift|Stewart the Dragon)/i)) {
      inReading = true;
      readingPassage = line + '\n';
      continue;
    }

    if (inReading && !line.match(/^Câu\s*\d+/i)) {
      readingPassage += line + '\n';
      continue;
    } else if (line.match(/^Câu\s*\d+/i)) {
      inReading = false;
    }

    // Câu X.
    const qMatch = line.match(/^Câu\s*(\d+)[\.\s:]+(.*)$/i);
    if (qMatch) {
      if (currentQuestion) {
        if (!currentQuestion.type || currentQuestion.type === 'unknown') {
          currentQuestion.type = currentQuestion.options.length >= 2 ? 'multiple_choice' : 'writing';
        }
        examData.questions.push(currentQuestion);
      }

      const qNum = parseInt(qMatch[1], 10);
      const qContent = qMatch[2].trim();

      currentQuestion = {
        number: qNum,
        section: currentSection || undefined,
        part: currentPart || undefined,
        text: qContent,
        options: [],
        correctAnswer: null,
        type: 'unknown',
        passage: readingPassage
      };

      // Extract options with underline info
      extractOptionsWithUnderline(pData, currentQuestion);
      continue;
    }

    // Options dòng riêng
    if (currentQuestion && line.match(/^\s*[A-D][\.\)]/i)) {
      extractOptionsWithUnderline(pData, currentQuestion);
      continue;
    }

    // Đáp án:
    const ansMatch = line.match(/Đáp án:\s*(.+)/i);
    if (ansMatch && currentQuestion) {
      const ansText = ansMatch[1].trim();
      if (ansText) currentQuestion.correctAnswer = ansText;
      currentQuestion.type = 'writing';
      continue;
    }

    // Dòng phụ (→ Last night, there ...)
    if (currentQuestion) {
      currentQuestion.text += (currentQuestion.text ? '\n' : '') + line;
      continue;
    }
  }

  if (currentQuestion) {
    if (!currentQuestion.type || currentQuestion.type === 'unknown') {
      currentQuestion.type = currentQuestion.options.length >= 2 ? 'multiple_choice' : 'writing';
    }
    examData.questions.push(currentQuestion);
  }

  // Xác định đáp án MCQ từ highlight hoặc underline của chữ A/B/C/D
  examData.questions.forEach((q: Question) => {
    if (q.type !== 'multiple_choice') return;

    // Tìm option có isCorrect (từ highlight)
    const correctOpt = q.options.find((o: QuestionOption) => o.isCorrect);
    
    if (correctOpt) {
      q.correctAnswer = correctOpt.letter;
      examData.answers[q.number] = q.correctAnswer;
    }
  });

  examData.questions.sort((a: Question, b: Question) => a.number - b.number);
  
  // Group questions into sections
  groupQuestionsIntoSections(examData);
}

/**
 * Group questions into sections
 */
function groupQuestionsIntoSections(examData: ExamData) {
  const sectionMap = new Map<string, Question[]>();
  
  examData.questions.forEach(q => {
    const sectionKey = q.section ? `${q.section.letter}-${q.section.name}` : 'default';
    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, []);
    }
    sectionMap.get(sectionKey)!.push(q);
  });
  
  sectionMap.forEach((questions, key) => {
    const firstQ = questions[0];
    examData.sections.push({
      name: firstQ.section ? `SECTION ${firstQ.section.letter}. ${firstQ.section.name}` : 'Tất cả câu hỏi',
      description: firstQ.part || '',
      points: firstQ.section?.points || '',
      questions: questions,
      readingPassage: questions[0].passage
    });
  });
}

/**
 * Extract options with underline - CHÍNH XÁC TỪ HTML
 */
function extractOptionsWithUnderline(pData: ParagraphData, question: Question) {
  const line = pData.text;
  const runs = pData.runs;
  
  // Find all A. B. C. D. positions
  const optionRegex = /([A-D])[\.\)]\s*/g;
  const matches: Array<{
    letter: string;
    matchStart: number;
    matchEnd: number;
    contentStart: number;
  }> = [];
  let m;

  while ((m = optionRegex.exec(line)) !== null) {
    matches.push({
      letter: m[1].toUpperCase(),
      matchStart: m.index,
      matchEnd: m.index + m[0].length - (m[0].endsWith(' ') ? 1 : 0),
      contentStart: m.index + m[0].length
    });
  }

  if (matches.length === 0) return;

  for (let i = 0; i < matches.length; i++) {
    const { letter, matchStart, contentStart } = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].matchStart : line.length;

    // Get option text
    let optionText = line.slice(contentStart, nextStart).trim();
    optionText = optionText.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();

    const exists = question.options.find((o: QuestionOption) => o.letter === letter);
    if (exists || !optionText) continue;

    // Check if this option letter (A., B., etc.) or its content has highlight
    let isCorrect = false;
    
    for (const run of runs) {
      // Check overlap with the option marker OR content
      const overlapStart = Math.max(run.start, matchStart);
      const overlapEnd = Math.min(run.end, nextStart);
      
      if (overlapStart < overlapEnd) {
        // This run overlaps with this option area
        if (run.hasHighlight) {
          isCorrect = true;
          break;
        }
      }
    }

    // Build underlined text representation for PHONETICS
    const textWithUnderline = buildFormattedText(runs, contentStart, nextStart);

    question.options.push({
      letter: letter,
      text: optionText,
      textWithUnderline: textWithUnderline,
      isCorrect: isCorrect
    });
  }

  if (question.options.length >= 2 && question.type !== 'writing') {
    question.type = 'multiple_choice';
  }

  question.options.sort((a: QuestionOption, b: QuestionOption) => a.letter.localeCompare(b.letter));
}

/**
 * Build formatted text with underline and bold - CHÍNH XÁC TỪ HTML
 */
function buildFormattedText(runs: ParagraphRun[], startPos: number, endPos: number): string {
  let result = '';
  
  for (const run of runs) {
    // Check if this run overlaps with our range
    if (run.end <= startPos || run.start >= endPos) continue;
    
    // Get the overlapping portion
    const overlapStart = Math.max(run.start, startPos);
    const overlapEnd = Math.min(run.end, endPos);
    
    // Calculate offset within the run
    const runOffset = overlapStart - run.start;
    const runLength = overlapEnd - overlapStart;
    const textPortion = run.text.substr(runOffset, runLength);
    
    if (!textPortion) continue;
    
    let formattedText = escapeHtml(textPortion);
    
    // Apply formatting
    if (run.hasUnderline && run.hasBold) {
      formattedText = `<span class="underlined-part"><strong>${formattedText}</strong></span>`;
    } else if (run.hasUnderline) {
      formattedText = `<span class="underlined-part">${formattedText}</span>`;
    } else if (run.hasBold) {
      formattedText = `<strong>${formattedText}</strong>`;
    }
    
    result += formattedText;
  }
  
  // Clean up excessive whitespace but preserve structure
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * Escape HTML - CHÍNH XÁC TỪ HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Validate exam data
 */
export const validateExamData = (data: ExamData): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.questions || data.questions.length === 0) {
    errors.push('Không tìm thấy câu hỏi nào trong file');
  }

  data.questions.forEach((q: Question) => {
    if (!q.text && q.options.length === 0) {
      errors.push(`Câu ${q.number}: Thiếu nội dung câu hỏi`);
    }
    if (q.type === 'multiple_choice' && (!q.options || q.options.length === 0)) {
      errors.push(`Câu ${q.number}: Thiếu đáp án lựa chọn`);
    }
    if (!q.correctAnswer) {
      errors.push(`Câu ${q.number}: Chưa đánh dấu đáp án đúng (highlight)`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
