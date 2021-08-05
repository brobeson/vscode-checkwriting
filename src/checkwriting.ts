import { spawn } from 'child_process';
import * as vscode from 'vscode';

export async function lint_active_document(
  working_directory: string,
  log_channel: vscode.OutputChannel) {
  if (vscode.window.activeTextEditor === undefined) {
    return { document: undefined, diagnostics: [] };
  }
  return {
    document: vscode.window.activeTextEditor.document,
    diagnostics: await lint_document(
      vscode.window.activeTextEditor.document,
      working_directory,
      log_channel)
  };
}

export async function lint_document(
  file: vscode.TextDocument,
  working_directory: string,
  log_channel: vscode.OutputChannel) {
  return create_diagnostics_for_all_output(
    await run_checkwriting(file.uri.fsPath, working_directory, log_channel),
    file);
}

function run_checkwriting(
  file: string,
  working_directory: string,
  log_channel: vscode.OutputChannel): Promise<string> {
  return new Promise((resolve, reject) => {
    const command_arguments: string[] = ["-v", file];
    const checkwriting = "checkwriting";
    log_channel.appendLine(`> ${checkwriting} ${command_arguments.join(' ')}`);
    log_channel.show();

    const process = spawn(checkwriting, command_arguments, { "cwd": working_directory });
    if (process.pid) {
      let stdout = "";
      let stderr = "";
      process.stdout.on("data", data => {
        stdout += data;
      });
      process.stdout.on("end", () => {
        log_channel.appendLine(stdout);
        resolve(stdout);
      });
      process.stderr.on("data", data => {
        stderr += data;
      });
      process.stderr.on("end", () => {
        if (stderr.length > 0) {
          const exception_message = extract_exception_message(stderr);
          vscode.window.showErrorMessage(
            `Checkwriting failed; here's the exception message:\n${exception_message}`);
        }
      });
      process.on("error", err => {
        log_channel.appendLine(err.message);
        reject(err);
      });
    }
    else {
      log_channel.appendLine("Failed to run checkwriting.");
    }
  });
}

function extract_exception_message(process_output: string): string {
  const lines = process_output.trim().split('\n');
  return lines[lines.length - 1];
}

function create_diagnostics_for_all_output(process_output: string, file: vscode.TextDocument): vscode.Diagnostic[] {
  const lines = process_output.trim().split('\n');
  let diagnostics: vscode.Diagnostic[] = [];
  for (const line of lines) {
    const diagnostic = create_diagnostic_for_one_line(line);
    if (diagnostic !== null) {
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
}

class Details {
  readonly filename: string; // Function name with namespaces.
  readonly line_number: number;
  readonly text: string;
  readonly start_column: number;
  readonly end_column: number;
  constructor(filename: string, line_number: number, start_column: number, end_column: number, text: string) {
    this.filename = filename;
    this.line_number = line_number;
    this.text = text;
    this.start_column = start_column;
    this.end_column = end_column;
  }
}

function create_diagnostic_for_one_line(line: string): vscode.Diagnostic | null {
  const details = extract_details(line);
  if (details === null) {
    return null;
  }
  let diagnostic = new vscode.Diagnostic(
    new vscode.Range(details.line_number,
      details.start_column,
      details.line_number,
      details.end_column),
    details.text,
    vscode.DiagnosticSeverity.Warning);
  diagnostic.source = "CheckWriting";
  return diagnostic;
}

function extract_details(line: string) {
  const expression: RegExp = /^([^:]+):(\d+):\s(.+)$/;
  let matches = line.match(expression);
  if (matches === null) {
    return null;
  }
  let text = matches[3];
  const start_index = text.indexOf("**");
  let end_index = text.lastIndexOf("**");
  const asterisk_count = text.substring(start_index, end_index + 2).split("*").length - 1;
  end_index = end_index - asterisk_count + 2;
  text = text.split("**").join("");
  return new Details(
    matches[1],      // The filename
    +matches[2] - 1, // The line number is 1-based in the output. Change it to 0-based necessary by VS Code.
    start_index,
    end_index,
    text
  );
}
