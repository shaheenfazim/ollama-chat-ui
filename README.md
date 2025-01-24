# Ollama Chat UI

A web interface for Ollama, providing a user-friendly way to interact with local language models.

## Prerequisites

- **Ollama Installation**: Make sure Ollama is installed on your system. You can download it from the [official Ollama website](https://ollama.com/).

- **Modern Browser**: Use a modern browser with IndexedDB support for storage.

## Steps to Run

### Option 1: Local Server

1. **Clone the repository from GitHub.**

2. **Run the Ollama server**:
     ```bash
     ollama serve
     ```

3. **Start a simple HTTP server in the same directory as `index.html`.**:
     ```bash
     python3 -m http.server 8080
     ```

### Option 2: Remote Server

1. **Host the Project Files**:
   - Upload the repository files to a hosting service or server (e.g., `https://ollama-x.web.app`).

2. **Start the Ollama Server**:
   - Set the `OLLAMA_ORIGINS` environment variable to allow the hosted site to communicate with the server:
     - **Windows**:
       ```powershell
       $env:OLLAMA_ORIGINS="https://ollama-x.web.app"
       ```
     - **macOS**:
       ```bash
       launchctl setenv OLLAMA_ORIGINS "https://ollama-x.web.app"
       ```
     - **Linux**:
       ```bash
       export OLLAMA_ORIGINS="https://ollama-x.web.app"
       ```
   - Run the Ollama server:
     ```bash
     ollama serve
     ```
**Visit your local server (`http://localhost:8080`) or hosted site (e.g., `https://ollama-x.web.app`) in your browser and select a model to start the chat.**

----
<img width="1280" alt="image" src="https://github.com/user-attachments/assets/c9bebf5a-a845-4610-abf4-926e1f44d2c9" />
