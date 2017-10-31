'use babel';

import AtomCheckpatchView from './atom-checkpatch-view';
import { CompositeDisposable } from 'atom';
import { BufferedProcess } from 'atom';

export default {
        linuxPath: '/home/fred/dev/linux/',
        atomCheckpatchView: null,
        modalPanel: null,
        subscriptions: null,

        activate(state) {
                // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
                this.subscriptions = new CompositeDisposable();

                // Register command that toggles this view
                this.subscriptions.add(atom.commands.add('atom-workspace', {
                        'atom-checkpatch:toggle': () => this.toggle()
                }));
        },

        deactivate() {
                this.subscriptions.dispose();
        },

        serialize() {
                return {
                atomCheckpatchViewState: ""
                };
        },

        toggle() {
                console.log('AtomCheckpatch was toggled!');
                this.checkpatch();
        },

        createMessage(severity, file, line, desc) {
                return {
                      severity: severity,
                      location: {
                        file: file,
                        position: [[line, 0], [line, 1]]
                      },
                      excerpt: desc,
                      description: desc
              };
        },

        exitCheckpatch(code) {
                var lines = this.result.split('\n');
                var item = [];
                var msgs = [];
                for(var i=0; i < lines.length; i++) {
                        var line = lines[i];
                        if (line.startsWith('total'))
                                break;
                        item.push(line);
                        if (line == '') {
                                descParts = item[0].split(':');
                                type = descParts[0];
                                desc = descParts[1];
                                fileParts = item[1].split(':');
                                file = fileParts[2];
                                line = fileParts[3];
                                file = file.trim();
                                file = this.linuxPath + file;
                                line = parseInt(line) - 1;
                                if (type == 'CHECK')
                                  msgs.push(this.createMessage('info', file, line, desc));
                                else if(type == 'WARNING')
                                  msgs.push(this.createMessage('warning', file, line, desc));
                                else if(type == 'ERROR')
                                  msgs.push(this.createMessage('error', file, line, desc));
                                item = [];
                        }
                }
                this.linter.setAllMessages(msgs);
        },

        consumeIndie(registerIndie) {
                this.linter = registerIndie({
                        name: 'checkpatch',
                });

                this.subscriptions.add(this.linter);
        },

        checkpatchOutput(output) {
                this.result += output;
        },

        checkpatch() {
                const editor = atom.workspace.getActiveTextEditor();
                editorPath = editor.getPath();
                editorPath = editorPath.substring(this.linuxPath.length);
                options =
                  {cwd: this.linuxPath
                };
                this.result = '';
                const command = 'scripts/checkpatch.pl';
                const args = ['-f', editorPath];
                const stdout = (output) => this.checkpatchOutput(output);
                const exit = (code) => this.exitCheckpatch(code);
                const process = new BufferedProcess({command, args, options, stdout, exit});
        }

};
