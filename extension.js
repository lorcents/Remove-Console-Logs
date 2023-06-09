const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let context;
let originalCodeMap = new Map();
let commandRegistered = false;

function activate(extensionContext) {
    context = extensionContext;

	const extension = vscode.extensions.getExtension('console-log-remover');
    if (extension && !commandRegistered) {
        let disposable = vscode.commands.registerCommand('extension.removeConsoleLogs', function () {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folders found.');
                return;
            }

            workspaceFolders.forEach(folder => {
                const folderPath = folder.uri.fsPath;
                processFolder(folderPath);
            });
        });

        context.subscriptions.push(disposable);
        commandRegistered = true;
    }

    let disposable = vscode.commands.registerCommand('extension.removeConsoleLogs', function () {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folders found.');
            return;
        }

        workspaceFolders.forEach(folder => {
            const folderPath = folder.uri.fsPath;
            processFolder(folderPath);
        });
    });

    context.subscriptions.push(disposable);
}

function processFolder(folderPath) {
    const files = fs.readdirSync(folderPath);
    files.forEach(file => {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            processFolder(filePath);
        } else if (file.endsWith('.js')) {
            processFile(filePath);
        }
    });
}

function processFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf-8');
    const consoleLogRegex = /console\.log\s*\([\s\S]*?\);/g;

    if (consoleLogRegex.test(code)) {
        const modifiedCode = code.replace(consoleLogRegex, '');
        const backupFilePath = `${filePath}.bak`;

        // Create a backup file with the original code if it doesn't exist
        if (!originalCodeMap.has(filePath)) {
            fs.writeFileSync(backupFilePath, code, 'utf-8');
            originalCodeMap.set(filePath, backupFilePath);
            console.log(`Created backup file: ${backupFilePath}`);
        }

        // Write the modified code to the file
        fs.writeFileSync(filePath, modifiedCode, 'utf-8');
        console.log(`Removed console log statements from ${filePath}`);

        showUndoButton(() => {
            undoRemoveConsoleLogs(filePath);
        });

        vscode.window.showInformationMessage('Console log statements removed.', { modal: false }, 'Undo').then(result => {
            if (result === 'Undo') {
                undoRemoveConsoleLogs(filePath);
            }
        });
    } else {
        vscode.window.showInformationMessage('No console log statements found.');
    }
}

function undoRemoveConsoleLogs(filePath) {
    if (originalCodeMap.has(filePath)) {
        const backupFilePath = originalCodeMap.get(filePath);
        const originalCode = fs.readFileSync(backupFilePath, 'utf-8');
        fs.writeFileSync(filePath, originalCode, 'utf-8');
        console.log(`Restored original code in ${filePath}`);

        // Delete the backup file
        fs.unlinkSync(backupFilePath);
        originalCodeMap.delete(filePath);
        console.log(`Deleted backup file: ${backupFilePath}`);

        removeUndoButton();
    }
}

function showUndoButton(callback) {
    const undoButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    undoButton.text = 'Undo Remove Console Logs';
    undoButton.command = 'extension.undoRemoveConsoleLogs';
    undoButton.tooltip = 'Undo the removal of console log statements';
    undoButton.show();

    context.subscriptions.push(undoButton);
    vscode.commands.registerCommand('extension.undoRemoveConsoleLogs', callback);
}

function removeUndoButton() {
    context.subscriptions.forEach((subscription) => {
        subscription.dispose();
    });
    originalCodeMap.clear();
}

function deactivate() {
    removeUndoButton();
}

module.exports = {
    activate,
    deactivate
};
