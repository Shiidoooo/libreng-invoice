/**
 * send-document-email: emails a document (PDF attached) to a customer for the signed-in seller.
 *
 * POST /functions/v1/send-document-email      Auth: the seller's Supabase session (Bearer token)
 * Body: { to, subject, message, fileName, pdfBase64 }
 *
 * The email is sent through Brevo from the service's own address, under the seller's
 * business name. The seller is always CC'd and set as Reply-To, using the email address
 * of their account, so they keep a copy and replies reach them. The browser cannot
 * choose the sender, the CC or the Reply-To.
 *
 * Abuse controls (this is the only feature that reaches people outside the app):
 *   - a valid session with a confirmed email is required;
 *   - register_email_send() in the database enforces per-account and service-wide daily limits;
 *   - one recipient per email; plain text only; the attachment must be a PDF under the size limit;
 *   - a fixed footer names the seller and the service.
 *
 * Secrets (Supabase → Edge Functions → Secrets; never in the repo or in VITE_ variables):
 *   BREVO_API_KEY          Brevo API key (v3)
 *   EMAIL_SENDER_ADDRESS   an address verified in Brevo, e.g. invoices@yourdomain.com
 *   ALLOWED_ORIGINS        comma-separated site origins allowed to call this function
 * SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;
/** About 1.5 MB of PDF once decoded; a long three-page document is about 0.7 MB. */
const MAX_PDF_BASE64_LENGTH = 2_000_000;
const MAX_BODY_BYTES = MAX_PDF_BASE64_LENGTH + 16_000;
const BREVO_TIMEOUT_MS = 15_000;
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const FILE_NAME_PATTERN = /^[\w.-]{1,80}\.pdf$/;
/** "%PDF-" in base64. */
const PDF_BASE64_PREFIX = 'JVBERi0';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

type ErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'UNAUTHENTICATED'
  | 'EMAIL_NOT_CONFIRMED'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'EMAIL_PROVIDER_FAILED';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  // Only listed origins get CORS headers; others are refused by the browser.
  if (!allowedOrigins.includes(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function respond(request: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fail(request: Request, status: number, code: ErrorCode, message: string, requestId: string): Response {
  return respond(request, status, { status: 'error', data: null, message, error: { code, details: [] }, requestId });
}

interface SendRequest {
  to: string;
  subject: string;
  message: string;
  fileName: string;
  pdfBase64: string;
}

/** Returns the validated request, or the name of the first field that is wrong. */
function parseRequest(value: unknown): SendRequest | string {
  if (typeof value !== 'object' || value === null) return 'body';
  const body = value as Record<string, unknown>;
  const text = (key: string) => (typeof body[key] === 'string' ? (body[key] as string) : null);

  const to = text('to')?.trim() ?? '';
  if (to.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(to)) return 'to';
  const subject = text('subject')?.replace(/[\r\n]+/g, ' ').trim() ?? '';
  if (subject === '' || subject.length > MAX_SUBJECT_LENGTH) return 'subject';
  const message = text('message')?.trim() ?? '';
  if (message === '' || message.length > MAX_MESSAGE_LENGTH) return 'message';
  const fileName = text('fileName') ?? '';
  if (!FILE_NAME_PATTERN.test(fileName)) return 'fileName';
  const pdfBase64 = text('pdfBase64') ?? '';
  if (
    pdfBase64.length > MAX_PDF_BASE64_LENGTH ||
    !pdfBase64.startsWith(PDF_BASE64_PREFIX) ||
    !BASE64_PATTERN.test(pdfBase64)
  ) {
    return 'pdfBase64';
  }
  return { to, subject, message, fileName, pdfBase64 };
}

/** A display name is shown in the recipient's inbox; keep it short and free of address syntax. */
function toSenderName(businessName: string): string {
  const cleaned = businessName.replace(/[<>"\\\r\n@]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned === '' ? 'Libreng Invoice' : `${cleaned} via Libreng Invoice`;
}

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return fail(request, 405, 'METHOD_NOT_ALLOWED', 'Use POST.', requestId);

  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  const senderAddress = Deno.env.get('EMAIL_SENDER_ADDRESS');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!brevoApiKey || !senderAddress || !supabaseUrl || !supabaseAnonKey || allowedOrigins.length === 0) {
    console.error(`[${requestId}] Missing configuration: BREVO_API_KEY, EMAIL_SENDER_ADDRESS or ALLOWED_ORIGINS`);
    return fail(request, 503, 'NOT_CONFIGURED', 'Sending email is not set up yet.', requestId);
  }

  // Who is asking? The database client below acts as this user, so row security applies.
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return fail(request, 401, 'UNAUTHENTICATED', 'Sign in to send email.', requestId);
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(authorization.slice('Bearer '.length));
  const user = userData?.user;
  if (userError || !user || !user.email) {
    return fail(request, 401, 'UNAUTHENTICATED', 'Sign in to send email.', requestId);
  }
  if (!user.email_confirmed_at) {
    return fail(request, 403, 'EMAIL_NOT_CONFIRMED', 'Confirm your email address before sending email.', requestId);
  }

  // Validate the request before spending any of the daily allowance on it.
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) {
    return fail(request, 400, 'INVALID_REQUEST', 'The PDF is too large to email.', requestId);
  }
  let rawBody: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new Error('too large');
    rawBody = JSON.parse(text);
  } catch {
    return fail(request, 400, 'INVALID_REQUEST', 'The request could not be read.', requestId);
  }
  const parsed = parseRequest(rawBody);
  if (typeof parsed === 'string') {
    return fail(request, 400, 'INVALID_REQUEST', `Please check: ${parsed}.`, requestId);
  }

  // The business name comes from the seller's saved profile, not from the request.
  const { data: profile } = await client.from('business_profiles').select('name').maybeSingle();
  const businessName = typeof profile?.name === 'string' ? profile.name.trim() : '';

  // Count this send. The database refuses when a daily limit is reached.
  const { error: quotaError } = await client.rpc('register_email_send');
  if (quotaError) {
    if (quotaError.code === 'PT429') {
      return fail(request, 429, 'RATE_LIMITED', 'The daily email limit has been reached. Try again tomorrow.', requestId);
    }
    if (quotaError.code === 'PT403') {
      return fail(request, 403, 'EMAIL_NOT_CONFIRMED', 'Confirm your email address before sending email.', requestId);
    }
    console.error(`[${requestId}] register_email_send failed: ${quotaError.code} ${quotaError.message}`);
    return fail(request, 503, 'NOT_CONFIGURED', 'Sending email is not set up yet.', requestId);
  }

  const footer = `\n\n--\nSent by ${businessName || user.email} using Libreng Invoice. Reply to this email to reach them.`;
  let brevoResponse: Response;
  try {
    brevoResponse = await fetch(BREVO_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: toSenderName(businessName), email: senderAddress },
        to: [{ email: parsed.to }],
        cc: parsed.to.toLowerCase() === user.email.toLowerCase() ? undefined : [{ email: user.email }],
        replyTo: { email: user.email },
        subject: parsed.subject,
        textContent: parsed.message + footer,
        attachment: [{ name: parsed.fileName, content: parsed.pdfBase64 }],
      }),
    });
  } catch (error) {
    console.error(`[${requestId}] Brevo request failed: ${error instanceof Error ? error.name : 'unknown'}`);
    return fail(request, 502, 'EMAIL_PROVIDER_FAILED', 'The email could not be sent. Please try again.', requestId);
  }
  if (!brevoResponse.ok) {
    // Brevo's reply can echo addresses; log only its status and error code.
    const detail = await brevoResponse.json().catch(() => null);
    console.error(`[${requestId}] Brevo refused: ${brevoResponse.status} ${detail?.code ?? ''}`);
    return fail(request, 502, 'EMAIL_PROVIDER_FAILED', 'The email could not be sent. Please try again.', requestId);
  }

  console.log(`[${requestId}] Email sent for user ${user.id}`);
  return respond(request, 200, { status: 'success', data: { copySentTo: user.email }, message: 'Email sent.' });
});
