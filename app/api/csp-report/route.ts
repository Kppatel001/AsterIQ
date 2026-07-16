export const runtime = "nodejs";
export async function POST(req: Request) { try { const b = await req.text(); if (b) console.warn("[CSP-REPORT]", b.slice(0,4000)); } catch {} return new Response(null, { status: 204 }); }
export async function OPTIONS() { return new Response(null, { status: 204 }); }
