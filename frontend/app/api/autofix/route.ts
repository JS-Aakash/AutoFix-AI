import { NextRequest, NextResponse } from 'next/server';
import { runAutofix } from '@/lib/autofix-service';

export const maxDuration = 300; // 5 minutes timeout for Vercel Pro
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const { issueUrl, repoUrl, githubToken, openaiKey } = await req.json();

    if (!issueUrl || !repoUrl || !githubToken) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendLog = (data: any) => {
                try {
                    const msg = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(msg));
                } catch (e) {
                    // Controller might be closed
                }
            };

            try {
                sendLog({
                    message: "Initializing AutoFix Agent...",
                    level: "info",
                    timestamp: new Date().toISOString(),
                    status: "RUNNING"
                });

                const result = await runAutofix({
                    issueUrl,
                    repoUrl,
                    githubToken,
                    openaiKey: openaiKey || process.env.OPENAI_API_KEY || '',
                    onLog: (msg, level) => {
                        sendLog({
                            message: msg,
                            level: level || 'info',
                            timestamp: new Date().toISOString(),
                            status: "RUNNING"
                        });
                    }
                });

                sendLog({
                    message: `Autofix completed successfully. PR: ${result.prUrl}`,
                    level: "success",
                    timestamp: new Date().toISOString(),
                    status: "SUCCESS",
                    prUrl: result.prUrl
                });

            } catch (e: any) {
                sendLog({
                    message: e.message || "Unknown error occurred",
                    level: "error",
                    timestamp: new Date().toISOString(),
                    status: "FAILED"
                });
            } finally {
                // Close the stream
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
