'use strict';
import { Iterables } from '../system';
import { TextEditor, Uri, window } from 'vscode';
import { ActiveEditorCommand, CommandContext, Commands, getCommandUri, isCommandViewContextWithCommit } from './common';
import { GitService, GitUri } from '../gitService';
import { Logger } from '../logger';
import { copy } from 'copy-paste';

export interface CopyShaToClipboardCommandArgs {
    sha?: string;
}

export class CopyShaToClipboardCommand extends ActiveEditorCommand {

    constructor(
        private readonly git: GitService
    ) {
        super(Commands.CopyShaToClipboard);
    }

    protected async preExecute(context: CommandContext, args: CopyShaToClipboardCommandArgs = {}): Promise<any> {
        if (isCommandViewContextWithCommit(context)) {
            args = { ...args };
            args.sha = context.node.commit.sha;
            return this.execute(context.editor, context.node.commit.uri, args);
        }

        return this.execute(context.editor, context.uri, args);
    }

    async execute(editor?: TextEditor, uri?: Uri, args: CopyShaToClipboardCommandArgs = {}): Promise<any> {
        uri = getCommandUri(uri, editor);

        try {
            args = { ...args };

            // If we don't have an editor then get the sha of the last commit to the branch
            if (uri === undefined) {
                const repoPath = await this.git.getActiveRepoPath(editor);
                if (!repoPath) return undefined;

                const log = await this.git.getLogForRepo(repoPath, { maxCount: 1 });
                if (!log) return undefined;

                args.sha = Iterables.first(log.commits.values()).sha;
                copy(args.sha);
                return undefined;
            }

            const gitUri = await GitUri.fromUri(uri, this.git);

            if (args.sha === undefined) {
                const blameline = (editor && editor.selection.active.line) || 0;
                if (blameline < 0) return undefined;

                try {
                    const blame = editor && editor.document && editor.document.isDirty
                        ? await this.git.getBlameForLineContents(gitUri, blameline, editor.document.getText())
                        : await this.git.getBlameForLine(gitUri, blameline);
                    if (blame === undefined) return undefined;

                    args.sha = blame.commit.sha;
                }
                catch (ex) {
                    Logger.error(ex, 'CopyShaToClipboardCommand', `getBlameForLine(${blameline})`);
                    return window.showErrorMessage(`Unable to copy commit id. See output channel for more details`);
                }
            }

            copy(args.sha);
            return undefined;
        }
        catch (ex) {
            Logger.error(ex, 'CopyShaToClipboardCommand');
            return window.showErrorMessage(`Unable to copy commit id. See output channel for more details`);
        }
    }
}