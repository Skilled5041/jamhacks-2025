import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const gooseViewProvider = new GooseViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'gooseView',
            gooseViewProvider
        )
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            gooseViewProvider.updateWebview();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            gooseViewProvider.updateWebview();
        })
    );
}

class GooseViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    
    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        }

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        this.updateWebview();
    }

    public updateWebview() {
        if (!this._view) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const text = document.getText();
            const filename = document.fileName.split('\\').pop() || 'unknown';
            this._view.webview.html = this._getHtmlForWebview(this._view.webview, text, filename);
        } else {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview, code?: string, filename?: string): string {
        if (code) {
            return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 10px;
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                    }
                    pre {
                        background-color: var(--vscode-editor-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow: auto;
                        white-space: pre-wrap;
                    }
                    .filename {
                        font-weight: bold;
                        margin-bottom: 10px;
                        color: var(--vscode-editor-foreground);
                    }
                </style>
            </head>
            <body>
                <div class="filename">${filename}</div>
                <pre>${this._escapeHtml(code)}</pre>
            </body>
            </html>`;
        } else {
            return `<!DOCTYPE html>
            <html lang="en">
            <body>
                <p>No active text editor</p>
            </body>
            </html>`;
        }
    }

    /**
     * escapes HTML special characters to prevent XSS
     */
    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
