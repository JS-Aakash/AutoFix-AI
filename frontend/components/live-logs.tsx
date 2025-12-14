"use client";

import { useEffect, useState, useRef } from "react";
import { Terminal, CheckCircle2, XCircle, Loader2, ExternalLink, ArrowLeft } from "lucide-react";

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
}

interface LiveLogsProps {
    jobId?: string;
    directStreamConfig?: {
        issueUrl: string;
        repoUrl: string;
        githubToken: string;
        openaiKey: string;
    };
    onBack?: () => void;
}

export function LiveLogs({ jobId, directStreamConfig, onBack }: LiveLogsProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<string>("RUNNING");
    const [prUrl, setPrUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState("Initializing");
    const logsEndRef = useRef<HTMLDivElement>(null);

    const handleLogData = (data: any) => {
        if (data.status) {
            setStatus(data.status);
            if (data.status === "SUCCESS") {
                setProgress(100);
                setCurrentStep("Completed!");
                if (data.prUrl) setPrUrl(data.prUrl);
            } else if (data.status === "FAILED") {
                setCurrentStep("Failed");
            }
        }

        if (data.message) {
            const shouldSkip =
                data.message.includes('Docker not found or not running') ||
                data.message.includes('Falling back to local execution') ||
                data.message.includes('Running agent locally');

            if (!shouldSkip) {
                setLogs((prev) => [...prev, data]);

                // Update progress based on workflow stages
                const msg = data.message.toLowerCase();
                if (msg.includes('starting') || msg.includes('fetching issue')) {
                    setProgress(prev => Math.max(prev, 10));
                    setCurrentStep("Fetching issue details");
                } else if (msg.includes('cloning') || msg.includes('repository')) {
                    setProgress(prev => Math.max(prev, 20));
                    setCurrentStep("Cloning repository");
                } else if (msg.includes('creating branch')) {
                    setProgress(prev => Math.max(prev, 30));
                    setCurrentStep("Creating fix branch");
                } else if (msg.includes('running') && msg.includes('agent')) {
                    setProgress(prev => Math.max(prev, 40));
                    setCurrentStep("Analyzing code with AI");
                } else if (msg.includes('calling ai') || msg.includes('attempt')) {
                    setProgress(prev => Math.max(prev, 50));
                    setCurrentStep("Generating fix");
                } else if (msg.includes('validated') || msg.includes('patch')) {
                    setProgress(prev => Math.max(prev, 70));
                    setCurrentStep("Applying changes");
                } else if (msg.includes('applying') || msg.includes('commit')) {
                    setProgress(prev => Math.max(prev, 80));
                    setCurrentStep("Committing changes");
                } else if (msg.includes('pushing') || msg.includes('creating pr')) {
                    setProgress(prev => Math.max(prev, 90));
                    setCurrentStep("Creating pull request");
                } else if (msg.includes('pr created') || msg.includes('done')) {
                    setProgress(100);
                    setCurrentStep("Completed!");
                }

                // Extract PR URL from logs
                if (data.message.includes('https://github.com') && data.message.includes('/pull/')) {
                    const match = data.message.match(/(https:\/\/github\.com\/[^\s]+\/pull\/\d+)/);
                    if (match) {
                        setPrUrl(match[1]);
                    }
                }
            }
        }
    };

    useEffect(() => {
        // Mode 1: Direct Stream
        if (directStreamConfig) {
            const controller = new AbortController();
            const startStream = async () => {
                try {
                    const response = await fetch('/api/autofix', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(directStreamConfig),
                        signal: controller.signal
                    });

                    if (!response.body) throw new Error("No response body");

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.trim().startsWith('data: ')) {
                                try {
                                    const jsonStr = line.trim().slice(6);
                                    const data = JSON.parse(jsonStr);
                                    handleLogData(data);
                                } catch (e) { console.error('Parse error', e); }
                            }
                        }
                    }
                } catch (e: any) {
                    if (e.name !== 'AbortError') {
                        handleLogData({ message: `Connection Error: ${e.message}`, level: 'error', status: 'FAILED' });
                    }
                }
            };
            startStream();
            return () => controller.abort();
        }

        // Mode 2: Legacy Kestra
        if (jobId && !directStreamConfig) {
            const eventSource = new EventSource(`/api/fix/${jobId}/logs`);

            eventSource.onmessage = (event) => {
                try {
                    if (!event.data) return;
                    handleLogData(JSON.parse(event.data));
                } catch (e) { }
            };

            eventSource.onerror = () => {
                // handle error
            };

            return () => {
                eventSource.close();
            };
        }
    }, [jobId, directStreamConfig]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const getMessageColor = (message: string, level: string) => {
        if (message.includes('✅') || message.includes('success') || message.includes('completed')) {
            return "text-green-400";
        }
        if (message.includes('❌') || message.includes('failed') || message.includes('error')) {
            return "text-red-400";
        }
        if (message.includes('⚠️') || message.includes('warning')) {
            return "text-yellow-400";
        }
        if (message.includes('🚀') || message.includes('Starting')) {
            return "text-blue-400";
        }
        return "text-gray-300";
    };

    const getStatusIcon = () => {
        switch (status) {
            case "SUCCESS":
                return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case "FAILED":
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case "SUCCESS": return "border-green-500/50 bg-green-900/20";
            case "FAILED": return "border-red-500/50 bg-red-900/20";
            default: return "border-blue-500/50 bg-blue-900/20";
        }
    };

    return (
        <div className="space-y-4">
            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Issues</span>
                </button>
            )}

            {/* Progress Bar */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        {getStatusIcon()}
                        <div>
                            <p className="font-semibold text-white text-lg">{currentStep}</p>
                            <p className="text-sm text-gray-400">Step {Math.ceil(progress / 10)} of 10</p>
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">{progress}%</div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="w-full h-full bg-gradient-to-r from-transparent to-white/20 animate-pulse"></div>
                    </div>
                </div>
            </div>

            {/* Status Banner */}
            <div className={`p-4 rounded-xl border ${getStatusColor()} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                    {getStatusIcon()}
                    <div>
                        <p className="font-semibold text-white">
                            {status === "RUNNING" && "AI is working on your fix..."}
                            {status === "SUCCESS" && "Fix completed successfully!"}
                            {status === "FAILED" && "Fix failed"}
                            {!["RUNNING", "SUCCESS", "FAILED"].includes(status) && `Status: ${status}`}
                        </p>
                        <p className="text-sm text-gray-400">Execution ID: {jobId}</p>
                    </div>
                </div>

                {prUrl && (
                    <a
                        href={prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
                    >
                        <span>View Pull Request</span>
                        <ExternalLink className="w-4 h-4" />
                    </a>
                )}
            </div>

            {/* Terminal Window */}
            <div className="bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                {/* Terminal Header */}
                <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <Terminal className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-mono text-gray-500">autofix-terminal</span>
                    </div>
                </div>

                {/* Terminal Content */}
                <div className="h-[400px] overflow-y-auto p-4 font-mono text-sm custom-scrollbar">
                    {logs.length === 0 ? (
                        <div className="flex items-center gap-2 text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Waiting for logs...</span>
                        </div>
                    ) : (
                        logs.map((log, idx) => (
                            <div key={idx} className="mb-1 flex gap-3 hover:bg-gray-900/50 px-2 py-1 rounded">
                                <span className="text-gray-600 flex-shrink-0 text-xs">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className={`break-all ${getMessageColor(log.message, log.level)}`}>
                                    {log.message}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>

                {/* Terminal Footer */}
                <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{logs.length} log entries</span>
                    <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${status === "RUNNING" ? "bg-green-500 animate-pulse" : "bg-gray-700"}`}></span>
                        {status === "RUNNING" ? "Live" : "Completed"}
                    </span>
                </div>
            </div>
        </div>
    );
}
