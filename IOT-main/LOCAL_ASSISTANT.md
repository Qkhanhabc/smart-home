# Local website assistant

The website assistant uses Ollama on the same computer as the Node backend. Sensor readings, recent anomaly events, and current device states are sent only to the local Ollama service at `127.0.0.1:11434`; the assistant route does not call OpenAI or other hosted model APIs. Chat messages are kept in browser memory for the current tab and are not written to MongoDB. The assistant has no device-control tools.

## First-time setup on Windows

1. Install Ollama from [ollama.com/download/windows](https://ollama.com/download/windows) and start the Ollama app.
2. Open PowerShell and download the configured model:

   ```powershell
   ollama pull qwen2.5:3b
   ```

3. Optionally set `OLLAMA_MODEL=qwen2.5:3b` in `.env`. This is the backend default when the variable is unset.
4. Start or restart the Node backend, sign in to the website, and open the floating assistant at the lower right.

The first response can take longer while the model loads. Change `OLLAMA_MODEL` to another model installed in Ollama if this model does not fit the computer's available memory. The backend does not download models automatically.

## Data scope

For each question, the backend provides the model with the latest stored sensor sample, summaries of up to 30 recent samples, up to 10 recent individual samples, the latest five anomaly events from the last seven days, and current fan/AC/light states. It does not include account credentials, email, or password data. The request is limited to 12 messages and 1,200 characters per message, with a per-account rate limit. Questions are answered from that context; the model cannot send control commands.

If the assistant reports that Ollama is unavailable, make sure the Ollama app is running and that the configured model has been pulled.
