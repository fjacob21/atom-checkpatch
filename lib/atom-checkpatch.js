'use babel';

import AtomCheckpatchView from './atom-checkpatch-view';
import { CompositeDisposable } from 'atom';
import { BufferedProcess } from 'atom';

export default {
        linuxPath: '/home/fjacob/dev/linux/',
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

        createMessage(severity, file, line, desc, excerpt) {
                return {
                      severity: severity,
                      location: {
                        file: file,
                        position: [[line, 0], [line, 1]]
                      },
                      excerpt: desc,
                      description: excerpt
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
                                var idx = 0;
                                descParts = item[idx++].split(':');
                                type = descParts[0];
                                desc = descParts[1];
                                while (!item[idx].startsWith('#') && idx < item.length) {
                                        desc += item[idx];
                                        idx++;
                                }
                                fileParts = item[idx].split(':');
                                console.debug(item, fileParts);
                                file = fileParts[2];
                                line = fileParts[3];
                                file = file.trim();
                                file = this.linuxPath + file;
                                line = parseInt(line) - 1;
                                excerpt = '';
                                for (var j=idx; j<item.length; j++)
                                        excerpt += item[j];
                                if (type == 'CHECK')
                                  msgs.push(this.createMessage('info', file, line, desc, excerpt));
                                else if(type == 'WARNING')
                                  msgs.push(this.createMessage('warning', file, line, desc, excerpt));
                                else if(type == 'ERROR')
                                  msgs.push(this.createMessage('error', file, line, desc, excerpt));
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
