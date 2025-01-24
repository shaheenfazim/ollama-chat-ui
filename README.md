# Ollama Chat UI

A modern web interface for Ollama, providing a user-friendly way to interact with local language models.

## Prerequisites

- **Ollama Installation**: Ensure that Ollama is installed on your system. You can download it from the [official Ollama website](https://ollama.ai/).

- **Modern Browser**: Use a modern browser with IndexedDB support for storage.

## Steps to Run

### Option 1: Local Deployment

1. **Download the Repository**: Clone or download the GitHub repository to your local machine.

2. **Start a Simple Python Server**:

   - Open a terminal and navigate to the directory containing `index.html`.

   - Run the following command to start a simple HTTP server:

     ```bash
     python3 -m http.server 8080
     ```

   - Access the application by visiting `http://localhost:8080` in your browser.

### Option 2: Remote Hosting

1. **Host Files on a Remote Server**:

   - Upload the project files to a remote server or a hosting platform (e.g., `https://ollama-x.web.app`).

2. **Configure Environment Variable**:

   - Set the `OLLAMA_ORIGINS` environment variable to allow the hosted site to communicate with the Ollama server.

   - Use the appropriate command for your operating system:

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

3. **Start the Ollama Server**:

   - Run the following command to start the Ollama server:

     ```bash
     ollama serve
     ```

4. **Access the Application**:

   - Visit your hosted site (e.g., `https://ollama-x.web.app`) in your browser.

   - Select your desired model to begin the chat.
