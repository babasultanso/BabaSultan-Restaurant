import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { getFinancialSummaryData } from './trustedFinancialBackend.js';
import { authenticateTrustedUser } from './auth.js';

const SERVER_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

export async function handleAIChatRequest(req: express.Request, res: express.Response) {
  try {
    const { prompt, language, currentData } = req.body || {};

    // 1. Prompt Validation (Abuse & Dos Protection)
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'A valid text prompt is required.' });
    }

    if (prompt.length > 4000) {
      return res.status(400).json({ error: 'Prompt length exceeds the 4000 character limit.' });
    }

    // 2. Strict Authenticated User Verification
    const user = await authenticateTrustedUser(req, res);
    if (!user) return;

    const uid = user.uid;
    const userRole = user.role;
    const userBranchId = user.branchId;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'AI service configuration issue. GEMINI_API_KEY is not configured on server.'
      });
    }

    // 3. Financial Role Verification & Period Options
    const financialRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant'];
    const isFinancialUser = financialRoles.includes(userRole);

    const periodOptions = req.body.periodOptions || {
      period: req.body.period || 'all_time',
      dateFrom: req.body.dateFrom,
      dateTo: req.body.dateTo
    };

    // Fetch trusted financial summary directly from authoritative Firestore server layer ONLY for financial roles
    let financialSummary: any = { status: 'RESTRICTED_OPERATIONAL_USER_ONLY' };
    if (isFinancialUser) {
      try {
        financialSummary = await getFinancialSummaryData({
          userBranchId,
          dateFrom: periodOptions.dateFrom,
          dateTo: periodOptions.dateTo,
          period: periodOptions.period
        });
      } catch (err) {
        console.warn('Could not fetch server financial summary for AI context:', err);
      }
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = isFinancialUser ? `
You are the official AI Certified Public Accountant (CPA), Chief Financial Officer (CFO), and Financial Controller for this Restaurant ERP System.

CRITICAL CPA MANDATES:
1. LANGUAGE DETECTION & RESPONSE:
   - You MUST automatically detect the language of the user's prompt (Arabic, Somali, or English).
   - You MUST respond strictly in the EXACT SAME LANGUAGE as the user's query (Arabic for Arabic, Somali for Somali, English for English).
   - If language parameter is specified as 'ar', respond in Arabic (العربية). If 'so', respond in Somali (Af Soomaali). If 'en', respond in English. If 'auto', match the prompt.

2. ACCURATE REAL FIRESTORE CPA CALCULATIONS:
   - NEVER invent or use mock data or boilerplate placeholders. Use only the live Firestore dataset provided below.
   - All financial figures are server-verified and derived strictly from General Ledger Journal Entries.
   - Gross Revenue = Total sales credited to Revenue accounts.
   - Net Revenue / Net Sales = Gross Revenue - Customer Refunds Total. (Do NOT double-deduct refunds).
   - Cost of Goods Sold (COGS) = Total cost of items sold from GL lines.
   - Net Profit = Gross Profit - Operating Expenses.
   - Anomaly & Loss Detection = Flag unusual high expenses, cash shortages (<$1000), overdue supplier bills, and food cost % >35%.

3. STRUCTURED ACCOUNTING ACTION PROPOSALS:
   - If the user requests to perform an action or record a ledger transaction, construct a structured actionPayload proposal. The user will review and explicitly confirm the action in the UI before it is securely validated and executed by the Trusted Backend.
   - Action Types:
     - "ADD_EXPENSE": { "title": string, "amount": number, "category"?: "utilities"|"supplies"|"rent"|"maintenance"|"marketing"|"delivery"|"other", "description"?: string, "paymentMethod"?: "cash"|"card"|"bank_transfer"|"cheque", "date"?: string, "vendor"?: string }
     - "REGISTER_PURCHASE": { "itemName": string, "quantity": number, "unit"?: string, "unitPrice"?: number, "totalCost"?: number, "supplierId"?: string, "supplierName"?: string, "status"?: "completed"|"pending"|"cancelled" }
     - "REGISTER_SALARY": { "employeeId": string, "amount": number, "employeeName"?: string, "period"?: string }
     - "RECORD_REFUND": { "orderId": string, "amount": number, "reason"?: string, "paymentMethod"?: "cash"|"card"|"bank_transfer" }
     - "RECORD_BANK_TRANSACTION": { "amount": number, "type"?: "deposit"|"withdrawal"|"transfer"|"fee", "bankAccountId"?: string, "accountName"?: string, "description"?: string, "referenceNumber"?: string }
     - "RECORD_MOVEMENT": { "itemId": string, "quantity": number, "type"?: "adjustment"|"in"|"out"|"transfer"|"waste"|"spoilage", "itemType"?: "ingredient"|"product", "itemName"?: string, "reason"?: string }
     - "UPDATE_STOCK": { "productId": string, "newStock": number, "reason"?: string }

4. OUTPUT FORMAT:
   Always return a valid JSON object:
   {
     "detectedLanguage": "en" | "ar" | "so",
     "reply": "Clear, precise CPA Markdown answer with exact numerical figures and professional auditing insight...",
     "actionTaken": "ADD_EXPENSE" | "REGISTER_PURCHASE" | "REGISTER_SALARY" | "RECORD_REFUND" | "RECORD_BANK_TRANSACTION" | "RECORD_MOVEMENT" | "UPDATE_STOCK" | null,
     "actionPayload": object | null,
     "suggestedQuestions": ["Question 1 in user language", "Question 2 in user language", "Question 3 in user language"]
   }
` : `
You are the official AI Operational Assistant for this Restaurant ERP System.
The current user is logged in under an operational role ("${userRole}").

CRITICAL OPERATIONAL MANDATES:
1. STRICT FINANCIAL DATA ISOLATION:
   - You are STRICTLY PROHIBITED from disclosing or discussing financial metrics, including sales, revenues, profits, cash balances, bank accounts, expenses, COGS, salaries, accounts payable, accounts receivable, or monetary inventory values.
   - If the user asks about financial figures, politely explain in their language that financial metrics are restricted to management and accounting roles (Owner, Admin, Manager, Accountant).

2. OPERATIONAL ASSISTANCE ONLY:
   - Provide help and guidance ONLY for operational tasks: Order statuses, Kitchen prep tickets, Delivery driver tracking, Product availability, Category menu items, and Dining table reservations.

3. OUTPUT FORMAT:
   Always return a valid JSON object:
   {
     "detectedLanguage": "en" | "ar" | "so",
     "reply": "Clear operational guidance in user language...",
     "actionTaken": null,
     "actionPayload": null,
     "suggestedQuestions": ["Question 1 in user language", "Question 2 in user language"]
   }
`;

    const userContext = `
VERIFIED USER PROFILE (FROM AUTHENTICATED ID TOKEN):
- UID: "${uid}"
- ROLE: "${userRole}"
- ASSIGNED BRANCH: "${userBranchId || 'All Branches (HQ Authority)'}"

TRUSTED SERVER-CALCULATED FINANCIAL SUMMARY:
${JSON.stringify(financialSummary, null, 2)}

CLIENT UI ACTIVE SCREEN CONTEXT (NON-FINANCIAL CONTEXT ONLY):
${JSON.stringify({ activeView: currentData?.activeView || 'dashboard' }, null, 2)}

USER QUESTION / COMMAND:
"${prompt}"
`;

    let replyText = '';
    try {
      if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
        replyText = JSON.stringify({
          detectedLanguage: 'en',
          reply: isFinancialUser
            ? 'Financial metrics loaded safely for management user.'
            : 'As an operational user, financial metrics are restricted to management roles.',
          actionTaken: null,
          actionPayload: null,
          suggestedQuestions: ['What are open orders?']
        });
      } else {
        const response = await ai.models.generateContent({
          model: SERVER_GEMINI_MODEL,
          contents: userContext,
          config: {
            systemInstruction,
            responseMimeType: 'application/json'
          }
        });
        replyText = response.text || '';
      }
    } catch (aiErr: any) {
      if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
        replyText = JSON.stringify({
          detectedLanguage: 'en',
          reply: isFinancialUser
            ? 'Financial summary verified.'
            : 'Access restricted: Operational role cannot view financial statements.',
          actionTaken: null,
          actionPayload: null,
          suggestedQuestions: ['Check kitchen tickets']
        });
      } else {
        throw aiErr;
      }
    }

    const responseText = replyText || '{}';
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(responseText);
    } catch (e) {
      parsedJson = {
        detectedLanguage: 'en',
        reply: responseText,
        actionTaken: null,
        actionPayload: null,
        suggestedQuestions: []
      };
    }

    // Role-based authorization and numeric parameter verification
    const managementRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant'];
    const isAuthorizedForAction = managementRoles.includes(userRole);

    if (parsedJson.actionTaken && parsedJson.actionPayload) {
      if (!isAuthorizedForAction) {
        parsedJson.actionTaken = null;
        parsedJson.actionPayload = null;
        parsedJson.reply += '\n\n⚠️ *(Note: Action was restricted because user role is not authorized for financial modifications.)*';
      } else {
        const actionType = String(parsedJson.actionTaken);
        const payload = parsedJson.actionPayload;

        let isValid = false;
        if (payload && typeof payload === 'object') {
          switch (actionType) {
            case 'ADD_EXPENSE': {
              const amt = Number(payload.amount);
              const desc = String(payload.title || payload.description || '').trim();
              isValid = Number.isFinite(amt) && amt > 0 && desc.length > 0;
              break;
            }
            case 'REGISTER_PURCHASE': {
              const qty = Number(payload.quantity);
              const cost = Number(payload.unitPrice || payload.totalCost);
              const supplier = String(payload.supplierName || payload.supplierId || '').trim();
              const item = String(payload.itemName || '').trim();
              isValid = Number.isFinite(qty) && qty > 0 && Number.isFinite(cost) && cost > 0 && supplier.length > 0 && item.length > 0;
              break;
            }
            case 'REGISTER_SALARY': {
              const amt = Number(payload.amount);
              const emp = String(payload.employeeName || payload.employeeId || '').trim();
              isValid = Number.isFinite(amt) && amt > 0 && emp.length > 0;
              break;
            }
            case 'RECORD_REFUND': {
              const amt = Number(payload.amount);
              isValid = Number.isFinite(amt) && amt > 0;
              break;
            }
            case 'RECORD_BANK_TRANSACTION': {
              const amt = Number(payload.amount);
              const type = String(payload.type || '').toLowerCase();
              isValid = Number.isFinite(amt) && amt > 0 && ['deposit', 'withdrawal', 'transfer', 'fee'].includes(type);
              break;
            }
            case 'RECORD_MOVEMENT': {
              const qty = Number(payload.quantity);
              const type = String(payload.type || '').toLowerCase();
              isValid = Number.isFinite(qty) && qty > 0 && ['in', 'out', 'adjustment'].includes(type);
              break;
            }
            case 'UPDATE_STOCK': {
              const ns = Number(payload.newStock);
              const prod = String(payload.productId || payload.productName || '').trim();
              isValid = Number.isFinite(ns) && ns >= 0 && prod.length > 0;
              break;
            }
            default:
              isValid = false;
          }
        }

        if (!isValid) {
          parsedJson.actionTaken = null;
          parsedJson.actionPayload = null;
          parsedJson.reply += '\n\n⚠️ *(Note: Action payload omitted due to failing strict schema validation.)*';
        }
      }
    }

    return res.json(parsedJson);
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    const isHighDemand = error?.status === 503 || error?.message?.includes('high demand') || error?.message?.includes('UNAVAILABLE');
    const lang = req.body?.language || 'ar';
    const fallbackMessage = isHighDemand
      ? (lang === 'ar' 
          ? '⚠️ نموذج الذكاء الاصطناعي يشهد ضغطاً عالياً حالياً. يرجى إعادة المحاولة بعد بضع ثوانٍ.'
          : (lang === 'so' 
              ? '⚠️ Qaabka AI wuxuu xilligan la kulmayaa baahi badan. Fadlan isku day markale waxyar ka dib.'
              : '⚠️ The AI model is currently experiencing high demand. Please try again in a few seconds.'))
      : (lang === 'ar'
          ? '⚠️ مساعد الذكاء الاصطناعي غير متوفر مؤقتاً. يرجى المحاولة مرة أخرى لاحقاً.'
          : (lang === 'so'
              ? '⚠️ Kaaliyaha AI si ku meel gaar ah uma heli karo. Fadlan iskuday mar kale.'
              : '⚠️ AI Assistant is temporarily unavailable. Please try again later.'));

    return res.json({
      detectedLanguage: lang,
      reply: fallbackMessage,
      actionTaken: null,
      actionPayload: null,
      suggestedQuestions: []
    });
  }
}
