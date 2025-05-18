import * as vscode from "vscode";
import * as path from "path";
import {exec} from "child_process";
import {CodeExercisePanel} from "./codeExercisePanel";
import {TextEditor, TextEditorDecorationType} from "vscode";

export function activate(context: vscode.ExtensionContext) {
    const gooseViewProvider = new GooseViewProvider(context.extensionUri);
    const gooseViewProvider2 = new GooseViewProvider2(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("gooseView2", gooseViewProvider2)
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("gooseView", gooseViewProvider)
    );

    // Listen for active editor changes to update code context
    vscode.window.onDidChangeActiveTextEditor(() => {
        if (gooseViewProvider._view) {
            gooseViewProvider.updateActiveEditorCode();
        }
    });

    vscode.workspace.onDidOpenTextDocument(() => {
        if (gooseViewProvider._view) {
            gooseViewProvider.updateActiveEditorCode();
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            if (gooseViewProvider._view) {
                gooseViewProvider.updateActiveEditorCode();
            }
        })
    );

    // initial update when activated - delay to ensure _view is set
    setTimeout(() => {
        if (vscode.window.activeTextEditor && gooseViewProvider._view) {
            gooseViewProvider.updateActiveEditorCode();
        }
    }, 500);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (gooseViewProvider._view) {
            gooseViewProvider._view.webview.postMessage({command: 'advanceGooseFrame'});
        }
    });

    // Show the decoration at the cursor position
    const editor = vscode.window.activeTextEditor;
    const deco = vscode.window.createTextEditorDecorationType({
        before: {
            contentIconPath: vscode.Uri.joinPath(context.extensionUri, "assets", "goose-point.png"),
            margin: "0 0 0 -1em",
            textDecoration: "none; position: absolute; z-index: 1000; pointer-events: none;",
        }
    });
    if (editor) {
        const position = editor.selection.active;
        const range = new vscode.Range(position, position);
        editor.setDecorations(deco, [range]);
    }

    vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        const position = editor.selection.active;
        const range = new vscode.Range(position, position);
        editor.setDecorations(deco, [range]);
    });
}

class GooseViewProvider2 implements vscode.WebviewViewProvider {
    public _view?: vscode.WebviewView;

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
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const frameCount = 8;
        const frameUris = [];
        for (let i = 0; i < frameCount; i++) {
            const framePath = vscode.Uri.joinPath(
                this._extensionUri,
                "assets",
                `frame_${i}_delay-0.13s.gif`
            );
            frameUris.push(webview.asWebviewUri(framePath));
        }

        // Create a JS array of frame URIs as strings
        const frameUriStrings = frameUris.map(uri => `"${uri}"`).join(",");

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        background: #d5d4cf;
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                    }
                    .goose-frame {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        width: 64px;
                        height: 64px;
                        z-index: 1000;
                        pointer-events: none;
                        user-select: none;
                    }
                </style>
            </head>
            <body>
                <img id="goose" class="goose-frame" src="${frameUris[0]}" alt="Goose Frame" />
                <script>
                    const frameUris = [${frameUriStrings}];
                    let currentFrame = 0;
                    const gooseImg = document.getElementById('goose');
            
                    window.addEventListener('message', event => {
                        if (event.data && event.data.command === 'advanceGooseFrame') {
                            currentFrame = (currentFrame + 1) % frameUris.length;
                            gooseImg.src = frameUris[currentFrame];
                        }
                    });
                </script>
            </body>
            </html>
                `;
    }
}

class GooseViewProvider implements vscode.WebviewViewProvider {
    public _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {
    }

    // Get the current active editor's content and send it to the webview
    public updateActiveEditorCode() {
        if (!this._view) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const code = document.getText();
            const fileName = document.fileName;

            // Send the code to the webview
            this._view.webview.postMessage({
                command: 'updateEditorCode',
                code: code,
                fileName: fileName
            });
        }
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
                const soundFile = `dialog/Retro_Single_v${message.soundNumber}_wav.wav`;
                this.playAudioWithFfplay(soundFile, 20);
            } else if (message.command === "insertCodeSnippet") {
                // Get the code from the message
                const code = message.code.split("\n").slice(1, -1).join("\n");
                console.log(code);
                console.log("attempt to open code exercise panel");
                if (vscode.window.activeTextEditor) {
                    CodeExercisePanel.createOrShow(this._extensionUri, vscode.window.activeTextEditor.document.getText(), code, "Mr. Goose's Code Exercise");
                }
            }
        });

        this.playAudioWithFfplay("squawk1.mp3");
    }

    private errors: TextEditorDecorationType[] = [];

    private showErrorGoose(editor: TextEditor, lineNumber: number, characterNumber: number) {
        const decoration = vscode.window.createTextEditorDecorationType({
            before: {
                contentIconPath: vscode.Uri.joinPath(this._extensionUri, "assets", "goose-point.png"),
                margin: "0 0 0 -1em",
                textDecoration: "none; position: absolute; z-index: 1000; pointer-events: none;",
            }
        });
        const position = new vscode.Position(lineNumber, characterNumber);
        const range = new vscode.Range(position, position);
        editor.setDecorations(decoration, [range]);
        this.errors.push(decoration);
    }

    private removeErrorGoose(editor: TextEditor) {
        this.errors.forEach(decoration => {
            editor.setDecorations(decoration, []);
        });
        this.errors = [];
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
        // const imagePath2 = vscode.Uri.joinPath(this._extensionUri, "assets", "geese-line.png");
        // const imageUri2 = webview.asWebviewUri(imagePath2);
        // Goose walking

        const frameCount = 8;
        const frameUris = [];
        for (let i = 0; i < frameCount; i++) {
            const framePath = vscode.Uri.joinPath(
                this._extensionUri,
                "assets",
                `frame_${i}_delay-0.13s.gif`
            );
            frameUris.push(webview.asWebviewUri(framePath));
        }
        const bgPath = vscode.Uri.joinPath(this._extensionUri, "assets", "background.png");
        const frameUriStrings = frameUris.map(uri => `"${uri}"`).join(",");
        const bgUri = webview.asWebviewUri(bgPath);
        const imagePath2 = vscode.Uri.joinPath(this._extensionUri, "assets", "geese-line.png");
        const imageUri2 = webview.asWebviewUri(imagePath2);

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap');
            :root {
                --button-color:rgb(129, 82, 61); /* Define button color here */
            }
        
            button {
                margin: 5px;
                font-family: "Pixelify Sans", sans-serif;
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                border: none;
                border-radius: 24px;
                background-color: var(--button-color); /* Use the variable */
                color: #fcefe0;
            }
        
            button:hover {
                background-color: rgb(106, 65, 49);
            }
        
            body {
                padding: 10px;
                font-family: var(--vscode-editor-font-family), sans-serif;
                font-size: var(--vscode-editor-font-size);
                background: url('${bgUri}');
                background-size: cover;
                overflow: hidden;
                color: var(--vscode-editor-foreground); /* Ensure text color remains readable */
            }
            .frame {
                border: 3px solid #bfae82;
                border-radius: 18px;
                background: rgb(205, 152, 105);
                border-color: rgb(205, 152, 105);
                max-length: 320px;
                length: 60%;
                display: flex;
                flex-direction: column;
                align-items: center;
                margin: 20px auto 0 auto;
                }
            .title {
                font-family: "Pixelify Sans", sans-serif;
                text-align: center;
                font-size: 29px;
                font-weight: bold;
                margin-bottom: 20px;
                margin-top: 24px;
                color: var(--vscode-editor-background);
            }
            .dialog {
                font-family: "Pixelify Sans", sans-serif;
                margin-top: 12px;
                margin-bottom: 12px;
                padding: 10px;
                color: rgb(240, 240, 240);
                background-color: rgb(65, 58, 53, 0.6);
                border: 1px solid var(--vscode-editor-foreground);
                border-radius: 20px;
                font-style: italic;
                min-height: 50px;
            }
            .file-tag {
                margin-top: 5px;
                padding: 4px 8px;
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-editor-foreground);
                border-radius: 4px;
                font-size: 12px;
                display: inline-block;
                color: var(--vscode-foreground);
                opacity: 0.7;
            }
            img {
                display: block;
                margin: 20px auto;
                max-width: 100%;
                height: auto;
            }
            .button-container {
                margin-top: 0;
                display: flex;
                justify-content: center;
                gap: 16px;
                text-align: center;
                align-items: center;
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
                border-radius: 20px;
                background-color: rgb(65, 58, 53);;
                color: var(--vscode-input-foreground);
            }
            
            .submit-feature-button {
                width: 101%;
                transform: translateX(-5px);
                border-radius: 20px;
            }
            
            .code-snippet {
                background-color: rgb(65, 58, 53);
                color: rgb(240, 240, 240);
                padding: 2px 4px;
                border-radius: 4px;
                font-family: "JetBrains Mono", monospace;
                font-size: 14px;
                font-style: normal;
                display: inline-block;
            }
            
            .mrgoose {
                cursor: pointer; 
                transition: transform 0.2s ease-in-out;
            }
            
            .mrgoose:hover {
                transform: scale(1.1);
                transition: transform 0.2s ease-in-out;
            }
            
            .geese-line {
                display: flex;
                justify-content: center;
                align-items: end;
                position: fixed;
                bottom: 0;
                left: 0;
                height: auto;
                z-index: -1; /* Ensure it stays behind other elements */
                pointer-events: none;
            }
            
            .walking-geese-big {
                width: 150px;
                height: 150px;
                margin: 0 5px;
                transform: scale(-1, 1); /* Flip the image */
            }
            
            .walking-geese-small {
                width: 100px;
                height: 100px;
                margin: 0 5px;
                transform: scale(-1, 1); /* Flip the image */
            }
        </style>
        <title>Mr. Goose</title>
    </head>
    <body>
        <div class="frame">
            <div class="title">Mr. Goose</div>
            <img id="mrgoose" class="mrgoose" src="${imageUri}" alt="Mr. Goose" />
        </div>
        <div class="file-tag" id="fileTag"></div>
        <div class="dialog" id="dialog"></div>
        <div class="button-container" id="buttonContainer">
            <button id="addFeatureButton">Add New Feature</button>
            <button id="debugButton">Debug</button>
        </div>
        <div class="input-container" id="inputContainer" style="display: none;">
            <textarea class="input-container-input" id="featureInput" placeholder="Describe your feature..."></textarea>
            <button class="submit-feature-button" id="submitFeatureButton">Submit</button>
        </div>
        <div class="geese-line">
            <img id="goose-big" class="walking-geese-big" src="${frameUris[0]}" alt="Walking goose"/>
            <img id="goose-small-1" class="walking-geese-small" src="${frameUris[0]}" alt="Walking goose"/>
            <img id="goose-small-2" class="walking-geese-small" src="${frameUris[0]}" alt="Walking goose"/>
            <img id="goose-small-3" class="walking-geese-small" src="${frameUris[0]}" alt="Walking goose"/>
        </div>
        <script>
            const frameUris = [${frameUriStrings}];
            let currentFrame = 0;
            const gooseIds = ["goose-big", "goose-small-1", "goose-small-2", "goose-small-3"];
            const geese = gooseIds.map(id => document.getElementById(id));

            window.addEventListener('message', event => {
                if (event.data && event.data.command === 'advanceGooseFrame') {
                    currentFrame = (currentFrame + 1) % frameUris.length;
                    geese.forEach(goose => {
                        goose.src = frameUris[currentFrame];
                    });
                }
                console.log(event.data);
            });
        
            const dialogText = "🪿 Honk! Are we adding something shiny and new, or chasing down a sneaky bug? And where in this messy nest of code are we poking today?";
            const dialogElement = document.getElementById("dialog");
            const fileTagElement = document.getElementById("fileTag");
            const buttonContainer = document.getElementById("buttonContainer");
            const gooseImage = document.querySelector("img");
            const vscode = acquireVsCodeApi();
            const serverURL = "ws://localhost:3000";
            const helpSocket = new WebSocket(serverURL + "/help");
            
            let typingTimeout; // Store the timeout ID
            let index = 0;
            let isDialogPlaying = false; // Track if dialog is playing
            let currentEditorCode = ""; // Store current editor code
            let currentFileName = "";   // Store current file name
            let insideCodeSnippet = false;
            
            // Listen for editor code updates from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                if (message.command === 'updateEditorCode') {
                    currentEditorCode = message.code;
                    currentFileName = message.fileName;
                    fileTagElement.textContent = currentFileName; // Update file tag
                    console.log("Received editor code for:", currentFileName);
                }
            });
            
            function typeDialog(text, callback) {
                if (typingTimeout) {
                    clearTimeout(typingTimeout); // Stop any ongoing typing effect
                }
                index = 0;
                dialogElement.textContent = ""; // Clear previous text
                dialogElement.innerHTML = ""; // Also clear HTML content
                isDialogPlaying = true;
                gooseImage.src = gooseImage.src.replace("goose_closed.png", "goose_animated.gif"); // Show animated GIF
                
                function type() {
                    if (index < text.length) {
                        const char = text.charAt(index);
                        if (char + text.charAt(index + 1) === "🆕") {
                            if (insideCodeSnippet) {
                                dialogElement.innerHTML = dialogElement.innerHTML.substring(0, dialogElement.innerHTML.length - 7) + "<br>" + "</span>";
                            } else {
                                dialogElement.innerHTML += "<br>";
                            }
                            index++;
                        }  else if (char === "\`" && text.charAt(index + 1) === "\`" && text.charAt(index + 2) === "\`") {
                            if (insideCodeSnippet) {
                                insideCodeSnippet = false;
                            } else {
                                dialogElement.innerHTML += "<br>";
                                // Add a span with a class for styling
                                dialogElement.innerHTML += '<span class="code-snippet"></span>';
                                insideCodeSnippet = true;   
                            }
                            index += 2;
                        } else {
                            if (insideCodeSnippet) {
                                dialogElement.innerHTML = dialogElement.innerHTML.substring(0, dialogElement.innerHTML.length - 7) + char + "</span>";
                            } else {
                                dialogElement.innerHTML += char;
                            }
                        }
                        index++;
                                    
                        if (index % 3 === 0) {
                            const soundNumber = 1;
                            vscode.postMessage({ command: "playDialogSound", soundNumber });
                        }
            
                        typingTimeout = setTimeout(type, 20); // Adjust typing speed here
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
            
            function appendToDialog(newText, callback) {
                let index = 0;
                const startLength = dialogElement.innerHTML.length;
            
                function type() {
                    if (index < newText.length) {
                        const char = newText.charAt(index);
                        if (char + newText.charAt(index + 1) === "🆕") {
                            if (insideCodeSnippet) {
                                dialogElement.innerHTML = dialogElement.innerHTML.substring(0, dialogElement.innerHTML.length - 7) + "<br>" + "</span>";
                            } else {
                                dialogElement.innerHTML += "<br>";
                            }
                            index++;
                        } else if (char === "\`" && newText.charAt(index + 1) === "\`" && newText.charAt(index + 2) === "\`") {
                            if (insideCodeSnippet) {
                                insideCodeSnippet = false;
                            } else {
                                dialogElement.innerHTML += "<br>";
                                // Add a span with a class for styling
                                dialogElement.innerHTML += '<span class="code-snippet"></span>';
                                insideCodeSnippet = true;   
                            }
                            index += 2;
                        } else {
                            if (insideCodeSnippet) {
                                dialogElement.innerHTML = dialogElement.innerHTML.substring(0, dialogElement.innerHTML.length - 7) + char + "</span>";
                            } else {
                                dialogElement.innerHTML += char;
                            }
                        }
                        index++;
                        if ((startLength + index) % 3 === 0) {
                            vscode.postMessage({ command: "playDialogSound", soundNumber: 1 });
                        }
                        typingTimeout = setTimeout(type, 20);
                    } else {
                        isDialogPlaying = false;
                        gooseImage.src = gooseImage.src.replace("goose_animated.gif", "goose_closed.png");
                        if (callback){callback();
}
                    }
                }
                gooseImage.src = gooseImage.src.replace("goose_closed.png", "goose_animated.gif");
                isDialogPlaying = true;
                type();
            }
            
            // Handle streamed responses better
            function handleStreamedResponse() {
                let responseBuffer = "";
                let isFirstMessage = true;

                let isCodeSnippet = false;
                const codeSnippetMarker = "💎";
                let codeSnippet = "";
                
                let codeInsertion = false;
                let codeInsert = "";
                
                helpSocket.onmessage = function(event) {
                    const data = event.data;
                    
                    // Handle stream start marker
                    if (data === "Startstreaming") {
                        console.log("Stream started");
                        responseBuffer = "";
                        dialogElement.textContent = "";
                        return;
                    }
                    
                    // Handle stream end marker
                    else if (data === "Endstreaming") {
                        console.log("Stream ended");
                        if (codeInsertion){
                            console.log("try code insert");
                            vscode.postMessage({ command: "insertCodeSnippet", code: codeInsert });
                        }
                        return;
                    }
                    
                    if(data === "codeinsertion" || codeInsertion) {
                        if(codeInsertion){
                            console.log("code insertion");
                            codeInsert += data;
                        }
                        codeInsertion = true;
                        return;
                    }
                    
                    if (responseBuffer === "") {
                        dialogElement.textContent = "";
                        responseBuffer = data;
                        typeDialog(responseBuffer);
                    } else {

                        if (data.includes(codeSnippetMarker)) {
                            isCodeSnippet = !isCodeSnippet;
                            if (!isCodeSnippet) {
                                if (!data.startsWith(codeSnippetMarker)) {
                                    codeSnippet += data.split(codeSnippetMarker)[0];
                                }
                                vscode.postMessage({ command: "insertCodeSnippet", code: codeSnippet });
                                return;
                            } else if(!data.endsWith(codeSnippetMarker)){
                                codeSnippet += data.split(codeSnippetMarker).last();
                            }
                        } else if(isCodeSnippet){
                            codeSnippet += data;
                            return;
                        }
                        
                        // Append to buffer and update the dialog text
                        responseBuffer += data;
                        console.log(responseBuffer);
                        
                        // Stop current typing
                        if (typingTimeout) {
                            clearTimeout(typingTimeout);
                        }
                        
                        // Start new typing with updated text
                        if (isFirstMessage) {
                            dialogElement.textContent = "";
                            isFirstMessage = false;
                            typeDialog(responseBuffer);
                        } else {
                            // Get the text that still needs to be typed
                            const difference = responseBuffer.substring(dialogElement.textContent.length);
                            appendToDialog(difference);
                        }
                        
                    }
                };
            }
            
            // Start typing effect
            setTimeout(() => typeDialog(dialogText), 500);
            
            // Button click handlers
            document.getElementById("addFeatureButton").addEventListener("click", () => {
                typeDialog("🪿 Honk! What shiny idea are we hatching today? What should it do when it flaps to life?");
                buttonContainer.style.display = "none"; // Hide buttons
                document.getElementById("inputContainer").style.display = "block"; // Show input box
                // Play a random honk sound
                vscode.postMessage({ command: "playHonk", honkFile: \`honk${Math.floor(Math.random() * 3) + 1}.mp3\` });
            });
            
            document.getElementById("mrgoose").addEventListener("click", () => {
                vscode.postMessage({ command: "playHonk", honkFile: \`honk${Math.floor(Math.random() * 3) + 1}.mp3\` });
            });
            
            document.getElementById("submitFeatureButton").addEventListener("click", () => {
                const featureInput = document.getElementById("featureInput").value;
                if (featureInput.trim() !== "") {
                    helpSocket.send(JSON.stringify({ message: featureInput, code: currentEditorCode }));
                    document.getElementById("featureInput").value = "";
                    dialogElement.textContent = "";
                    handleStreamedResponse();
                    // document.getElementById("inputContainer").style.display = "none"; // Hide input box
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

