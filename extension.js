const vscode = require('vscode');

let commandRegistered = false;
let undoDisposable;
let originalCodeMap = new Map();

async function activate(context) {
    const commandDisposable = vscode.commands.registerCommand('extension.removeConsoleLogs', async function () {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            vscode.window.showInformationMessage('Looking for console logs in the workspace...');

            let totalRemovedCount = 0;

            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folderPath, '**/*.{js,jsx,ts,tsx}'),
                    '**/node_modules/**'
                );

                for (const file of files) {
                    const document = await vscode.workspace.openTextDocument(file);
                    const edits = await processFile(document);

                    if (edits.length > 0) {
                        totalRemovedCount += edits.length;
                        applyEdits(document.uri, edits);
                        showUndoButton(context, document.uri);
                    }
                }
            }

            if (totalRemovedCount === 0) {
                vscode.window.showInformationMessage('No console log(s) statement found in the workspace.');
            }
        } else {
            vscode.window.showInformationMessage('No workspace found.');
        }
    });

    context.subscriptions.push(commandDisposable);

    if (!commandRegistered) {
        commandRegistered = true;
        vscode.commands.executeCommand('setContext', 'removeConsoleLogsCommandAvailable', true);
    }

    const commands = await vscode.commands.getCommands(true);
    if (commands.includes('extension.undoRemoveConsoleLogs')) {
        vscode.commands.executeCommand('setContext', 'removeConsoleLogsUndoAvailable', true);
    }
}

async function processFile(document) {
    const consoleLogRegex = /console\.log\s*\([\s\S]*?\);?/g;
    const text = document.getText();
    const edits = [];

    let match;
    while ((match = consoleLogRegex.exec(text))) {
        const startPosition = document.positionAt(match.index);
        const endPosition = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPosition, endPosition);
        const edit = new vscode.TextEdit(range, '');
        edits.push(edit);
    }

    // Store the original code for undo
    originalCodeMap.set(document.uri, text);

    return edits;
}

function applyEdits(uri, edits) {
    const editBuilder = new vscode.WorkspaceEdit();
    editBuilder.set(uri, edits);
    vscode.workspace.applyEdit(editBuilder);
}

function undoRemoveConsoleLogs(uri) {
    const originalCode = originalCodeMap.get(uri);

    if (originalCode) {
        const editBuilder = new vscode.WorkspaceEdit();
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1000000, 0)); // Assuming a large range

        editBuilder.replace(uri, range, originalCode);
        vscode.workspace.applyEdit(editBuilder);

        removeUndoButton();

        vscode.window.showInformationMessage('Reverted successfully.');
    }
}

function showUndoButton(context, uri) {
    removeUndoButton();

    undoDisposable = vscode.commands.registerCommand('extension.undoRemoveConsoleLogs', () => {
        undoRemoveConsoleLogs(uri);
    });

    const message = 'Removed console logs. Undo';
    vscode.window.showInformationMessage(message, { modal: false }, 'Undo').then(result => {
        if (result === 'Undo') {
            undoRemoveConsoleLogs(uri);
        }
    });

    context.subscriptions.push(undoDisposable);
}

function removeUndoButton() {
    if (undoDisposable) {
        undoDisposable.dispose();
        undoDisposable = undefined;
    }
}

function deactivate() {
    vscode.commands.executeCommand('setContext', 'removeConsoleLogsCommandAvailable', false);
    removeUndoButton();
}

module.exports = {
    activate,
    deactivate
};
