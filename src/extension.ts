import * as vscode from 'vscode';
import { lint_active_document, lint_document } from './checkwriting';

export function activate(context: vscode.ExtensionContext) {
  let subscriptions = context.subscriptions;
  let diagnostics = vscode.languages.createDiagnosticCollection('checkwriting');
  subscriptions.push(diagnostics);
  let log_channel = vscode.window.createOutputChannel('checkwriting');
  subscriptions.push(log_channel);

  // async function check_document(file: vscode.TextDocument) {
  //   if (vscode.workspace.workspaceFolders === undefined) {
  //     return;
  //   }
  //   const diag = await lint_document(
  //     file,
  //     vscode.workspace.workspaceFolders[0].uri.fsPath,
  //     log_channel);
  //   diagnostics.set(file.uri, diag);
  // }

  async function check_active_document() {
    if (vscode.window.activeTextEditor === undefined
      || vscode.workspace.workspaceFolders === undefined) {
      return;
    }
    const diag = await lint_active_document(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      log_channel);
    if (diag.document) {
      diagnostics.set(diag.document.uri, diag.diagnostics);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('checkwriting.scanActiveFile', check_active_document));
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(check_active_document));
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(check_active_document));
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => diagnostics.delete(doc.uri)));
}

export function deactivate() { }
