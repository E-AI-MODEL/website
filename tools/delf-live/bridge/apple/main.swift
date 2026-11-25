import Foundation
import AVFoundation
import Speech

enum LocalSpeechError: LocalizedError {
    case unavailable(String)
    var errorDescription: String? {
        switch self { case .unavailable(let message): return message }
    }
}

func emit(_ value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
    FileHandle.standardOutput.write(data + Data([10]))
}

@available(macOS 26.0, *)
func run(module: any SpeechModule, provider: String, locale: Locale, rate: Double, mode: String,
         readResults: @escaping @Sendable () async throws -> Void) async throws {
    let modules = [module]
    if mode == "--install", let request = try await AssetInventory.assetInstallationRequest(supporting: modules) {
        try await request.downloadAndInstall()
    }
    guard await AssetInventory.status(forModules: modules) == .installed else {
        throw LocalSpeechError.unavailable("Apple taalmodel ontbreekt; installeer het lokaal met --install.")
    }
    guard let source = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: rate, channels: 1, interleaved: false),
          let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: modules, considering: source),
          let converter = AVAudioConverter(from: source, to: format) else {
        throw LocalSpeechError.unavailable("Geen ondersteund lokaal audioformaat.")
    }
    if mode != "--stream" {
        emit(["type":"ready", "provider":provider, "locale":locale.identifier])
        return
    }

    let analyzer = SpeechAnalyzer(modules: modules)
    let (sequence, continuation) = AsyncThrowingStream<AnalyzerInput, Error>.makeStream(bufferingPolicy: .bufferingOldest(128))
    let results = Task { try await readResults() }
    do {
        try await analyzer.start(inputSequence: sequence)
        emit(["type":"ready", "provider":provider, "locale":locale.identifier])
        // stdin is a local pipe. No microphone permissions or recording files are needed.
        try await Task.detached {
            let input = FileHandle.standardInput
            var remaining = Data()
            while true {
                let data = input.readData(ofLength: 8192)
                if data.isEmpty { break }
                remaining.append(data)
                let count = remaining.count / 2
                guard count > 0 else { continue }
                guard let buffer = AVAudioPCMBuffer(pcmFormat: source, frameCapacity: AVAudioFrameCount(count)),
                      let channel = buffer.int16ChannelData?[0] else {
                    throw LocalSpeechError.unavailable("PCM-buffer ontbreekt.")
                }
                buffer.frameLength = AVAudioFrameCount(count)
                remaining.withUnsafeBytes { bytes in
                    if let base = bytes.baseAddress { memcpy(channel, base, count * 2) }
                }
                remaining.removeFirst(count * 2)
                let capacity = AVAudioFrameCount(ceil(Double(count) * format.sampleRate / rate) + 64)
                guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
                    throw LocalSpeechError.unavailable("Conversiebuffer ontbreekt.")
                }
                var supplied = false
                var error: NSError?
                let status = converter.convert(to: output, error: &error) { _, outStatus in
                    if supplied { outStatus.pointee = .noDataNow; return nil }
                    supplied = true; outStatus.pointee = .haveData; return buffer
                }
                if status == .error { throw error ?? NSError(domain:"EAIspeak",code:1) }
                if output.frameLength > 0 {
                    if case .dropped = continuation.yield(AnalyzerInput(buffer: output)) {
                        throw LocalSpeechError.unavailable("Apple kan de audiostroom niet bijhouden.")
                    }
                }
            }
            if !remaining.isEmpty { throw LocalSpeechError.unavailable("Onvolledig PCM-sample.") }
        }.value
        continuation.finish()
        try await analyzer.finalizeAndFinishThroughEndOfInput()
        try await results.value
        emit(["type":"end"])
    } catch {
        continuation.finish(throwing: error)
        results.cancel()
        await analyzer.cancelAndFinishNow()
        throw error
    }
}

@available(macOS 26.0, *)
func main() async throws {
    let args = CommandLine.arguments
    guard args.count == 4, ["--probe","--stream","--install"].contains(args[1]),
          let rate = Double(args[3]), rate >= 8000, rate <= 96000 else {
        throw LocalSpeechError.unavailable("Usage: eaispeak-apple --probe|--install|--stream nl-NL 48000")
    }
    let locale = Locale(identifier: args[2])
    if SpeechTranscriber.isAvailable, let supported = await SpeechTranscriber.supportedLocale(equivalentTo: locale) {
        let transcriber = SpeechTranscriber(locale: supported, preset: .progressiveTranscription)
        // Prefer the general speech model, but permit installed dictation when its assets are not ready.
        let installed = await AssetInventory.status(forModules: [transcriber]) == .installed
        if args[1] == "--install" || installed {
            try await run(module: transcriber, provider: "SpeechTranscriber", locale: supported, rate: rate, mode: args[1]) {
                for try await result in transcriber.results {
                    emit(["type":"transcript","text":String(result.text.characters),"final":result.isFinal])
                }
            }
            return
        }
    }
    if let supported = await DictationTranscriber.supportedLocale(equivalentTo: locale) {
        let transcriber = DictationTranscriber(locale: supported, preset: .progressiveLongDictation)
        try await run(module: transcriber, provider: "DictationTranscriber", locale: supported, rate: rate, mode: args[1]) {
            for try await result in transcriber.results {
                emit(["type":"transcript","text":String(result.text.characters),"final":result.isFinal])
            }
        }
        return
    }
    throw LocalSpeechError.unavailable("Geen lokaal Apple-spraakmodel voor deze taal. Gebruik Whisper of installeer het taalmodel.")
}

if #available(macOS 26.0, *) {
    do { try await main() }
    catch { emit(["type":"error","message":error.localizedDescription]); exit(1) }
} else {
    emit(["type":"error","message":"macOS 26 of nieuwer vereist."]); exit(1)
}
