import * as vscode from "vscode";
import * as path from "path";
import { exec } from "child_process";

export function activate(context: vscode.ExtensionContext) {
    const gooseViewProvider = new GooseViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("gooseView", gooseViewProvider)
    );
}

class GooseViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Add the message listener here
        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.command === "playHonk") {
                this.playAudioWithFfplay(message.honkFile);
            } else if (message.command === "playDialogSound") {
                const soundFile = `dialog/Fast_Complete_v${message.soundNumber}_wav.wav`;
                this.playAudioWithFfplay(soundFile, 20);
            }
        });

        this.playAudioWithFfplay("squawk1.mp3");
    }

    public playAudioWithFfplay(fileName: string, volume: number = 100) {
        const audioPath = path.join(this._extensionUri.fsPath, "assets", fileName);

        exec(`ffplay -nodisp -autoexit -volume ${volume} "${audioPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("Error playing audio with ffplay:", error);
                return;
            }
            console.log("Audio playback complete:", stdout || stderr);
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const imagePath = vscode.Uri.joinPath(this._extensionUri, "assets", "goose_animated.gif");
        const imageUri = webview.asWebviewUri(imagePath);

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            :root {
                --button-color: #9d6248; /* Define button color here */
            }
        
            button {
                margin: 5px;
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                border: none;
                border-radius: 4px;
                background-color: var(--button-color); /* Use the variable */
                color: #fcefe0;
            }
        
            button:hover {
                background-color: darkbrown; /* Optional hover effect */
            }
        
            body {
                padding: 10px;
                font-family: var(--vscode-editor-font-family), sans-serif;
                font-size: var(--vscode-editor-font-size);
                background-color: #efeada; /* Set background to white */
                color: var(--vscode-editor-foreground); /* Ensure text color remains readable */
            }
            .title {
                text-align: center;
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 20px;
                color: var(--vscode-editor-background);
            }
            .dialog {
                margin-top: 20px;
                padding: 10px;
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-editor-foreground);
                border-radius: 4px;
                font-style: italic;
                min-height: 50px;
            }
            img {
                display: block;
                margin: 20px auto;
                max-width: 100%;
                height: auto;
            }
            .button-container {
                margin-top: 20px;
                text-align: center;
            }
            
            .input-container {
                margin-top: 20px;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            
            .input-container-input {
                width: 95%;
                min-height: 60px;
                padding: 10px;
                margin-bottom: 10px;
                font-size: 16px;
                font-family: var(--vscode-editor-font-family), monospace;
                border: 1px solid var(--vscode-editor-foreground);
                border-radius: 4px;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-input-foreground);
            }
            
            .submit-feature-button {
                width: 101%;
                transform: translateX(-5px);
            }
        </style>
        <title>Mr. Goose</title>
    </head>
    <body>
        <div class="title">Mr. Goose</div>
        <img src="${imageUri}" alt="Mr. Goose" />
        <div class="dialog" id="dialog"></div>
        <div class="button-container" id="buttonContainer">
            <button id="addFeatureButton">Add New Feature</button>
            <button id="debugButton">Debug</button>
        </div>
        <div class="input-container" id="inputContainer" style="display: none;">
            <textarea class="input-container-input" id="featureInput" placeholder="Describe your feature..."></textarea>
            <button class="submit-feature-button" id="submitFeatureButton">Submit</button>
        </div>
        <script>
            const dialogText = "🪿 Honk! Are we adding something shiny and new, or chasing down a sneaky bug? And where in this messy nest of code are we poking today?";
            const dialogElement = document.getElementById("dialog");
            const buttonContainer = document.getElementById("buttonContainer");
            const gooseImage = document.querySelector("img");
            const vscode = acquireVsCodeApi();
            let typingTimeout; // Store the timeout ID
            let index = 0;
            let isDialogPlaying = false; // Track if dialog is playing
            
            function typeDialog(text, callback) {
                if (typingTimeout) {
                    clearTimeout(typingTimeout); // Stop any ongoing typing effect
                }
                dialogElement.textContent = ""; // Clear existing text
                index = 0;
                isDialogPlaying = true;
                gooseImage.src = gooseImage.src.replace("goose_closed.png", "goose_animated.gif"); // Show animated GIF
            
                function type() {
                    if (index < text.length) {
                        dialogElement.textContent += text.charAt(index);
                        index++;
            
                        // Play dialog sound every six characters
                        if (index % 6 === 0) {
                            const soundNumber = Math.floor(Math.random() * 4) + 1; // Random number between 1 and 4
                            vscode.postMessage({ command: "playDialogSound", soundNumber });
                        }
            
                        typingTimeout = setTimeout(type, 40); // Adjust typing speed here
                    } else {
                        isDialogPlaying = false;
                        gooseImage.src = gooseImage.src.replace("goose_animated.gif", "goose_closed.png"); // Show static image
                        if (callback) {
                            callback();
                        }
                    }
                }
                type();
            }
            
            // Start typing effect
            setTimeout(() => typeDialog(dialogText), 500);
            
            // Button click handlers
            document.getElementById("addFeatureButton").addEventListener("click", () => {
                typeDialog("🪿 Honk! What shiny idea are we hatching today? What should it do when it flaps to life?");
                buttonContainer.style.display = "none"; // Hide buttons
                document.getElementById("inputContainer").style.display = "block"; // Show input box
                // Play a random honk sound
                vscode.postMessage({ command: "playHonk", honkFile: \`honk${Math.floor(Math.random() * 2) + 1}.mp3\` });
            });
            
            document.getElementById("submitFeatureButton").addEventListener("click", () => {
                const featureInput = document.getElementById("featureInput").value;
                if (featureInput.trim() !== "") {
                    typeDialog(\`🪿 Honk! That sounds like a great idea. Let's get to work!\`);
                    document.getElementById("inputContainer").style.display = "none"; // Hide input box
                    vscode.postMessage({ command: "submitFeature", feature: featureInput });
                    vscode.postMessage({ command: "playHonk", honkFile: \`honk${Math.floor(Math.random() * 2) + 1}.mp3\` });
                }
            });
            
            document.getElementById("debugButton").addEventListener("click", () => {
                console.log("Debug button clicked");
            });
        </script>
    </body>
    </html>`;
    }
}