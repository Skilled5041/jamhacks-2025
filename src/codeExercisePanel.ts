import vscode from "vscode";
import path from "path";
import {exec} from "child_process";

export class CodeExercisePanel {
    public static currentPanel: CodeExercisePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;

        // initial html
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

        // i think this is how you dispose idk
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case "playHonk":
                        this._playAudio(extensionUri, message.honkFile);
                        break;
                    case "playDialogSound":
                        this._playAudio(extensionUri, `dialog/Retro_Single_v${message.soundNumber}_wav.wav`, 20);
                        break;
                    case "exerciseCompleted":
                        vscode.window.showInformationMessage("Congratulations! Exercise completed successfully!");
                        this._panel.dispose();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, originalCode:string, exerciseCode: string, title: string = "Code Exercise") {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // singleton kinda style of panel
        if (CodeExercisePanel.currentPanel) {
            CodeExercisePanel.currentPanel._panel.reveal(column);
            CodeExercisePanel.currentPanel.updateExercise(exerciseCode, title);
            return;
        }

        // make new panel if not
        const panel = vscode.window.createWebviewPanel(
            'codeExercise',
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        CodeExercisePanel.currentPanel = new CodeExercisePanel(panel, extensionUri);
        CodeExercisePanel.currentPanel.updateExercise(exerciseCode, title);
    }

    private _playAudio(extensionUri: vscode.Uri, fileName: string, volume: number = 100) {
        const audioPath = path.join(extensionUri.fsPath, "assets", fileName);

        exec(`ffplay -nodisp -autoexit -volume ${volume} "${audioPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("Error playing audio with ffplay:", error);
                return;
            }
        });
    }

    public updateExercise(exerciseCode: string, title: string) {
        this._panel.webview.postMessage({
            command: 'updateExercise',
            code: exerciseCode,
            title: title
        });
    }

    public dispose() {
        CodeExercisePanel.currentPanel = undefined;

        // clean up resources
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const gooseImagePath = vscode.Uri.joinPath(extensionUri, "assets", "goose_animated.gif");
        const gooseImageUri = webview.asWebviewUri(gooseImagePath);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Exercise</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap');
        
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 0;
            margin: 0;
            background-color: #1e1e1e;
            color: #cccccc;
        }
        
        .header {
            background-color: #333333;
            padding: 16px 20px;
            border-bottom: 1px solid #444444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .title-container {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .exercise-title {
            font-family: 'Pixelify Sans', sans-serif;
            font-size: 24px;
            color: #ffffff;
            margin: 0;
        }
        
        .goose-img {
            width: 40px;
            height: 40px;
            object-fit: contain;
        }
        
        .instructions {
            margin: 20px;
            padding: 15px;
            background-color: #252525;
            border-radius: 6px;
            border-left: 4px solid #61afef;
        }
        
        .code-container {
            margin: 20px;
            background-color: #2d2d2d;
            border-radius: 8px;
            overflow: hidden;
            font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
            border: 1px solid #444444;
        }
        
        .code-content {
            padding: 16px;
            white-space: pre;
            color: #d4d4d4;
            position: relative;
            font-size: 14px;
            line-height: 1.5;
            overflow-x: auto;
        }
        
        .code-line {
            display: block;
            width: 100%;
        }
        
        .line-number {
            display: inline-block;
            width: 30px;
            color: #858585;
            text-align: right;
            padding-right: 16px;
            user-select: none;
        }
        
        .editable-input {
            background-color: rgba(97, 175, 239, 0.1);
            border: 1px solid #61afef;
            color: #61afef;
            padding: 0 4px;
            margin: 0 2px;
            display: inline-block;
            min-width: 30px;
            font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
            outline: none;
        }
        
        .button-container {
            margin: 20px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        
        button {
            font-family: 'Pixelify Sans', sans-serif;
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            background-color: #61afef;
            color: #1e1e1e;
            transition: background-color 0.2s ease;
        }
        
        button:hover {
            background-color: #4e9fe0;
        }
        
        .message {
            margin: 15px 20px;
            padding: 10px;
            border-radius: 6px;
            text-align: center;
            font-family: 'Pixelify Sans', sans-serif;
        }
        
        .success {
            background-color: rgba(152, 195, 121, 0.2);
            color: #98c379;
            border: 1px solid #98c379;
        }
        
        .error {
            background-color: rgba(224, 108, 117, 0.2);
            color: #e06c75;
            border: 1px solid #e06c75;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title-container">
            <img class="goose-img" src="${gooseImageUri}" alt="Mr. Goose">
            <h1 id="exerciseTitle" class="exercise-title">Code Exercise</h1>
        </div>
    </div>
    
    <div class="instructions">
        Fill in the blanks in the code below. You can use the Tab key to navigate between the input fields.
        When you're ready, click "Check Answer" to verify your solution.
    </div>
    
    <div id="messageContainer" class="message hidden"></div>
    
    <div class="code-container">
        <div id="codeContent" class="code-content">
            <!-- Code with fill-in-the-blank will be inserted here -->
        </div>
    </div>
    
    <div class="button-container">
        <button id="resetButton">Reset</button>
        <button id="checkAnswerButton">Check Answer</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const codeContent = document.getElementById('codeContent');
        const checkAnswerButton = document.getElementById('checkAnswerButton');
        const resetButton = document.getElementById('resetButton');
        const exerciseTitle = document.getElementById('exerciseTitle');
        const messageContainer = document.getElementById('messageContainer');
        
        let exerciseData = null; 
        
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'updateExercise') {
                displayCodeExercise(message.code, message.title || "Code Exercise");
            }
        });
        
        function displayCodeExercise(code, title) {
            exerciseTitle.textContent = title;
            
            const { processedCode, placeholders } = processFillInTheBlankCode(code);
            exerciseData = { originalCode: code, placeholders: placeholders };
            
            codeContent.innerHTML = processedCode;
            
            messageContainer.classList.add('hidden');
            
            document.querySelectorAll('.editable-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const targetInput = e.target;
                    targetInput.style.width = Math.max(30, targetInput.value.length * 8) + 'px';
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        
                        // find all editable inputs
                        const inputs = Array.from(document.querySelectorAll('.editable-input'));
                        const currentIndex = inputs.indexOf(e.target);
                        
                        // move to next or previous input based on shift key
                        const nextIndex = e.shiftKey ? 
                            (currentIndex > 0 ? currentIndex - 1 : inputs.length - 1) : 
                            (currentIndex < inputs.length - 1 ? currentIndex + 1 : 0);
                            
                        inputs[nextIndex].focus();
                    }
                });
            });
            
            // focus on the first input field
            const firstInput = document.querySelector('.editable-input');
            if (firstInput) {
                firstInput.focus();
            }
        }
        
        // process code to replace placeholders with editable inputs
        function processFillInTheBlankCode(code) {
            const placeholders = [];
            let lineNumber = 1;
            let placeholderId = 1;
            
            // helper function to escape HTML entities
            function escapeHTML(text) {
                return text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }
            
            // split the code by lines to add line numbers
            const lines = code.split('\\n');
            let processedCode = '';
            
            const placeholder = "🤍";
            
            lines.forEach((line, index) => {
                let processedLine = escapeHTML(line); 
                
                let position = 0;
                while (true) {
                    const placeholderIndex = line.indexOf(placeholder, position);
                    if (placeholderIndex === -1) break;
                    
                    const placeholderId = placeholders.length + 1;
                    placeholders.push({
                        id: placeholderId.toString(),
                        expectedAnswer: "___" // Default expected answer
                    });
                    
                    const escapedPlaceholder = escapeHTML(placeholder);
                    // cursed af
                    const inputField = "<input type='text' class='editable-input' data-id='" + placeholderId + "' data-expected='___' placeholder=''/>";
                    
                    processedLine = processedLine.replace(escapedPlaceholder, inputField);
                    
                    position = placeholderIndex + placeholder.length;
                }
                
                processedCode += '<div class="code-line"><span class="line-number">' + lineNumber + '</span><span class="line-content">' + processedLine + '</span></div>';
                lineNumber++;
            });
            
            return { processedCode, placeholders };
        }
        
        function checkAnswers() {
            const inputs = document.querySelectorAll('.editable-input');
            let allCorrect = true;
            
            inputs.forEach(input => {
                const expectedAnswer = input.getAttribute('data-expected').trim();
                const userAnswer = input.value.trim();
                
                if (userAnswer !== expectedAnswer && expectedAnswer !== '___') {
                    allCorrect = false;
                    input.style.borderColor = '#e06c75'; // Red border for incorrect answer
                } else {
                    input.style.borderColor = '#98c379'; // Green border for correct answer
                }
            });
            
            messageContainer.classList.remove('hidden', 'success', 'error');
            if (allCorrect) {
                messageContainer.textContent = "🪿 Honk! Great job! You've filled in all the blanks correctly!";
                messageContainer.classList.add('success');
                vscode.postMessage({ command: "playHonk", honkFile: "honk1.mp3" });
                
                // Enable submit button to complete the exercise
                checkAnswerButton.textContent = "Complete Exercise";
                checkAnswerButton.removeEventListener('click', checkAnswers);
                checkAnswerButton.addEventListener('click', completeExercise);
            } else {
                messageContainer.textContent = "🪿 Hmm, some answers aren't quite right. Try again!";
                messageContainer.classList.add('error');
                vscode.postMessage({ command: "playHonk", honkFile: "honk3.mp3" });
            }
            
            return allCorrect;
        }
        
        function resetInputs() {
            document.querySelectorAll('.editable-input').forEach(input => {
                input.value = '';
                input.style.borderColor = '#61afef';
                input.style.width = '30px';
            });
            
            messageContainer.classList.add('hidden');
            
            if (checkAnswerButton.textContent === "Complete Exercise") {
                checkAnswerButton.textContent = "Check Answer";
                checkAnswerButton.removeEventListener('click', completeExercise);
                checkAnswerButton.addEventListener('click', checkAnswers);
            }
            
            const firstInput = document.querySelector('.editable-input');
            if (firstInput) {
                firstInput.focus();
            }
        }
        
        // post back abt completed exercise
        function completeExercise() {
            vscode.postMessage({ command: "exerciseCompleted" });
        }
        
        checkAnswerButton.addEventListener('click', checkAnswers);
        resetButton.addEventListener('click', resetInputs);
    </script>
</body>
</html>`;
    }
}

