"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
function activate(context) {
    const gooseViewProvider = new GooseViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("gooseView", gooseViewProvider));
}
class GooseViewProvider {
    _extensionUri;
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Add the message listener here
        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.command === "playHonk") {
                this.playAudioWithFfplay("honk1.mp3");
            }
            else if (message.command === "playDialogSound") {
                const soundFile = `dialog/Fast_Complete_v${message.soundNumber}_wav.wav`;
                this.playAudioWithFfplay(soundFile, 20);
            }
        });
        this.playAudioWithFfplay("squawk1.mp3");
    }
    playAudioWithFfplay(fileName, volume = 100) {
        const audioPath = path.join(this._extensionUri.fsPath, "assets", fileName);
        (0, child_process_1.exec)(`ffplay -nodisp -autoexit -volume ${volume} "${audioPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("Error playing audio with ffplay:", error);
                return;
            }
            console.log("Audio playback complete:", stdout || stderr);
        });
    }
    _getHtmlForWebview(webview) {
        const imagePath = vscode.Uri.joinPath(this._extensionUri, "assets", "goose.png");
        const imageUri = webview.asWebviewUri(imagePath);
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                padding: 10px;
                font-family: var(--vscode-editor-font-family), sans-serif;
                font-size: var(--vscode-editor-font-size);
            }
            .title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 20px;
                color: var(--vscode-editor-foreground);
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
            button {
                margin: 5px;
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                border: none;
                border-radius: 4px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
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
        <script>
            const dialogText = "🪿 Honk! Are we adding something shiny and new, or chasing down a sneaky bug? And where in this messy nest of code are we poking today?";
            const dialogElement = document.getElementById("dialog");
            const buttonContainer = document.getElementById("buttonContainer");
            const vscode = acquireVsCodeApi();
            let typingTimeout; // Store the timeout ID
            let index = 0;

            function typeDialog(text, callback) {
                if (typingTimeout) {
                    clearTimeout(typingTimeout); // Stop any ongoing typing effect
                }
                dialogElement.textContent = ""; // Clear existing text
                index = 0;

                function type() {
                    if (index < text.length) {
                        dialogElement.textContent += text.charAt(index);
                        index++;

                        // Play dialog sound every two characters
                        if (index % 6 === 0) {
                            const soundNumber = Math.floor(Math.random() * 4) + 1; // Random number between 1 and 4
                            vscode.postMessage({ command: "playDialogSound", soundNumber });
                        }

                        typingTimeout = setTimeout(type, 40); // Adjust typing speed here
                    } else if (callback) {
                        callback();
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
                vscode.postMessage({ command: "playHonk" });
            });

            document.getElementById("debugButton").addEventListener("click", () => {
                console.log("Debug button clicked");
            });
        </script>
    </body>
    </html>`;
    }
}
//# sourceMappingURL=extension.js.map