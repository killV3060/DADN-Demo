import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Sparkles } from "lucide-react";
import { useSendCommand } from "@workspace/api-client-react";
import { GlassCard } from "@/components/ui/glass-card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface VoiceControlProps {
  scopeLabel?: string;
}

interface VoiceCommandMatch {
  command: string;
  label: string;
  phrase: string;
}

const COMMAND_LABELS: Record<string, string> = {
  "1": "Mở servo",
  "2": "Tắt servo",
  "3": "Mở led",
  "4": "Tắt led",
  "5": "Bật quạt 33%",
  "6": "Bật quạt 66%",
  "7": "Bật quạt max",
  "8": "Tắt quạt",
  "9": "Mở rgb",
  "10": "Tắt rgb",
};

const QUICK_HELP = [
  { phrase: "mở servo", command: "1" },
  { phrase: "tắt servo", command: "2" },
  { phrase: "mở led", command: "3" },
  { phrase: "tắt led", command: "4" },
  { phrase: "bật quạt", command: "6" },
  { phrase: "tắt quạt", command: "8" },
  { phrase: "mở rgb", command: "9" },
  { phrase: "tắt rgb", command: "10" },
];

function normalizeSpeechText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\blet\b/g, "led")
    .replace(/\bleds\b/g, "led")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function resolveVoiceCommand(transcript: string): VoiceCommandMatch | null {
  const normalized = normalizeSpeechText(transcript);

  const rules: Array<{ phrases: string[]; command: string; label: string }> = [
    { phrases: ["tat servo", "dong servo"], command: "2", label: COMMAND_LABELS["2"] },
    { phrases: ["mo servo", "bat servo"], command: "1", label: COMMAND_LABELS["1"] },
    { phrases: ["tat led", "dong led", "tat den led", "dong den led"], command: "4", label: COMMAND_LABELS["4"] },
    { phrases: ["mo led", "bat led", "mo den led", "bat den led"], command: "3", label: COMMAND_LABELS["3"] },
    { phrases: ["tat rgb", "dong rgb"], command: "10", label: COMMAND_LABELS["10"] },
    { phrases: ["mo rgb", "bat rgb"], command: "9", label: COMMAND_LABELS["9"] },
    { phrases: ["tat quat", "dong quat", "ngat quat"], command: "8", label: COMMAND_LABELS["8"] },
    { phrases: ["bat quat 33", "quat yeu"], command: "5", label: COMMAND_LABELS["5"] },
    { phrases: ["bat quat 66", "quat vua", "quat trung binh"], command: "6", label: COMMAND_LABELS["6"] },
    { phrases: ["bat quat max", "quat manh", "quat toi da"], command: "7", label: COMMAND_LABELS["7"] },
    { phrases: ["bat quat", "mo quat"], command: "6", label: COMMAND_LABELS["6"] },
  ];

  for (const rule of rules) {
    if (rule.phrases.some((phrase) => normalized.includes(phrase))) {
      return {
        command: rule.command,
        label: rule.label,
        phrase: transcript,
      };
    }
  }

  return null;
}

export default function VoiceControl({ scopeLabel }: VoiceControlProps) {
  const { toast } = useToast();
  const { mutate: sendCommand, isPending } = useSendCommand({
    mutation: {
      onSuccess: (_data: unknown, variables: { data: { command: string } }) => {
        const cmd = variables.data.command;
        toast({
          title: "Lệnh đã được gửi",
          description: `${COMMAND_LABELS[cmd] ?? `Command ${cmd}`}`,
        });
      },
      onError: (error: unknown) => {
        toast({
          variant: "destructive",
          title: "Không gửi được lệnh",
          description: (error as { error?: string })?.error || "Không thể kết nối tới backend",
        });
      },
    },
  });

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Nhấn bắt đầu để nói lệnh tiếng Việt.");
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [lastCommand, setLastCommand] = useState<VoiceCommandMatch | null>(null);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      setIsSupported(false);
      setStatusMessage("Trình duyệt hiện tại không hỗ trợ nhận diện giọng nói.");
      toast({
        variant: "destructive",
        title: "Speech Recognition không khả dụng",
        description: "Hãy dùng Chrome hoặc Edge trên desktop để bật voice control.",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();

      if (!transcript) {
        return;
      }

      setLastTranscript(transcript);

      const match = resolveVoiceCommand(transcript);
      if (!match) {
        setStatusMessage(`Đã nghe: ${transcript}. Chưa khớp lệnh nào.`);
        return;
      }

      setLastCommand(match);
      setStatusMessage(`Đã hiểu: ${match.label}. Đang gửi lệnh...`);
      sendCommand({ data: { command: match.command } });
    };

    recognition.onerror = (event: any) => {
      const errorCode = event?.error ?? "unknown";

      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      }

      setStatusMessage(
        errorCode === "no-speech"
          ? "Không nghe thấy câu lệnh rõ ràng, hãy thử lại."
          : `Lỗi nhận diện giọng nói: ${errorCode}`,
      );
    };

    recognition.onend = () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }

      if (!shouldKeepListeningRef.current) {
        setIsListening(false);
        return;
      }

      restartTimerRef.current = setTimeout(() => {
        try {
          recognition.start();
        } catch {
          shouldKeepListeningRef.current = false;
          setIsListening(false);
          setStatusMessage("Không thể khởi động lại microphone. Hãy bấm bắt đầu lại.");
        }
      }, 250);
    };

    recognitionRef.current = recognition;

    return () => {
      shouldKeepListeningRef.current = false;

      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }

      recognition.abort();
      recognitionRef.current = null;
    };
  }, [sendCommand, toast]);

  const startListening = () => {
    if (!isSupported) {
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setStatusMessage("Chưa khởi tạo được microphone.");
      return;
    }

    shouldKeepListeningRef.current = true;

    try {
      recognition.start();
      setIsListening(true);
      setStatusMessage("Đang nghe... nói 'mở servo', 'bật quạt', 'tắt rgb', ...");
    } catch {
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      setStatusMessage("Không thể bật microphone, hãy thử lại.");
    }
  };

  const stopListening = () => {
    shouldKeepListeningRef.current = false;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    recognitionRef.current?.stop();
    setIsListening(false);
    setStatusMessage("Đã dừng nghe.");
  };

  return (
    <GlassCard className="p-6 h-full flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl border",
              isListening
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-background/60 border-border/60 text-muted-foreground",
            )}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Voice Control</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {scopeLabel ? `Target: ${scopeLabel}` : "Target: current device"}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Nói các lệnh như “mở servo”, “tắt led”, “bật quạt”, “mở rgb” để gửi command MQTT giống như các nút điều khiển.
          </p>
        </div>

        <div className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
          isListening
            ? "border-success/30 bg-success/10 text-success"
            : "border-border/60 bg-background/50 text-muted-foreground",
        )}>
          {isListening ? <Volume2 className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span>{isListening ? "Đang nghe" : "Đã tắt"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "mt-0.5 rounded-full p-2",
            isListening ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground",
          )}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground font-semibold">Trạng thái</p>
            <p className="mt-1 text-sm text-foreground leading-6">{statusMessage}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-card/30 p-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Câu vừa nghe</p>
            <p className="mt-2 text-sm text-foreground break-words min-h-10">
              {lastTranscript || "Chưa có"}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/30 p-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Lệnh gần nhất</p>
            <p className="mt-2 text-sm text-foreground break-words min-h-10">
              {lastCommand ? `${lastCommand.label} (${lastCommand.command})` : "Chưa có"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={startListening}
          disabled={!isSupported || isListening || isPending}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all",
            "border disabled:opacity-50 disabled:cursor-not-allowed",
            isListening
              ? "border-success/40 bg-success/10 text-success"
              : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          {isPending ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Mic className="w-4 h-4" />}
          Bắt đầu nghe
        </button>

        <button
          type="button"
          onClick={stopListening}
          disabled={!isSupported || !isListening}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all",
            "border border-border/60 bg-background/50 text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <MicOff className="w-4 h-4" />
          Dừng nghe
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground font-semibold">Câu lệnh hỗ trợ</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_HELP.map((item) => (
            <div
              key={`${item.command}-${item.phrase}`}
              className="rounded-xl border border-border/50 bg-card/30 px-3 py-2.5"
            >
              <p className="text-sm font-medium text-foreground">{item.phrase}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Command {item.command} {COMMAND_LABELS[item.command] ? `- ${COMMAND_LABELS[item.command]}` : null}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Mặc định “bật quạt” sẽ gửi mức 66%. Nếu muốn thấp hơn hoặc mạnh hơn, nói rõ “quạt yếu”, “quạt vừa” hoặc “quạt mạnh”.
        </p>
      </div>

      {!isSupported && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Trình duyệt này không hỗ trợ Speech Recognition. Hãy dùng Chrome hoặc Edge trên desktop.
        </div>
      )}
    </GlassCard>
  );
}